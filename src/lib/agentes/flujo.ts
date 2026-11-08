import "server-only";
import { cantidadesSinRespaldo, detectarInyeccion, REGLA_INYECCION } from "../dominio/inyeccion";
import { evaluar, type Evaluacion } from "../dominio/rules";
import type { ConfigAgentes } from "./proveedor";
import { REGLA_PROCEDENCIA, faltasDeProcedencia } from "../dominio/procedencia";
import { registrarConCitas, type Propuesta } from "./registrador";
import { aplicarVerificacion, verificar, type Hallazgo } from "./verificador";

export const PLAZO_TOTAL_MS = 50_000;

/** Espera una promesa hasta `ms`; pasado el plazo devuelve lo que diga `alVencer` (o lanza). */
export function conPlazo<T, U>(p: Promise<T>, ms: number, alVencer: () => U): Promise<T | U> {
  let reloj: ReturnType<typeof setTimeout>;
  const tope = new Promise<U>((ok, mal) => { reloj = setTimeout(() => { try { ok(alVencer()); } catch (e) { mal(e); } }, ms); });
  return Promise.race([p, tope]).finally(() => clearTimeout(reloj));
}

/** Quién confirma todavía no existe: se evalúa con este marcador y se muestra como "pendiente de segunda persona". */
export const PENDIENTE = "pendiente-confirmacion";

/**
 * Arma la entrada que evalúan las reglas. Lo que NO viene de la IA: quién cargó, quién confirma y la fecha de registro.
 * Esos tres los pone el servidor; el agente no puede tocarlos.
 */
export function entradaDe(p: Propuesta, cargadoPor: string, confirmadoPor: string, hoy: string, evidenciaHash?: string) {
  return { ...p, fechaRegistro: hoy, cargadoPor, confirmadoPor, ...(evidenciaHash ? { evidenciaHash } : {}) };
}

const HEX64 = /^[0-9a-f]{64}$/;
/** La huella de una evidencia respalda UNA entrega: solo se adjunta si el mensaje cuenta una sola (ALC-EVI-01 frena la misma huella repetida). */
export const huellaAdjuntable = (huella: string | undefined, cantidadDeEntregas: number): string | undefined =>
  huella !== undefined && HEX64.test(huella) && cantidadDeEntregas === 1 ? huella : undefined;

export type Vista = { indice: number; propuesta: Propuesta; evaluacion: Evaluacion; pendienteDeConfirmacion: boolean };
export type Resultado = {
  propuestas: Propuesta[];
  hallazgos: Hallazgo[] | null;
  vistas: Vista[];
  independientes: boolean;
  modelos: ConfigAgentes["modelos"];
  /** Qué modelo respondió de verdad a cada agente (de la lista con respaldo); null si no respondió ninguno. */
  modelosUsados: { registrador: string | null; verificador: string | null };
  /** El segundo agente no respondió. Se informa aparte porque los avisos del código (inyección, cantidades, procedencia) convierten el null en una lista. */
  verificadorCaido: boolean;
};

function vistasDe(propuestas: Propuesta[], hallazgos: Hallazgo[] | null, cargadoPor: string, confirmadoPor: string, hoy: string, pendiente: boolean, evidenciaHash?: string): Vista[] {
  const huella = huellaAdjuntable(evidenciaHash, propuestas.length);
  return propuestas.map((propuesta, indice) => {
    const mios = hallazgos === null ? null : hallazgos.filter((h) => h.indice === indice);
    const evaluacion = aplicarVerificacion(evaluar(entradaDe(propuesta, cargadoPor, confirmadoPor, hoy, huella)), mios);
    return { indice, propuesta, evaluacion, pendienteDeConfirmacion: pendiente };
  });
}

/** Agente 1 propone → Agente 2 controla → las reglas (código) deciden. Nada se escribe ni se sella acá. */
export async function procesarMensaje(config: ConfigAgentes, mensaje: string, cargadoPor: string, hoy: string, evidenciaHash?: string): Promise<Resultado> {
  // Plazo total del pedido (la función de Vercel corta a los 60 s): el registrador tiene hasta 30 s y el verificador lo que reste.
  // Si el verificador no llega a tiempo queda como "no verificado" (null), nunca como "sin hallazgos".
  const inicio = Date.now();
  const modelosUsados: Resultado["modelosUsados"] = { registrador: null, verificador: null };
  const { propuestas, citas } = await conPlazo(registrarConCitas(config.registrador, mensaje, hoy, { alResponder: (m) => { modelosUsados.registrador = m; } }), 30_000, () => { throw new Error("El Agente 1 tardó demasiado: probá de nuevo"); });
  const resto = Math.max(1_000, PLAZO_TOTAL_MS - (Date.now() - inicio));
  const delVerificador = propuestas.length > 0 ? await conPlazo(verificar(config.verificador, mensaje, propuestas, hoy, { alResponder: (m) => { modelosUsados.verificador = m; } }), resto, () => null) : [];
  // ALC-INY-01: red de seguridad en código. Si el texto parece una orden para la IA, cada entrega propuesta queda retenida, haya opinado o no el verificador.
  const motivos = detectarInyeccion(mensaje);
  // Chequeo cruzado: una cantidad que no aparece en el mensaje no se acepta, diga lo que diga el verificador.
  const sinRespaldo = cantidadesSinRespaldo(mensaje, propuestas).map((f) => ({ indice: f.indice, campo: f.campo, severidad: "critica" as const, mensaje: `${REGLA_INYECCION}: la cantidad ${f.valor} (${f.campo}) no aparece en el mensaje de la persona. Una persona tiene que revisarlo.` }));
  // Procedencia (ALC-PRO-01): cada dato propuesto tiene que traer una cita textual que esté de verdad en el mensaje.
  const sinProcedencia = faltasDeProcedencia(mensaje, propuestas as Record<string, unknown>[], citas).map((f) => ({
    indice: f.indice, campo: f.campo,
    // Sin cita: amarillo (declarado). Cita inventada, o cita real que no respalda el valor: rojo. La observación se escribe con
    // palabras del modelo más seguido, así que una observación que no calza con su cita baja a amarillo y no a rojo.
    severidad: f.motivo === "sin-cita" || (f.motivo === "cita-no-respalda" && f.campo === "observacion") ? ("advertencia" as const) : ("critica" as const),
    mensaje:
      f.motivo === "cita-inexistente" ? `${REGLA_PROCEDENCIA}: la cita de ${f.campo} no aparece en el mensaje`
      : f.motivo === "cita-no-respalda" ? `${REGLA_PROCEDENCIA}: la cita de ${f.campo} está en el mensaje pero no respalda el valor propuesto`
      : `${REGLA_PROCEDENCIA}: ${f.campo} no trae cita textual del mensaje`,
  }));
  const extra = [...sinRespaldo, ...sinProcedencia];
  const delVerificadorMas = extra.length === 0 ? delVerificador : [...(delVerificador ?? []), ...extra];
  // Aunque el verificador se haya caído (null), la inyección detectada en código siempre retiene la entrega.
  const conCodigo = motivos.length === 0 ? delVerificadorMas : [...(delVerificadorMas ?? []), ...propuestas.map((_, indice) => ({ indice, campo: "mensaje", severidad: "critica" as const, mensaje: `${REGLA_INYECCION}: el texto parece dar órdenes a la IA (${motivos.join("; ")}). Una persona tiene que revisarlo.` }))];
  // Si el verificador se cayó y el código agregó avisos, la caída no puede quedar escondida detrás de ellos: se agrega a cada entrega.
  const verificadorCaido = delVerificador === null && propuestas.length > 0;
  const hallazgos = verificadorCaido && conCodigo !== null ? [...conCodigo, ...propuestas.map((_, indice) => ({ indice, campo: "verificador", severidad: "advertencia" as const, mensaje: "No se pudo verificar con el segundo agente: el dato queda declarado, no verificado" }))] : conCodigo;
  return { propuestas, hallazgos, vistas: vistasDe(propuestas, hallazgos, cargadoPor, PENDIENTE, hoy, true, evidenciaHash), independientes: config.independientes, modelos: config.modelos, modelosUsados, verificadorCaido };
}

/** Segunda persona confirma: sin IA, solo reglas. Devuelve los documentos listos para sellar (los rojos quedan fuera). */
export function confirmarPropuestas(propuestas: Propuesta[], hallazgos: Hallazgo[] | null, cargadoPor: string, confirmadoPor: string, hoy: string, evidenciaHash?: string) {
  const vistas = vistasDe(propuestas, hallazgos, cargadoPor, confirmadoPor, hoy, false, evidenciaHash);
  const documentos = vistas.filter((v) => v.evaluacion.veredicto !== "rojo" && v.evaluacion.documento).map((v) => v.evaluacion.documento);
  return { vistas, documentos };
}
