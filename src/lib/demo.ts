/** Modo demostración: solo desarrollo local y testnet. Apagado por defecto y siempre apagado en producción. */
export const demoActivo = () => process.env.MODO_DEMO === "1" && process.env.NODE_ENV !== "production";
