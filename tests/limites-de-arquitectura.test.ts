import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas que vigilan qué carpeta puede importar a cuál. Si alguien rompe un límite, falla acá. */
const archivos = (d: string): string[] => readdirSync(d).flatMap((n) => { const r = join(d, n); return statSync(r).isDirectory() ? archivos(r) : /\.(ts|tsx)$/.test(n) ? [r] : []; });
const importes = (f: string) => [...readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
// Solo cuentan los imports que existen al correr: los "import type" desaparecen al compilar y no acoplan capas.
const importesReales = (f: string) => [...readFileSync(f, "utf8").replace(/^\s*import type .*$/gm, "").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
const sinBarras = (f: string) => f.replace(/\\/g, "/");

describe("límites de arquitectura", () => {
  it("las reglas (rules.ts) son puras: no importan red, base, agentes ni nada del servidor", () => {
    const malos = importes("src/lib/dominio/rules.ts").filter((i) => !i.startsWith("./") || /stellar|almacen|agentes|ronda|confirmacion|datos|servidor|node:/.test(i));
    expect(malos).toEqual([]);
  });
  it("la lógica (src/lib) nunca importa pantallas ni rutas (src/app)", () => {
    const malos = archivos("src/lib").flatMap((f) => importes(f).filter((i) => /(^|\/)app(\/|$)/.test(i) || i.startsWith("@/app")).map((i) => `${sinBarras(f)} -> ${i}`));
    expect(malos).toEqual([]);
  });
  it("los agentes de IA no tocan la red Stellar ni el almacén: solo proponen, controlan y usan las reglas", () => {
    const malos = archivos("src/lib/agentes").flatMap((f) => importes(f).filter((i) => /\.\.\/(stellar|datos|servidor|documentos)\//.test(i)).map((i) => `${sinBarras(f)} -> ${i}`));
    expect(malos).toEqual([]);
  });
  it("las pantallas del navegador no importan módulos del servidor (almacén, rondas, sellado, node:)", () => {
    const clientes = archivos("src/app").filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
    expect(clientes.length).toBeGreaterThan(0);
    const malos = clientes.flatMap((f) => importes(f).filter((i) => /^node:|\/lib\/(almacen|almacen-remoto|ronda|confirmacion|privacidad|historial|sellado)$/.test(i)).map((i) => `${sinBarras(f)} -> ${i}`));
    expect(malos).toEqual([]);
  });
  it("ninguna clave ni secreto está escrito en el código fuente", () => {
    const malos = [...archivos("src"), ...archivos("tests")].filter((f) => /\bS[A-Z2-7]{55}\b|-----BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}/.test(readFileSync(f, "utf8")));
    expect(malos.map(sinBarras)).toEqual([]);
  });
});

describe("capas de src/lib", () => {
  // Cada capa solo puede apoyarse en las de esta lista (hacia abajo). Si alguien cruza una raya, falla acá.
  const PERMITIDO: Record<string, string[]> = {
    dominio: [],
    agentes: ["dominio"],
    documentos: ["dominio"],
    servidor: ["datos"],
    stellar: ["dominio", "servidor", "config"],
    datos: ["dominio", "servidor", "stellar"],
    aplicacion: ["dominio", "stellar", "datos", "servidor", "config"],
  };
  for (const [capa, deps] of Object.entries(PERMITIDO)) {
    it(`la capa ${capa} solo depende de: ${deps.join(", ") || "nadie más"}`, () => {
      const malos = archivos(`src/lib/${capa}`).flatMap((f) => importesReales(f)
        .filter((i) => i.startsWith("../"))
        .map((i) => ({ f, destino: i.split("/").filter((p) => p !== "..")[0] }))
        .filter(({ destino }) => destino !== capa && !deps.includes(destino) && /^(dominio|agentes|documentos|servidor|stellar|datos|aplicacion|config)$/.test(destino))
        .map(({ f, destino }) => `${sinBarras(f)} -> ${destino}`));
      expect(malos).toEqual([]);
    });
  }
  it("no quedan archivos sueltos en la raíz de src/lib: todo vive en su capa", () => {
    const sueltos = readdirSync("src/lib").filter((n) => statSync(join("src/lib", n)).isFile());
    expect(sueltos).toEqual([]);
  });
});
