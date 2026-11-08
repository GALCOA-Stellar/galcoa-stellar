import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GALCOA+ en Stellar",
    short_name: "GALCOA+",
    description: "Verificación de datos con fuente antes de anclarlos en Stellar (Testnet).",
    start_url: "/",
    display: "standalone",
    background_color: "#0c1a2e",
    theme_color: "#0c1a2e",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
