import { cookies } from "next/headers";
import { IDIOMA_COOKIE, type Idioma } from "./idioma-compartido";

export { IDIOMA_COOKIE, type Idioma };

/** Idioma elegido por la persona (cookie). Por defecto, español. */
export async function leerIdioma(): Promise<Idioma> {
  const c = (await cookies()).get(IDIOMA_COOKIE)?.value;
  return c === "en" ? "en" : "es";
}
