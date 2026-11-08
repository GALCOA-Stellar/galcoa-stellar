"use client";

import { useRouter } from "next/navigation";
import { IDIOMA_COOKIE, type Idioma } from "@/lib/i18n/idioma-compartido";

/** Selector ES/EN. Guarda la elección en una cookie y vuelve a pedir la página en ese idioma. */
export function SelectorIdioma({ actual, etiqueta }: { actual: Idioma; etiqueta: string }) {
  const router = useRouter();
  const elegir = (idioma: Idioma) => {
    if (idioma === actual) return;
    // biome-ignore lint/suspicious/noDocumentCookie: la API de cookies del navegador (cookieStore) todavía no está en todos los navegadores
    document.cookie = `${IDIOMA_COOKIE}=${idioma}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <fieldset className="selector-idioma" aria-label={etiqueta}>
      {(["es", "en"] as const).map((i) => (
        <button key={i} type="button" onClick={() => elegir(i)} aria-pressed={actual === i} lang={i}>{i.toUpperCase()}</button>
      ))}
    </fieldset>
  );
}
