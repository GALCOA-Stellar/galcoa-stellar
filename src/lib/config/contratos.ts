/**
 * Única fuente de los identificadores canónicos de Stellar Testnet (despliegue del 06/11/2026).
 * Cualquier otro lugar del código importa de acá. Si se redespliega, se cambia solo este archivo
 * (más las variables CONTRATO_REGISTRO_ID y ESCROW_ID del hosting) y se actualiza docs/arquitectura/DESPLIEGUE.md.
 * Los despliegues anteriores son obsoletos y quedan solo como historial. Testnet, activos de prueba.
 */
export const RED = "testnet" as const;
export const DESPLIEGUE_FECHA = "2026-11-07";

export const REGISTRO_ID = "CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV";
/** Custodia anterior (v4 sin tope de plazo): quedó con los flujos de docs/evidencia. Ya no se usa. */
export const ESCROW_ANTERIOR_ID = "CB4QPU6RRZH2QMJTV43GDPSVLJQTV4P6GERHW2KRWHGY6HLMZQEUMTPV";
export const ESCROW_ID = "CDLP7XWLU6QU6JA6O4RCYPGKRA5UHQTHAAM7PYRGM5EWWJNLCK4T5GAX";
/** Cuenta del servicio (registro) y administradora (custodia). */
export const SERVICIO_ID = "GCRTRAAGPQJSP444J5QSIBM5MILRUI4XKL36Z4UW7OEE43TAC6X3EI3Y";
/** Lote de ejemplo (vigente): el mismo del comprobante descargable en /spec. */
export const LOTE_EJEMPLO = "ec5dedf0b5c18380f39a9d29b2021023e91a857e7849cda71b5d6739a6dc5b76";
/** La custodia vigente se creó cerca de este ledger: antes no hay eventos suyos. */
export const ESCROW_DESDE_LEDGER = 5_613_900;

/** Servidor RPC y explorador de la red de prueba: único lugar donde viven estas direcciones. */
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const EXPLORADOR = "https://stellar.expert/explorer/testnet";
export const EXPLORADOR_CONTRATO = `${EXPLORADOR}/contract/`;
