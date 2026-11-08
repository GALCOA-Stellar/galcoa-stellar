// Aprueba la huella actual del examen de las reglas.
//   npm run aprobar-reglas -- --por="Nombre" --motivo="por qué cambió (mínimo 10 caracteres)"
// Corré antes `npm test`: la aprobación solo tiene sentido si el examen da 100 % en los dos conjuntos.
import { aprobar } from "../evals/reglas/huella.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=")]; }));
try {
  const h = aprobar({ por: args.por, motivo: args.motivo });
  console.log(`Huella ${h.total.slice(0, 12)} aprobada por ${args.por}: ${args.motivo}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
