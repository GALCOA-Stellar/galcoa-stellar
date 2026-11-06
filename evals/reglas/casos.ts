/**
 * Casos del examen de las reglas. Los resultados esperados salen de lo que DICE cada regla (ver rules.ts), no de lo
 * que hoy devuelve el código. Dos conjuntos, como pide el proyecto:
 *   - "ajuste":  se pueden mirar mientras se afinan las reglas.
 *   - "reserva": no se miran al afinar; sirven para medir sensibilidad y especificidad sin hacernos trampa.
 * Cambiar este archivo o rules.ts cambia la huella del examen y obliga a re-aprobarlo (ver huella.mjs).
 */
export type Caso = {
  nombre: string;
  conjunto: "ajuste" | "reserva";
  entrada: unknown;
  esperado: "verde" | "amarillo" | "rojo";
  /** Reglas que tienen que figurar como no cumplidas (vacío = ninguna). */
  fallan: string[];
};

const H = "ab".repeat(32);
const base = { remito: "R-100", producto: "Aceite 900 ml", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: H };
const con = (cambios: Record<string, unknown>) => ({ ...base, ...cambios });
const sin = (...claves: string[]) => Object.fromEntries(Object.entries(base).filter(([k]) => !claves.includes(k)));

export const CASOS: Caso[] = [
  // ---- Documentos correctos (miden la especificidad: no deben dar falsas alarmas)
  { nombre: "limpio: entrega exacta", conjunto: "ajuste", entrada: base, esperado: "verde", fallan: [] },
  { nombre: "limpio: otro producto y cantidad", conjunto: "ajuste", entrada: con({ producto: "Yerba 1 kg", cantidadPedida: 120, cantidadRecibida: 120 }), esperado: "verde", fallan: [] },
  { nombre: "limpio: confirma otra persona", conjunto: "ajuste", entrada: con({ cargadoPor: "usuario.07", confirmadoPor: "comercio_22" }), esperado: "verde", fallan: [] },
  { nombre: "limpio: cantidad cero pedida y recibida", conjunto: "reserva", entrada: con({ cantidadPedida: 0, cantidadRecibida: 0 }), esperado: "verde", fallan: [] },
  { nombre: "limpio: registrado justo a los 3 días (límite)", conjunto: "reserva", entrada: con({ fechaRegistro: "2026-11-05" }), esperado: "verde", fallan: [] },
  { nombre: "limpio: con observación sin diferencia", conjunto: "reserva", entrada: con({ observacion: "Entregado en puerta trasera" }), esperado: "verde", fallan: [] },

  // ---- Errores sembrados que deben frenarse (rojo)
  { nombre: "falta el remito", conjunto: "ajuste", entrada: sin("remito"), esperado: "rojo", fallan: ["ALC-COM-01"] },
  { nombre: "falta quien confirma", conjunto: "ajuste", entrada: sin("confirmadoPor"), esperado: "rojo", fallan: ["ALC-COM-01"] },
  { nombre: "fecha inexistente (30 de febrero)", conjunto: "ajuste", entrada: con({ fechaEntrega: "2026-02-30" }), esperado: "rojo", fallan: ["ALC-LEG-01"] },
  { nombre: "cantidad escrita en letras", conjunto: "ajuste", entrada: con({ cantidadRecibida: "diez" }), esperado: "rojo", fallan: ["ALC-LEG-01"] },
  { nombre: "huella del original demasiado corta", conjunto: "ajuste", entrada: con({ evidenciaHash: "abc123" }), esperado: "rojo", fallan: ["ALC-LEG-01"] },
  { nombre: "carga y confirma la misma persona", conjunto: "ajuste", entrada: con({ confirmadoPor: "operador-01" }), esperado: "rojo", fallan: ["ALC-ATR-01"] },
  { nombre: "registrado antes de la entrega", conjunto: "ajuste", entrada: con({ fechaRegistro: "2026-11-01" }), esperado: "rojo", fallan: ["ALC-COH-01"] },
  { nombre: "recibido distinto de pedido, sin observación", conjunto: "ajuste", entrada: con({ cantidadRecibida: 8 }), esperado: "rojo", fallan: ["ALC-EXA-01"] },
  { nombre: "falta la fecha de entrega", conjunto: "reserva", entrada: sin("fechaEntrega"), esperado: "rojo", fallan: ["ALC-COM-01"] },
  { nombre: "mes 13", conjunto: "reserva", entrada: con({ fechaRegistro: "2026-13-02" }), esperado: "rojo", fallan: ["ALC-LEG-01"] },
  { nombre: "cantidad con decimales", conjunto: "reserva", entrada: con({ cantidadRecibida: 10.5 }), esperado: "rojo", fallan: ["ALC-LEG-01"] },
  { nombre: "cantidad negativa", conjunto: "reserva", entrada: con({ cantidadRecibida: -1 }), esperado: "rojo", fallan: ["ALC-LEG-01"] },
  { nombre: "identificador con espacios (nombre y apellido)", conjunto: "reserva", entrada: con({ confirmadoPor: "ana lopez" }), esperado: "rojo", fallan: ["ALC-LEG-01"] },
  { nombre: "observación de más de 300 caracteres", conjunto: "reserva", entrada: con({ observacion: "x".repeat(301) }), esperado: "rojo", fallan: ["ALC-LEG-01"] },
  { nombre: "misma persona con otro formato de id", conjunto: "reserva", entrada: con({ cargadoPor: "u.9", confirmadoPor: "u.9" }), esperado: "rojo", fallan: ["ALC-ATR-01"] },
  { nombre: "diferencia sin observación y sin evidencia", conjunto: "reserva", entrada: { ...sin("evidenciaHash"), cantidadRecibida: 9 }, esperado: "rojo", fallan: ["ALC-EXA-01", "ALC-ORI-01"] },
  { nombre: "entrada vacía", conjunto: "reserva", entrada: null, esperado: "rojo", fallan: ["ALC-COM-01"] },
  { nombre: "entrada que es una lista", conjunto: "reserva", entrada: [base], esperado: "rojo", fallan: ["ALC-COM-01"] },

  // ---- Declarados, no verificados (amarillo: se sella marcado)
  { nombre: "diferencia declarada con observación", conjunto: "ajuste", entrada: con({ cantidadRecibida: 8, observacion: "2 cajas dañadas en el flete" }), esperado: "amarillo", fallan: ["ALC-EXA-01"] },
  { nombre: "carga tardía (5 días)", conjunto: "ajuste", entrada: con({ fechaRegistro: "2026-11-07" }), esperado: "amarillo", fallan: ["ALC-CTE-01"] },
  { nombre: "sin huella del original", conjunto: "ajuste", entrada: sin("evidenciaHash"), esperado: "amarillo", fallan: ["ALC-ORI-01"] },
  { nombre: "carga tardía justo a los 4 días (pasa el límite)", conjunto: "reserva", entrada: con({ fechaRegistro: "2026-11-06" }), esperado: "amarillo", fallan: ["ALC-CTE-01"] },
  { nombre: "diferencia con observación y además tardía", conjunto: "reserva", entrada: con({ cantidadRecibida: 9, observacion: "Faltó una caja", fechaRegistro: "2026-11-09" }), esperado: "amarillo", fallan: ["ALC-EXA-01", "ALC-CTE-01"] },
  { nombre: "sin evidencia y tardía", conjunto: "reserva", entrada: { ...sin("evidenciaHash"), fechaRegistro: "2026-11-10" }, esperado: "amarillo", fallan: ["ALC-ORI-01", "ALC-CTE-01"] },
];
