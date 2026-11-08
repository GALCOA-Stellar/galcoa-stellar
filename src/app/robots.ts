import type { MetadataRoute } from "next";

const SITIO = "https://galcoa-stellar.vercel.app";

/** Las páginas informativas se pueden indexar; las rutas de la API y las páginas con datos de cada persona, no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/historial", "/invitacion/", "/confirmar/"] }],
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
