import { describe, expect, it } from "vitest";
import { evaluarFoto, leerMetadatosJpeg } from "../src/lib/dominio/foto";

/** Arma un JPEG mínimo con EXIF (little endian): software en IFD0 y fecha de toma en el IFD de EXIF. */
function jpeg(opts: { fecha?: string; software?: string }): Uint8Array {
  const enc = (s: string) => [...new TextEncoder().encode(s), 0];
  const sw = opts.software ? enc(opts.software) : [];
  const fe = opts.fecha ? enc(opts.fecha) : [];
  const u16 = (n: number) => [n & 255, n >> 8];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
  const entradasIfd0 = (sw.length ? 1 : 0) + (fe.length ? 1 : 0);
  const ifd0 = 8;
  const largoIfd0 = 2 + entradasIfd0 * 12 + 4;
  const ifdExif = ifd0 + largoIfd0;
  const largoExif = fe.length ? 2 + 12 + 4 : 0;
  const datosSw = ifdExif + largoExif;
  const datosFe = datosSw + sw.length;
  const tiff: number[] = [0x49, 0x49, 0x2a, 0x00, ...u32(ifd0), ...u16(entradasIfd0)];
  if (sw.length) tiff.push(...u16(0x0131), ...u16(2), ...u32(sw.length), ...u32(datosSw));
  if (fe.length) tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(ifdExif));
  tiff.push(...u32(0));
  if (fe.length) tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(fe.length), ...u32(datosFe), ...u32(0));
  tiff.push(...sw, ...fe);
  const cuerpo = [...enc("Exif").slice(0, 4), 0, 0, ...tiff];
  const largo = cuerpo.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, largo >> 8, largo & 255, ...cuerpo, 0xff, 0xd9]);
}

describe("ALC-FOT-01: metadatos de la foto", () => {
  it("lee la fecha de toma y el programa del EXIF", () => {
    expect(leerMetadatosJpeg(jpeg({ fecha: "2026:11:05 10:30:00", software: "Adobe Photoshop 25" }))).toEqual({ fechaFoto: "2026-11-05", software: "Adobe Photoshop 25" });
  });
  it("un archivo sin EXIF o roto no lanza error: da vacío", () => {
    expect(leerMetadatosJpeg(new Uint8Array([1, 2, 3]))).toEqual({});
    expect(leerMetadatosJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 8, 69, 120, 105, 102]))).toEqual({});
  });
  it("foto del día de la entrega: compatible", () => {
    const r = evaluarFoto({ fechaFoto: "2026-11-05" }, "2026-11-05", "2026-11-06");
    expect(r.every((x) => x.ok)).toBe(true);
  });
  it("foto de una semana antes: crítica", () => {
    const r = evaluarFoto({ fechaFoto: "2026-10-28" }, "2026-11-05", "2026-11-06");
    expect(r.some((x) => !x.ok && x.gravedad === "critica")).toBe(true);
  });
  it("foto posterior al registro: crítica", () => {
    expect(evaluarFoto({ fechaFoto: "2026-11-20" }, "2026-11-05", "2026-11-06").some((x) => !x.ok && x.gravedad === "critica")).toBe(true);
  });
  it("sin fecha: advertencia (amarillo), no rojo", () => {
    const r = evaluarFoto({}, "2026-11-05", "2026-11-06");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "ALC-FOT-01", ok: false, gravedad: "advertencia" });
  });
  it("programa de edición o generador de imágenes: advertencia", () => {
    const r = evaluarFoto({ fechaFoto: "2026-11-05", software: "Adobe Photoshop 25" }, "2026-11-05", "2026-11-06");
    expect(r.some((x) => !x.ok && /edición/.test(x.detalle))).toBe(true);
  });
});

import { buscarMarcasIA, leerMetadatos } from "../src/lib/dominio/foto";
const bytes = (t: string) => new TextEncoder().encode(t);

describe("marcas de IA en la imagen", () => {
  it("detecta la marca IPTC de imagen generada y la de compuesta", () => {
    expect(buscarMarcasIA(bytes("xx <Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</...> yy"))).toHaveLength(1);
    expect(buscarMarcasIA(bytes("compositeWithTrainedAlgorithmicMedia"))).toEqual(["IPTC: imagen compuesta con medios generados por IA"]);
  });
  it("una imagen sin marcas da lista vacía", () => {
    expect(buscarMarcasIA(bytes("nada raro acá"))).toEqual([]);
    expect(leerMetadatos(bytes("nada")).marcasIA).toBeUndefined();
  });
  it("marca de IA sola: amarillo; con cifras que no coinciden: rojo", () => {
    const meta = { fechaFoto: "2026-11-05", marcasIA: ["IPTC: imagen generada por IA"] };
    const sola = evaluarFoto(meta, "2026-11-05", "2026-11-06");
    expect(sola.some((x) => !x.ok && x.gravedad === "advertencia")).toBe(true);
    expect(sola.some((x) => !x.ok && x.gravedad === "critica")).toBe(false);
    expect(evaluarFoto(meta, "2026-11-05", "2026-11-06", true).some((x) => !x.ok && x.gravedad === "critica")).toBe(true);
  });
});
