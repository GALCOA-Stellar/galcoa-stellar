// Una sola interfaz para firmar con Varial, por la extensión del navegador (escritorio) o por el celular (WalletConnect).
// Todo se carga solo cuando la persona toca el botón: la página no baja nada de esto si no se usa.
import { CADENA_STELLAR_TESTNET, WALLETCONNECT_PROJECT_ID } from "../config/wallet";

export type Via = "extension" | "celular";
const PASSPHRASE_TESTNET = "Test SDF Network ; September 2015";
const METODOS = ["stellar_signXDR", "stellar_signAndSubmitXDR", "stellar_signMessage", "stellar_signAuthEntry"];

type Proveedor = { request: <T>(a: { method: string; params: unknown }, chain: string) => Promise<T>; session?: { namespaces: Record<string, { accounts: string[]; methods: string[] }> }; connect: (o: unknown) => Promise<unknown>; disconnect: () => Promise<void> };
let celular: { provider: Proveedor; modal: { open: () => void; close: () => void } } | null = null;

const aBase64 = (v: string | ArrayBuffer | Uint8Array) => (typeof v === "string" ? v : Buffer.from(v as ArrayBuffer).toString("base64"));

async function iniciarCelular() {
  if (celular) return celular;
  const [{ UniversalProvider }, { createAppKit }, { mainnet }] = await Promise.all([import("@walletconnect/universal-provider"), import("@reown/appkit/core"), import("@reown/appkit/networks")]);
  const provider = (await UniversalProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    metadata: { name: "GALCOA+ en Stellar", description: "Verificación de entregas con reglas y prueba en Stellar (red de prueba)", url: window.location.origin, icons: [`${window.location.origin}/favicon.ico`] },
  })) as unknown as Proveedor;
  // AppKit exige al menos una red; con manualWCControl no la usa para cambiar de cadena.
  const modal = createAppKit({ projectId: WALLETCONNECT_PROJECT_ID, networks: [mainnet], universalProvider: provider as never, manualWCControl: true }) as unknown as { open: () => void; close: () => void };
  celular = { provider, modal };
  return celular;
}

/** Conecta la billetera y devuelve la dirección (G…). */
export async function conectarBilletera(via: Via): Promise<string> {
  if (via === "extension") {
    const f = await import("@stellar/varial-sdk");
    const acceso = await f.requestAccess();
    if (acceso.error) throw new Error(String(acceso.error.message ?? acceso.error));
    return acceso.address;
  }
  const { provider, modal } = await iniciarCelular();
  modal.open();
  try {
    await provider.connect({ namespaces: { stellar: { methods: METODOS, chains: [CADENA_STELLAR_TESTNET], events: ["accountsChanged"] } } });
  } finally { modal.close(); }
  const s = provider.session?.namespaces?.stellar;
  const cuenta = s?.accounts?.[0]?.split(":")[2];
  if (!cuenta) throw new Error("La billetera no devolvió ninguna cuenta.");
  if (!s?.methods?.includes("stellar_signXDR")) throw new Error("Esta billetera no permite firmar transacciones.");
  return cuenta;
}

export async function firmarMensaje(via: Via, mensaje: string, cuenta: string): Promise<string> {
  if (via === "extension") {
    const f = await import("@stellar/varial-sdk");
    const s = await f.signMessage(mensaje, { address: cuenta });
    if (s.error || !s.signedMessage) throw new Error("No se firmó el mensaje.");
    return aBase64(s.signedMessage as string | ArrayBuffer);
  }
  const { provider } = await iniciarCelular();
  const r = await provider.request<{ signature: string }>({ method: "stellar_signMessage", params: { message: mensaje } }, CADENA_STELLAR_TESTNET);
  if (!r?.signature) throw new Error("No se firmó el mensaje.");
  return r.signature;
}

export async function firmarTransaccion(via: Via, xdr: string, cuenta: string): Promise<{ xdr: string; firmante: string }> {
  if (via === "extension") {
    const f = await import("@stellar/varial-sdk");
    const s = await f.signTransaction(xdr, { networkPassphrase: PASSPHRASE_TESTNET, address: cuenta });
    if (s.error || !s.signedTxXdr) throw new Error("No se firmó (¿lo rechazaste?).");
    return { xdr: s.signedTxXdr, firmante: s.signerAddress ?? cuenta };
  }
  const { provider } = await iniciarCelular();
  const r = await provider.request<{ signedXDR: string }>({ method: "stellar_signXDR", params: { xdr } }, CADENA_STELLAR_TESTNET);
  if (!r?.signedXDR) throw new Error("No se firmó (¿lo rechazaste?).");
  return { xdr: r.signedXDR, firmante: cuenta };
}

export async function firmarAutorizacion(via: Via, preimage: string, cuenta: string): Promise<string> {
  if (via === "extension") {
    const f = await import("@stellar/varial-sdk");
    const s = await f.signAuthEntry(preimage, { address: cuenta });
    if (s.error || !s.signedAuthEntry) throw new Error("No se firmó (¿lo rechazaste? Si tu Varial es muy vieja, actualizala).");
    return aBase64(s.signedAuthEntry as string | ArrayBuffer);
  }
  const { provider } = await iniciarCelular();
  const r = await provider.request<{ signedAuthEntry: string }>({ method: "stellar_signAuthEntry", params: { entryXdr: preimage } }, CADENA_STELLAR_TESTNET);
  if (!r?.signedAuthEntry) throw new Error("No se firmó (¿lo rechazaste?).");
  return r.signedAuthEntry;
}
