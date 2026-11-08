import type { ReactNode } from "react";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { BarraSuperior, PasoSiguiente } from "./navegacion";
import { BotonTema } from "./tema";
import { SelectorIdioma } from "./idioma";
import { leerIdioma } from "@/lib/i18n/idioma";
import { TEXTOS } from "@/lib/i18n/textos";

// Las páginas se generan en cada pedido para que sus scripts lleven el nonce de la política de contenido (src/proxy.ts).
export const dynamic = "force-dynamic";

// Mismas fuentes que GALCOA+ original, autoalojadas en public/fonts (licencias SIL OFL junto a los archivos).
const manrope = localFont({ src: "../../public/fonts/manrope-variable.woff2", variable: "--font-manrope", display: "swap" });
const plexMono = localFont({ src: "../../public/fonts/ibm-plex-mono-400.woff2", variable: "--font-plex-mono", weight: "400", display: "swap" });

const SITIO = "https://galcoa-stellar.vercel.app";
const TITULO = "GALCOA+ en Stellar";
const DESCRIPCION = "Prototipo: verificación de datos con fuente antes de anclarlos en Stellar Testnet, con reglas en código y prueba que cualquiera verifica. / Source-backed data verification before anchoring on Stellar Testnet.";

// El ícono, la imagen para compartir (opengraph-image.png, twitter-image.png) y el manifiesto salen de los archivos de esta carpeta.
export const metadata = {
  metadataBase: new URL(SITIO),
  title: TITULO,
  description: DESCRIPCION,
  applicationName: "GALCOA+",
  openGraph: { title: TITULO, description: DESCRIPCION, url: SITIO, siteName: "GALCOA+", type: "website", locale: "es_AR", alternateLocale: ["en_US"] },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRIPCION },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const idioma = await leerIdioma();
  const T = TEXTOS[idioma];
  return (
    <html lang={idioma} className={`${manrope.variable} ${plexMono.variable}`}>
      <body>
        <a className="salto" href="#contenido">{T.nav.saltar}</a>
        <BarraSuperior nav={T.nav} />
        <div id="contenido" tabIndex={-1}>{children}</div>
        <PasoSiguiente siguiente={T.siguiente} />
        <div className="controles">
          <SelectorIdioma actual={idioma} etiqueta={T.idioma.etiqueta} />
          <BotonTema claroTexto={T.tema.claro} oscuroTexto={T.tema.oscuro} />
        </div>
        <SpeedInsights />
      </body>
    </html>
  );
}
