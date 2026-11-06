import { Keypair, Networks, StrKey } from "@stellar/stellar-sdk";

/** Cuenta pública del sellador, derivada de la clave secreta sin exponerla. null si no está configurada o es inválida. */
export function cuentaSelladora(): string | null {
  const secreto = process.env.SELLADOR_STELLAR_SECRETO;
  if (!secreto) return null;
  try {
    return Keypair.fromSecret(secreto).publicKey();
  } catch {
    return null;
  }
}

/** stellar.toml (SEP-1): publica de forma verificable qué cuentas son las oficiales de GALCOA+ (selladora y aprobadoras). */
export function armarStellarToml(cuentas: string[], passphrase: string = Networks.TESTNET, contrato?: string | null): string {
  const validas = [...new Set(cuentas)].filter((c) => StrKey.isValidEd25519PublicKey(c));
  // SEP-1 no tiene un campo estándar para contratos: va en la descripción, en texto, para que un tercero lo encuentre.
  const sobreContrato = contrato && StrKey.isValidContract(contrato)
    ? ` Contrato de registro (testnet): ${contrato}. Formato del comprobante: galcoa.stellar.comprobante.v2 (los v1 ya emitidos se siguen verificando).`
    : "";
  return [
    'VERSION="2.0.0"',
    `NETWORK_PASSPHRASE="${passphrase}"`,
    `ACCOUNTS=[${validas.map((c) => `"${c}"`).join(", ")}]`,
    "",
    "[DOCUMENTATION]",
    'ORG_SUPPORT_EMAIL="galcoa.ok@gmail.com"',
    'ORG_NAME="GALCOA+ en Stellar (prototipo en testnet)"',
    `ORG_DESCRIPTION="Verificación de datos de entregas con reglas deterministas; sella en Stellar solo una huella de 32 bytes por lote.${sobreContrato}"`,
    "",
  ].join("\n");
}
