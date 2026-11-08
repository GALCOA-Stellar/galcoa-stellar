import type { MetadataRoute } from "next";

const SITIO = "https://galcoa-stellar.vercel.app";
const RUTAS = ["/", "/desarrolladores", "/agentes", "/evidencia", "/demo", "/verificar", "/custodia", "/rondas", "/spec", "/privacidad", "/terminos"];

export default function sitemap(): MetadataRoute.Sitemap {
  return RUTAS.map((ruta) => ({ url: SITIO + ruta, changeFrequency: "weekly", priority: ruta === "/" ? 1 : 0.6 }));
}
