import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guardar, leer } from "../src/lib/datos/almacen";
import { limpiarVencidos } from "../src/lib/datos/privacidad";
import {
  claveDeToken, crearRonda, leerInvitacion, reemitirInvitacion, responderInvitacion, resumenDe, revocarInvitacion,
  tokenBienFormado, VIGENCIA_RONDA_MS, type Ronda,
} from "../src/lib/datos/ronda";

const doc = { remito: "R-9", producto: "Yerba 1 kg", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: "ab".repeat(32) };
const DOS = ["proveedor", "comprador"];
const TRES = ["proveedor", "comprador", "transportista"];
let carpeta = "";
beforeAll(() => { carpeta = mkdtempSync(join(tmpdir(), "galcoa-ronda-")); process.env.GALCOA_DATOS = carpeta; });

describe("crear la ronda", () => {
  it("exige proveedor y comprador, y rechaza participantes raros o repetidos", async () => {
    await expect(crearRonda(doc, ["proveedor"])).rejects.toThrow("al menos el proveedor y el comprador");
    await expect(crearRonda(doc, ["comprador", "transportista"])).rejects.toThrow("al menos el proveedor y el comprador");
    await expect(crearRonda(doc, ["proveedor", "comprador", "alguien"])).rejects.toThrow("no son válidos");
    await expect(crearRonda(doc, ["proveedor", "proveedor", "comprador"])).rejects.toThrow("no son válidos");
    await expect(crearRonda(doc, "proveedor")).rejects.toThrow("Elegí quiénes");
  });
  it("no crea rondas para datos inválidos", async () => {
    await expect(crearRonda({ remito: "x" }, DOS)).rejects.toThrow("no son válidos");
  });
  it("da un enlace de 43 caracteres por participante y no guarda ninguno en claro", async () => {
    const { ronda, tokens } = await crearRonda(doc, TRES);
    expect(Object.keys(tokens).sort()).toEqual([...TRES].sort());
    for (const t of Object.values(tokens)) expect(tokenBienFormado(t)).toBe(true);
    const todo = ["rondas", "invitaciones"].flatMap((c) => readdirSync(join(carpeta, c)).filter((n) => n.endsWith(".json")).map((n) => readFileSync(join(carpeta, c, n), "utf8"))).join("\n");
    for (const t of Object.values(tokens)) expect(todo).not.toContain(t as string);
    expect(ronda.invitaciones).toHaveLength(3);
  });
});

describe("lo que ve cada participante", () => {
  it("solo ve los datos públicos de la entrega, nunca los internos", async () => {
    const { tokens } = await crearRonda(doc, DOS);
    const v = await leerInvitacion(tokens.proveedor);
    expect(v?.documento).toMatchObject({ remito: "R-9", producto: "Yerba 1 kg" });
    const texto = JSON.stringify(v);
    expect(texto).not.toContain("operador-01");
    expect(texto).not.toContain("ab".repeat(32));
  });
  it("leer nunca consume el enlace, ni leyéndolo muchas veces", async () => {
    const { tokens } = await crearRonda(doc, DOS);
    for (let i = 0; i < 3; i++) expect((await leerInvitacion(tokens.comprador))?.estado).toBe("pendiente");
    expect((await responderInvitacion(tokens.comprador, "confirmada", "Ana Gómez", "")).estado).toBe("confirmada");
  });
  it("un enlace mal formado, inexistente o anulado da exactamente la misma respuesta", async () => {
    expect(await leerInvitacion("corto")).toBeNull();
    expect(await leerInvitacion(undefined)).toBeNull();
    expect(await leerInvitacion("A".repeat(43))).toBeNull();
    const { ronda, tokens } = await crearRonda(doc, DOS);
    await revocarInvitacion(ronda.id, "proveedor");
    expect(await leerInvitacion(tokens.proveedor)).toBeNull();
    await expect(responderInvitacion(tokens.proveedor, "confirmada", "Ana Gómez", "")).rejects.toThrow("no existe");
  });
});

describe("responder", () => {
  it("pide el nombre, una respuesta válida, y se usa una sola vez", async () => {
    const { tokens } = await crearRonda(doc, DOS);
    await expect(responderInvitacion(tokens.proveedor, "confirmada", "", "")).rejects.toThrow("Escribí tu nombre");
    await expect(responderInvitacion(tokens.proveedor, "confirmada", "A", "")).rejects.toThrow("Escribí tu nombre");
    await expect(responderInvitacion(tokens.proveedor, "quizás", "Ana Gómez", "")).rejects.toThrow("Respuesta no válida");
    expect((await responderInvitacion(tokens.proveedor, "confirmada", "Ana Gómez", " todo bien ")).estado).toBe("confirmada");
    await expect(responderInvitacion(tokens.proveedor, "no_coincide", "Ana Gómez", "")).rejects.toThrow("ya se usó");
  });
  it("si dos respuestas al mismo enlace llegan a la vez, solo una gana", async () => {
    const { tokens } = await crearRonda(doc, DOS);
    const r = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => responderInvitacion(tokens.proveedor, i % 2 ? "confirmada" : "no_coincide", "Ana Gómez", "")));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });
  it("dos participantes que responden a la vez no se pisan: las dos respuestas quedan", async () => {
    const { ronda, tokens } = await crearRonda(doc, TRES);
    await Promise.all([
      responderInvitacion(tokens.proveedor, "confirmada", "Ana Gómez", ""),
      responderInvitacion(tokens.comprador, "confirmada", "Luis Pérez", ""),
      responderInvitacion(tokens.transportista, "confirmada", "Marta Díaz", ""),
    ]);
    const r = await resumenDe(ronda.id);
    expect(r?.confirmaron).toBe(3);
    expect(r?.estado).toBe("completa");
  });
  it("rechaza enlaces vencidos", async () => {
    const { tokens } = await crearRonda(doc, DOS);
    await expect(responderInvitacion(tokens.proveedor, "confirmada", "Ana Gómez", "", Date.now() + VIGENCIA_RONDA_MS + 1000)).rejects.toThrow("venció");
  });
  it("si alguien altera los datos guardados de la ronda, no se acepta ninguna respuesta", async () => {
    const { ronda, tokens } = await crearRonda(doc, DOS);
    const guardada = (await leer<Ronda>("rondas", ronda.id)) as Ronda;
    await guardar("rondas", ronda.id, { ...guardada, documento: { ...guardada.documento, cantidadRecibida: 99 } });
    await expect(responderInvitacion(tokens.proveedor, "confirmada", "Ana Gómez", "")).rejects.toThrow("cambiaron");
  });
});

describe("estado de la ronda", () => {
  it("está completa solo cuando todos confirmaron el mismo documento", async () => {
    const { ronda, tokens } = await crearRonda(doc, DOS);
    expect((await resumenDe(ronda.id))?.estado).toBe("pendiente");
    await responderInvitacion(tokens.proveedor, "confirmada", "Ana Gómez", "");
    const medio = await resumenDe(ronda.id);
    expect(medio).toMatchObject({ estado: "pendiente", confirmaron: 1, requeridos: 2, completa: false, faltan: ["comprador"] });
    await responderInvitacion(tokens.comprador, "confirmada", "Luis Pérez", "");
    expect(await resumenDe(ronda.id)).toMatchObject({ estado: "completa", completa: true, faltan: [] });
  });
  it("un solo rechazo la deja rechazada, aunque los demás confirmen", async () => {
    const { ronda, tokens } = await crearRonda(doc, TRES);
    await responderInvitacion(tokens.proveedor, "confirmada", "Ana Gómez", "");
    await responderInvitacion(tokens.comprador, "no_coincide", "Luis Pérez", "faltaron cajas");
    await responderInvitacion(tokens.transportista, "confirmada", "Marta Díaz", "");
    expect(await resumenDe(ronda.id)).toMatchObject({ estado: "rechazada", completa: false, rechazaron: 1 });
  });
  it("se marca vencida si pasó el plazo sin completarse", async () => {
    const { ronda } = await crearRonda(doc, DOS);
    expect((await resumenDe(ronda.id, Date.now() + VIGENCIA_RONDA_MS + 1000))?.estado).toBe("vencida");
  });
  it("una ronda inexistente no devuelve nada", async () => {
    expect(await resumenDe("0".repeat(32))).toBeNull();
  });
});

describe("anular y reemitir enlaces", () => {
  it("se puede anular un enlace que no respondió, pero no uno que ya respondió", async () => {
    const { ronda, tokens } = await crearRonda(doc, DOS);
    await responderInvitacion(tokens.proveedor, "confirmada", "Ana Gómez", "");
    await expect(revocarInvitacion(ronda.id, "proveedor")).rejects.toThrow("ya respondió");
    await revocarInvitacion(ronda.id, "comprador");
    expect((await resumenDe(ronda.id))?.detalle.find((d) => d.rol === "comprador")?.sinEnlace).toBe(true);
  });
  it("al reemitir, el enlace viejo deja de servir y el nuevo funciona", async () => {
    const { ronda, tokens } = await crearRonda(doc, DOS);
    const nuevo = await reemitirInvitacion(ronda.id, "comprador");
    expect(nuevo.token).not.toBe(tokens.comprador);
    expect(await leerInvitacion(tokens.comprador)).toBeNull();
    expect((await leerInvitacion(nuevo.token))?.rol).toBe("comprador");
    await responderInvitacion(nuevo.token, "confirmada", "Luis Pérez", "");
    await expect(reemitirInvitacion(ronda.id, "comprador")).rejects.toThrow("ya respondió");
  });
  it("la clave de búsqueda sale del hash, no del enlace", async () => {
    const { tokens } = await crearRonda(doc, DOS);
    expect(claveDeToken(tokens.proveedor as string)).toMatch(/^[0-9a-f]{32}$/);
    expect(tokens.proveedor).not.toContain(claveDeToken(tokens.proveedor as string));
  });
});

describe("privacidad", () => {
  it("las rondas y sus invitaciones se borran 30 días después de vencer, no antes", async () => {
    const { ronda } = await crearRonda(doc, DOS);
    const vence = Date.parse(ronda.vence);
    const DIA = 86_400_000;
    expect((await limpiarVencidos(vence + 29 * DIA)).rondas).toBe(0);
    expect(await resumenDe(ronda.id)).not.toBeNull();
    expect((await limpiarVencidos(vence + 31 * DIA)).rondas).toBeGreaterThanOrEqual(1);
    expect(await resumenDe(ronda.id)).toBeNull();
    expect(await leer("invitaciones", ronda.invitaciones[0])).toBeNull();
  });
});
