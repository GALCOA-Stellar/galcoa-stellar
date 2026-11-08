// Datos de ejemplo, tipos y utilidades de la pantalla de demo (sin JSX).
const H = "ab".repeat(32); // huella de ejemplo (64 caracteres hexadecimales) del documento original
const base = { unidad: "caja", fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: H };
export const EJEMPLO = [
  { ...base, remito: "R-0001", producto: "Aceite 900 ml", cantidadPedida: 200, cantidadRecibida: 200 },
  { ...base, remito: "R-0002", producto: "Yerba 1 kg", cantidadPedida: 120, cantidadRecibida: 120 },
  { ...base, remito: "R-0003", producto: "Fideos 500 g", cantidadPedida: 300, cantidadRecibida: 298, observacion: "2 cajas dañadas en el flete" },
  { ...base, remito: "R-0004", producto: "Arroz 1 kg", cantidadPedida: 200, cantidadRecibida: 198 },
  { ...base, remito: "R-0005", producto: "Azúcar 1 kg", cantidadPedida: 80, cantidadRecibida: 80, evidenciaHash: undefined },
  { ...base, remito: "R-0006", producto: "Harina 1 kg", cantidadPedida: 50, cantidadRecibida: 50, confirmadoPor: "operador-01" },
  { ...base, remito: "R-0007", producto: "Sal 500 g", cantidadPedida: 60, cantidadRecibida: 60, fechaRegistro: "2026-11-08" },
];

export type Veredicto = "verde" | "amarillo" | "rojo";
export type Resultado = { posicion: number; veredicto: Veredicto; reglas: { id: string; ok: boolean; detalle: string }[]; enLote: boolean };
export type Respuesta = {
  resultados: Resultado[];
  sellado: { raiz: string; memo: string; cantidadHojas: number; txHash: string; ledger: number } | null;
  comprobantes: Record<string, unknown>[];
  explorador: string | null;
  archivo?: unknown;
  error?: string;
  firmadoPor?: string | string[];
  comisionPagadaPor?: string | null;
};
export type Vista = {
  reglasVersion: string; red: string; sellan: number; afuera: number; raiz: string | null; memo: string | null;
  documentos: { posicion: number; remito: string | null; veredicto: Veredicto; enLote: boolean; avisos: { id: string; detalle: string }[] }[];
  error?: string;
};

export const ETIQUETA: Record<Veredicto, { icono: string; texto: string }> = {
  verde: { icono: "✔", texto: "Verificado" },
  amarillo: { icono: "▲", texto: "Declarado" },
  rojo: { icono: "✖", texto: "Requiere revisión" },
};
export const corta = (g: string) => `${g.slice(0, 5)}…${g.slice(-4)}`;
export const PLANTILLA_CSV = "remito,producto,unidad,cantidadPedida,cantidadRecibida,fechaEntrega,fechaRegistro,cargadoPor,confirmadoPor,evidenciaHash,observacion\n";

/** Convierte un error técnico en un mensaje claro que dice qué pasó y qué hacer. */
export function explicar(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (e instanceof SyntaxError) return "Los datos no tienen el formato esperado. Revisá la planilla o volvé a cargarla.";
  if (/User declined|rejected|denied|declin/i.test(m)) return "Rechazaste la firma en la billetera. Si fue sin querer, volvé a intentar.";
  if (/not installed|Varial|wallet/i.test(m) && !/firma|cuenta/i.test(m)) return "No encontramos la billetera Varial. Instalala en tu navegador, ponela en Testnet y recargá la página.";
  if (/passphrase|network mismatch|wrong network|Public Global|Futurenet/i.test(m)) return "La billetera está en otra red. Cambiala a Testnet (Test SDF Network) en Varial y volvé a intentar.";
  if (/BUSY|TRY_AGAIN_LATER|timeout|timed out|504|503/i.test(m)) return "La red de prueba está ocupada o tardó en responder. Esperá unos segundos y volvé a intentar: no se registró nada dos veces.";
  if (/MismaPersona|same person|misma persona/i.test(m)) return "Quien carga y quien aprueba tienen que ser personas distintas. Usá dos cuentas diferentes.";
  if (/insufficient|tx_insufficient|underfunded|no existe la cuenta|account not found|op_no_source/i.test(m)) return "La cuenta no existe o no tiene saldo de prueba en Testnet. Fondeala con Friendbot y volvé a intentar.";
  if (/ya (fue )?registrad|already|YaRegistrad|Duplicad/i.test(m)) return "Este lote ya figura registrado en la red: no se puede registrar dos veces. Verificalo en /verificar.";
  return m || "Algo salió mal. Probá de nuevo.";
}
export const TAREAS: Record<string, string> = {
  revisando: "Revisando los documentos…", preparando: "Preparando el paquete para firmar…", enviando: "Confirmando en Stellar (unos 10 segundos)…",
  firmando: "Esperando tu firma en la billetera… (mirá la ventana de Varial)", confirmando: "Confirmando en la red…",
  contrato: "Confirmando el registro en el contrato (unos 10 segundos)…", "contrato-prep": "Preparando el registro…",
};
