import { cuentasAutorizadas } from "@/lib/firma";
import { armarStellarToml, cuentaSelladora } from "@/lib/toml";
import { contratoId } from "@/lib/contrato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SEP-1: quien quiera saber cuáles son las cuentas oficiales de GALCOA+ las lee acá. Debe permitir CORS. */
export function GET() {
  const cuentas = [cuentaSelladora(), process.env.CUENTA_SELLADORA_2DE2?.trim(), ...(cuentasAutorizadas() ?? [])].filter((c): c is string => !!c);
  return new Response(armarStellarToml(cuentas, undefined, contratoId()), {
    headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=300" },
  });
}
