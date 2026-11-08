import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registrarOperacion } from "../src/lib/datos/historial";
import { sellarLote } from "../src/lib/aplicacion/lote";
import { pdfDeComprobante, urlExplorador } from "../src/lib/documentos/pdf";

const doc = { remito: "R-9", producto: "Aceite 900 ml", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: "ab".repeat(32) };

describe("constancia en PDF", () => {
  it("genera un PDF válido con el enlace a la transacción", async () => {
    const r = await sellarLote([doc], async () => ({ txHash: "c".repeat(64), ledger: 123 }));
    const c = r.comprobantes[0];
    const pdf = await pdfDeComprobante(c);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
    expect(urlExplorador(c)).toContain(`/testnet/tx/${"c".repeat(64)}`);
  });
  it("es reproducible: el mismo comprobante da los mismos bytes", async () => {
    const r = await sellarLote([doc], async () => ({ txHash: "d".repeat(64), ledger: 1 }));
    const [a, b] = [await pdfDeComprobante(r.comprobantes[0]), await pdfDeComprobante(r.comprobantes[0])];
    expect(a.equals(b)).toBe(true);
  });
});

describe("ruta /api/constancia", () => {
  const pedido = (cuerpo: unknown) => new Request("http://localhost/api/constancia", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" }, body: JSON.stringify(cuerpo) });
  it("entrega el PDF solo de lo que este servidor selló; rechaza adulterados y armados a mano", async () => {
    process.env.GALCOA_DATOS = mkdtempSync(join(tmpdir(), "galcoa-pdf-"));
    const { POST } = await import("../src/app/api/constancia/route");
    const r = await sellarLote([doc], async () => ({ txHash: "e".repeat(64), ledger: 5 }));
    const c = r.comprobantes[0];
    // sin registro en el servidor: no hay constancia
    expect((await POST(pedido(c))).status).toBe(403);
    await registrarOperacion({ txHash: c.txHash, ledger: 5, memo: r.sellado!.memo, cantidadHojas: 1, firmadoPor: "G1", modo: "2de2", archivo: { comprobantes: r.comprobantes } });
    const bueno = await POST(pedido(c));
    expect(bueno.status).toBe(200);
    expect(bueno.headers.get("content-type")).toBe("application/pdf");
    // adulterado
    const malo = structuredClone(c) as typeof c;
    (malo.manifiesto.documento as { cantidadRecibida: number }).cantidadRecibida = 99;
    expect((await POST(pedido(malo))).status).toBe(422);
    // armado a mano: coherente por dentro (un solo documento) pero que el servidor nunca selló
    const falso = structuredClone(c) as typeof c;
    falso.txHash = "f".repeat(64);
    expect((await POST(pedido(falso))).status).toBe(403);
    // txHash con basura (iría al encabezado de la respuesta)
    const sucio = structuredClone(c) as typeof c;
    sucio.txHash = 'x"; filename="a';
    expect((await POST(pedido(sucio))).status).toBe(400);
  });
});
