"use client";

import { usePathname } from "next/navigation";

// Menú común y "Siguiente paso" para todo el recorrido: cargar → dejar la prueba → verificar → custodia → guía.
import type { Textos } from "@/lib/i18n/textos";

const RUTAS = [
  { href: "/", clave: "inicio" },
  { href: "/rondas", clave: "remito" },
  { href: "/agentes", clave: "palabras" },
  { href: "/demo", clave: "prueba" },
  { href: "/verificar", clave: "verificar" },
  { href: "/spec", clave: "guia" },
] as const;
const SIGUIENTE: Record<string, string> = {
  "/agentes": "/demo",
  "/demo": "/verificar",
  "/verificar": "/custodia",
  "/custodia": "/spec",
};
const activa = (ruta: string, href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`));

export function BarraSuperior({ nav }: { nav: Textos["nav"] }) {
  const ruta = usePathname() ?? "/";
  if (ruta === "/") return null; // la portada tiene su propio encabezado
  return (
    <nav className="barra-nav" aria-label={nav.menu}>
      {RUTAS.map((e) => (
        <a key={e.href} href={e.href} aria-current={activa(ruta, e.href) ? "page" : undefined}>{nav[e.clave]}</a>
      ))}
    </nav>
  );
}

export function PasoSiguiente({ siguiente }: { siguiente: Textos["siguiente"] }) {
  const ruta = usePathname() ?? "/";
  const destino = SIGUIENTE[ruta];
  if (!destino) return null;
  return (
    <div className="paso-siguiente">
      <a className="boton" href={destino}>{siguiente[ruta]} →</a>
    </div>
  );
}
