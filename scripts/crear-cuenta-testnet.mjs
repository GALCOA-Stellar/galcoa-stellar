// Crea una cuenta de Stellar TESTNET, la fondea con Friendbot y escribe .env.local (que no va a git).
// No imprime la clave secreta. Se niega a pisar un .env.local existente.
import { existsSync, writeFileSync } from "node:fs";
import { Keypair } from "@stellar/stellar-sdk";

if (existsSync(".env.local")) {
  console.error(".env.local ya existe: no lo piso. Borralo a mano si querés una cuenta nueva.");
  process.exit(1);
}
const kp = Keypair.random();
const r = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`);
if (!r.ok) { console.error("Friendbot no respondió OK:", r.status); process.exit(1); }
writeFileSync(".env.local", `SELLADOR_STELLAR_SECRETO=${kp.secret()}\n`, { mode: 0o600 });
console.log("Listo. Cuenta de testnet (pública):", kp.publicKey());
console.log("Explorador:", `https://stellar.expert/explorer/testnet/account/${kp.publicKey()}`);
console.log("La clave secreta quedó solo en .env.local. Para Vercel, copiala a mano a la variable SELLADOR_STELLAR_SECRETO.");
