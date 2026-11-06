import type { ReactNode } from "react";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// Las páginas se generan en cada pedido para que sus scripts lleven el nonce de la política de contenido (src/proxy.ts).
export const dynamic = "force-dynamic";

// Mismas fuentes que GALCOA+ original, autoalojadas en public/fonts (licencias SIL OFL junto a los archivos).
const manrope = localFont({ src: "../../public/fonts/manrope-variable.woff2", variable: "--font-manrope", display: "swap" });
const plexMono = localFont({ src: "../../public/fonts/ibm-plex-mono-400.woff2", variable: "--font-plex-mono", weight: "400", display: "swap" });

export const metadata = {
  title: "GALCOA+ en Stellar",
  description: "Prototipo: verificación de entregas con reglas deterministas y sellado por lotes en Stellar testnet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
