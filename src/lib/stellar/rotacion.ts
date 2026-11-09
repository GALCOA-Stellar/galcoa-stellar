import { Account, BASE_FEE, Networks, Operation, StrKey, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

/**
 * Cuenta del servicio con firmas de respaldo (#55): rotar una clave sin parar el sistema.
 *
 * Los contratos autorizan a una cuenta clásica con el umbral MEDIO (documentación oficial de Stellar, "Authorization":
 * "Stellar multisig with medium threshold"). Por eso la configuración separa dos cosas:
 * - Operar (umbral bajo y medio = 1): la clave del servidor sigue registrando y revocando sola, como hoy.
 * - Cambiar firmantes o umbrales (umbral alto = 2): hacen falta 2 de las 3 claves. Si la clave del servidor se pierde
 *   o se filtra, las dos de respaldo la reemplazan sin volver a desplegar contratos ni cambiar `SERVICIO_ID`.
 * La alternativa "2 de 3 también para operar" exigiría una segunda firma humana en cada sello: es decisión del equipo.
 *
 * Acá solo se ARMAN transacciones sin firmar; nadie lee ni recibe claves secretas.
 */

export const PASSPHRASE = Networks.TESTNET;
export const UMBRALES = { masterWeight: 1, lowThreshold: 1, medThreshold: 1, highThreshold: 2 } as const;
/** Tiempo para juntar las firmas de una rotación (dos personas, cada una con su billetera): 30 minutos. */
export const VIGENCIA_S = 1800;

const esCuenta = (g: string) => StrKey.isValidEd25519PublicKey(g);

function armar(cuenta: string, secuencia: string, operaciones: ReturnType<typeof Operation.setOptions>[]): string {
  const b = new TransactionBuilder(new Account(cuenta, secuencia), { fee: BASE_FEE, networkPassphrase: PASSPHRASE }).setTimeout(VIGENCIA_S);
  for (const op of operaciones) b.addOperation(op);
  return b.build().toXDR();
}

/** Primera configuración: suma dos firmantes de respaldo (peso 1) y fija los umbrales. La firma la clave actual del servicio. */
export function armarConfiguracion(cuenta: string, secuencia: string, respaldos: string[]): string {
  if (!esCuenta(cuenta)) throw new Error("La cuenta del servicio no es válida");
  if (respaldos.length !== 2) throw new Error("Se necesitan exactamente dos firmantes de respaldo");
  if (!respaldos.every(esCuenta)) throw new Error("Un firmante de respaldo no es una cuenta válida");
  if (new Set([cuenta, ...respaldos]).size !== 3) throw new Error("Los tres firmantes tienen que ser distintos");
  return armar(cuenta, secuencia, [
    ...respaldos.map((r) => Operation.setOptions({ signer: { ed25519PublicKey: r, weight: 1 } })),
    Operation.setOptions({ ...UMBRALES }),
  ]);
}

/**
 * Rotación: entra una clave nueva y sale una vieja en la MISMA transacción (nunca queda un hueco).
 * Si sale la clave original de la cuenta, su peso pasa a 0 (no se puede borrar como firmante).
 * Necesita 2 de las 3 firmas actuales (umbral alto).
 */
export function armarRotacion(cuenta: string, secuencia: string, sale: string, entra: string): string {
  if (![cuenta, sale, entra].every(esCuenta)) throw new Error("Alguna cuenta no es válida");
  if (sale === entra) throw new Error("La clave que entra tiene que ser distinta de la que sale");
  if (entra === cuenta) throw new Error("La clave original de la cuenta no puede volver a entrar como firmante");
  return armar(cuenta, secuencia, [
    Operation.setOptions({ signer: { ed25519PublicKey: entra, weight: 1 } }),
    sale === cuenta ? Operation.setOptions({ masterWeight: 0 }) : Operation.setOptions({ signer: { ed25519PublicKey: sale, weight: 0 } }),
  ]);
}

/** Datos de la cuenta como los devuelve Horizon (`/accounts/{id}`), solo lo que hace falta revisar. */
export type DatosCuenta = {
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  signers: { key: string; weight: number; type: string }[];
};

/** Problemas de la configuración actual. Lista vacía = rotación posible sin parar el sistema. */
export function revisarConfiguracion(d: DatosCuenta): string[] {
  const p: string[] = [];
  const activos = d.signers.filter((s) => s.weight > 0);
  if (activos.some((s) => s.type !== "ed25519_public_key")) p.push("Hay firmantes que no son claves comunes (hash o pre-autorizados): revisarlos a mano");
  const pesos = activos.map((s) => s.weight);
  const total = pesos.reduce((a, b) => a + b, 0);
  const maximo = Math.max(0, ...pesos);
  if (activos.length < 3) p.push(`Hay ${activos.length} firmante(s) activo(s): se necesitan 3 para rotar sin depender de una sola clave`);
  if (d.thresholds.high_threshold <= maximo) p.push("Una sola clave alcanza para cambiar firmantes (umbral alto muy bajo)");
  if (total - maximo < d.thresholds.high_threshold) p.push("Si se pierde la clave de más peso, las demás no alcanzan para rotarla");
  if (d.thresholds.med_threshold > maximo) p.push("El servidor ya no puede registrar solo (umbral medio mayor que el peso de una clave): cada sello pide otra firma");
  return p;
}

/** Lee una transacción armada acá (para mostrarla antes de firmar o para las pruebas). */
export const leer = (xdr: string) => TransactionBuilder.fromXDR(xdr, PASSPHRASE) as Transaction;
