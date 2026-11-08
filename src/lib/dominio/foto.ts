import type { Regla } from "./rules";

/**
 * ALC-FOT-01: revisión determinista de los metadatos (EXIF) de una foto de evidencia.
 * No usa IA y no prueba que la foto sea auténtica: los metadatos se pueden borrar o falsificar.
 * Sirve para detectar lo torpe: foto sin fecha, de otro día, o pasada por un programa de edición.
 */
export const REGLA_FOTO = "ALC-FOT-01";

export type MetadatosFoto = { fechaFoto?: string; software?: string; marcasIA?: string[] };

/** Marcas que los generadores y editores con IA dejan en el archivo (IPTC "DigitalSourceType", Content Credentials, nombres de herramientas). */
const MARCAS_IA: [RegExp, string][] = [
  [/compositeWithTrainedAlgorithmicMedia/i, "IPTC: imagen compuesta con medios generados por IA"],
  [/trainedAlgorithmicMedia/i, "IPTC: imagen generada por IA"],
  [/algorithmicallyEnhanced/i, "IPTC: mejorada con algoritmos"],
  [/c2pa|contentcredentials|content credentials/i, "Trae Content Credentials (C2PA): hay que mirar su historial de ediciones"],
  [/midjourney|dall-?e|stable diffusion|firefly|generative fill|imagen 3|gemini/i, "Nombra una herramienta de generación o edición con IA"],
];

/** Busca esas marcas en cualquier formato (JPEG, PNG, WebP): es texto plano dentro del archivo. */
export function buscarMarcasIA(bytes: Uint8Array): string[] {
  let t = "";
  for (let i = 0; i < Math.min(bytes.length, 2_000_000); i++) t += String.fromCharCode(bytes[i]);
  const vistas = new Set<string>();
  for (const [re, texto] of MARCAS_IA) if (re.test(t)) vistas.add(texto);
  // "compuesta" incluye a "generada": no repetir el mensaje más débil
  if (vistas.has("IPTC: imagen compuesta con medios generados por IA")) vistas.delete("IPTC: imagen generada por IA");
  return [...vistas];
}

/** Metadatos de cualquier archivo de imagen: EXIF si es JPEG, más las marcas de IA. */
export function leerMetadatos(bytes: Uint8Array): MetadatosFoto {
  const base = leerMetadatosJpeg(bytes);
  const marcas = buscarMarcasIA(bytes);
  return marcas.length ? { ...base, marcasIA: marcas } : base;
}

const EDITORES = /photoshop|gimp|lightroom|canva|snapseed|picsart|pixlr|midjourney|dall-?e|stable diffusion|firefly|generative/i;

const u16 = (b: Uint8Array, o: number, le: boolean) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
const u32 = (b: Uint8Array, o: number, le: boolean) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
const ascii = (b: Uint8Array, o: number, n: number) => { let s = ""; for (let i = 0; i < n && o + i < b.length && b[o + i] !== 0; i++) s += String.fromCharCode(b[o + i]); return s; };

/** Lee fecha de toma y programa de un JPEG. Devuelve {} si no hay EXIF o está dañado (nunca lanza). */
export function leerMetadatosJpeg(bytes: Uint8Array): MetadatosFoto {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return {};
    let p = 2;
    while (p + 4 < bytes.length && bytes[p] === 0xff) {
      const marca = bytes[p + 1];
      const largo = (bytes[p + 2] << 8) | bytes[p + 3];
      if (marca === 0xe1 && ascii(bytes, p + 4, 4) === "Exif") return leerTiff(bytes, p + 10);
      if (marca === 0xda) break;
      p += 2 + largo;
    }
  } catch { /* EXIF dañado: se trata como sin metadatos */ }
  return {};
}

function leerTiff(b: Uint8Array, t: number): MetadatosFoto {
  const le = b[t] === 0x49;
  const salida: MetadatosFoto = {};
  const leerIfd = (off: number, alVer: (tag: number, tipo: number, n: number, valor: number) => void) => {
    const base = t + off;
    const n = u16(b, base, le);
    for (let i = 0; i < Math.min(n, 200); i++) {
      const e = base + 2 + i * 12;
      alVer(u16(b, e, le), u16(b, e + 2, le), u32(b, e + 4, le), u32(b, e + 8, le));
    }
  };
  let exifIfd = 0;
  leerIfd(u32(b, t + 4, le), (tag, tipo, n, v) => {
    if (tag === 0x0131 && tipo === 2 && n > 4) salida.software = ascii(b, t + v, Math.min(n, 100));
    if (tag === 0x8769) exifIfd = v;
  });
  if (exifIfd) {
    leerIfd(exifIfd, (tag, tipo, n, v) => {
      if ((tag === 0x9003 || tag === 0x9004) && tipo === 2 && n >= 19 && !salida.fechaFoto) {
        const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(ascii(b, t + v, 19));
        if (m && m[1] !== "0000") salida.fechaFoto = `${m[1]}-${m[2]}-${m[3]}`;
      }
    });
  }
  return salida;
}

const dia = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86_400_000;

/** Reglas de la foto frente a las fechas de la entrega (AAAA-MM-DD). */
/**
 * `cifrasDiscrepantes`: lo informará el paso de lectura de la imagen (modelo de visión) cuando las cifras de la foto
 * no coincidan con lo declarado. Con marca de IA y cifras que no coinciden, la foto queda en rojo.
 */
export function evaluarFoto(meta: MetadatosFoto, fechaEntrega: string, fechaRegistro: string, cifrasDiscrepantes = false): Regla[] {
  const reglas: Regla[] = [];
  const r = (ok: boolean, gravedad: Regla["gravedad"], detalle: string) => reglas.push({ id: REGLA_FOTO, atributo: "Original", ok, gravedad, detalle });
  if (!meta.fechaFoto) r(false, "advertencia", "La foto no trae fecha de toma: no se puede comparar con la entrega (declarado)");
  else {
    const d = dia(meta.fechaFoto);
    const antes = d < dia(fechaEntrega) - 1;
    const despues = d > dia(fechaRegistro);
    if (antes) r(false, "critica", `La foto es de ${meta.fechaFoto}, más de un día antes de la entrega: requiere revisión`);
    else if (despues) r(false, "critica", `La foto es de ${meta.fechaFoto}, posterior al registro: requiere revisión`);
    else r(true, "advertencia", "La fecha de la foto es compatible con la entrega");
  }
  if (meta.software && EDITORES.test(meta.software)) r(false, "advertencia", `La foto pasó por un programa de edición (${meta.software}): requiere revisión`);
  if (meta.marcasIA?.length) {
    if (cifrasDiscrepantes) r(false, "critica", `La foto tiene marcas de IA (${meta.marcasIA.join("; ")}) y sus cifras no coinciden con lo declarado: requiere revisión`);
    else r(false, "advertencia", `La foto tiene marcas de IA (${meta.marcasIA.join("; ")}): requiere revisión`);
  }
  return reglas;
}
