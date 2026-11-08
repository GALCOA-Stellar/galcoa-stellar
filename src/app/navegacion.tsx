"use client";

import { usePathname } from "next/navigation";

// Menú común y "Siguiente paso" para todo el recorrido: cargar → dejar la prueba → verificar → custodia → guía.
const ENLACES = [
  { href: "/", texto: "Inicio" },
  { href: "/rondas", texto: "Confirmar un remito" },
  { href: "/agentes", texto: "Cargar con palabras" },
  { href: "/demo", texto: "Dejar la prueba" },
  { href: "/verificar", texto: "Verificar" },
  { href: "/spec", texto: "Guía" },
];
const SIGUIENTE: Record<string, { href: string; texto: string }> = {
  "/agentes": { href: "/demo", texto: "Siguiente: dejar la prueba en Stellar" },
  "/demo": { href: "/verificar", texto: "Siguiente: verificar el comprobante" },
  "/verificar": { href: "/custodia", texto: "Siguiente: ver cómo se usa para un pago de prueba" },
  "/custodia": { href: "/spec", texto: "Siguiente: la guía para verificarlo vos mismo" },
};
const activa = (ruta: string, href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(href + "/"));

export function BarraSuperior() {
  const ruta = usePathname() ?? "/";
  if (ruta === "/") return null; // la portada tiene su propio encabezado
  return (
    <nav className="barra-nav" aria-label="Menú principal">
      {ENLACES.map((e) => (
        <a key={e.href} href={e.href} aria-current={activa(ruta, e.href) ? "page" : undefined}>{e.texto}</a>
      ))}
    </nav>
  );
}

export function PasoSiguiente() {
  const ruta = usePathname() ?? "/";
  const s = SIGUIENTE[ruta];
  if (!s) return null;
  return (
    <div className="paso-siguiente">
      <a className="boton" href={s.href}>{s.texto} →</a>
    </div>
  );
}
