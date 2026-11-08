/**
 * Cosmos Pay (opcional, experimental): cobros por enlace SEP-7 y webhooks firmados.
 *
 * Es una pieza de la ruta a la red principal (ver docs/producto/RUTA-A-MAINNET.md), NO parte del flujo actual:
 * con la clave apagada no hace nada, y nunca decide si un lote vale (eso lo deciden las reglas en código).
 * La clave de la API es un secreto: solo variable de entorno (COSMOS_PAY_API_KEY), nunca en el repositorio.
 */
import "server-only";
import { Client, WebhookSignatureError, Webhooks } from "@cosmosapp/pay_sdk";

export const cosmosPayActivo = (env: Record<string, string | undefined> = process.env): boolean => Boolean(env.COSMOS_PAY_API_KEY);

export type Cobro = { uri: string; qr: string; validar: (txHash: string) => Promise<{ valido: boolean; estado: string }> };
export type DatosCobro = { destino: string; monto: string; mensaje?: string };

const DESTINO = /^G[A-Z2-7]{55}$/;
const MONTO = /^\d{1,12}(\.\d{1,7})?$/;

/** Crea un cobro SEP-7 (enlace y QR). Sin activos indicados usa XLM nativo; en testnet es dinero de prueba. */
export async function crearCobro(datos: DatosCobro, env: Record<string, string | undefined> = process.env, crearCliente: (apiKey: string) => Pick<Client, "paymentIntents"> = (apiKey) => new Client({ apiKey })): Promise<Cobro> {
  const apiKey = env.COSMOS_PAY_API_KEY;
  if (!apiKey) throw new Error("Cosmos Pay no está configurado en este entorno");
  if (!DESTINO.test(datos.destino)) throw new Error("La cuenta de destino no es válida");
  if (!MONTO.test(datos.monto) || Number(datos.monto) <= 0) throw new Error("El monto no es válido");
  const intent = await crearCliente(apiKey).paymentIntents.createPay({ destination: datos.destino, amount: datos.monto, ...(datos.mensaje ? { msg: datos.mensaje.slice(0, 80) } : {}) });
  return {
    uri: intent.uri,
    qr: intent.qr,
    validar: async (txHash) => {
      if (!/^[0-9a-f]{64}$/i.test(txHash)) throw new Error("El hash de la transacción no es válido");
      const r = await intent.validate(txHash);
      return { valido: Boolean(r.valid), estado: String(r.status ?? "desconocido") };
    },
  };
}

/** Verifica un webhook firmado y devuelve el evento. Firma inválida o repetida fuera de ventana: lanza `ErrorDeFirma`. */
export class ErrorDeFirma extends Error {}
export function leerWebhook(cuerpoCrudo: string, cabecera: string | null, secreto: string | undefined, toleranciaSegundos = 300) {
  if (!secreto) throw new ErrorDeFirma("Falta el secreto del webhook");
  if (!cabecera) throw new ErrorDeFirma("Falta la firma");
  try {
    return Webhooks.constructEvent(cuerpoCrudo, cabecera, secreto, { toleranceSeconds: toleranciaSegundos });
  } catch (e) {
    if (e instanceof WebhookSignatureError) throw new ErrorDeFirma("Firma inválida");
    throw e;
  }
}
