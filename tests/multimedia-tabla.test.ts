import { describe, expect, it } from "vitest";
import { analizarFoto, analizarVoz } from "../src/lib/aplicacion/evidencia";
import type { InformePerito } from "../src/lib/dominio/multimedia";
import { desafioDeVoz } from "../src/lib/dominio/voz";

/**
 * Tabla de casos con veredicto esperado, escrita ANTES de mirar el resultado (como los casos de evaluación de los agentes).
 * Prueba las reglas en código con informes de perito simulados; no mide a ningún modelo.
 */
type Ind = InformePerito["indicios"][number];
const bytes = (t: string) => new TextEncoder().encode(t);
const foto = (indicios: Ind[]): InformePerito => ({ skill: "foto", version: "t", indicios });
const voz = (indicios: Ind[], inteligibilidad?: number): InformePerito => ({ skill: "voz", version: "t", indicios, inteligibilidad });
const E = "2026-11-05";
const R = "2026-11-06";

const casosFoto: { nombre: string; contenido: string; informe: InformePerito | null; esperado: "verde" | "amarillo" | "rojo" }[] = [
  { nombre: "sin metadatos ni indicios: amarillo (no hay fecha para comparar)", contenido: "foto", informe: foto([]), esperado: "amarillo" },
  { nombre: "perito caído: amarillo, nunca verde", contenido: "foto", informe: null, esperado: "amarillo" },
  { nombre: "indicio de edición medio sin cifras: amarillo", contenido: "foto", informe: foto([{ tipo: "foto_edicion", gravedad: "media", detalle: "bordes" }]), esperado: "amarillo" },
  { nombre: "cifra retocada: rojo", contenido: "foto", informe: foto([{ tipo: "foto_edicion", gravedad: "media", detalle: "cantidad", afectaCifras: true }]), esperado: "rojo" },
  { nombre: "precio retocado con indicio alto: rojo", contenido: "foto", informe: foto([{ tipo: "foto_edicion", gravedad: "alta", detalle: "precio", afectaCifras: true }]), esperado: "rojo" },
  { nombre: "imagen generada con IA, indicio alto: rojo", contenido: "foto", informe: foto([{ tipo: "foto_generada", gravedad: "alta", detalle: "generada" }]), esperado: "rojo" },
  { nombre: "marca IPTC de IA sin que el perito vea cifras: amarillo", contenido: "xx trainedAlgorithmicMedia xx", informe: foto([]), esperado: "amarillo" },
  { nombre: "marca de IA y cifras tocadas: rojo", contenido: "compositeWithTrainedAlgorithmicMedia", informe: foto([{ tipo: "foto_edicion", gravedad: "media", detalle: "cantidad", afectaCifras: true }]), esperado: "rojo" },
  { nombre: "orden escondida en la imagen: rojo", contenido: "foto", informe: foto([{ tipo: "foto_orden_en_imagen", gravedad: "alta", detalle: "pide aprobar" }]), esperado: "rojo" },
  { nombre: "indicio bajo y nada más: amarillo por falta de fecha, no rojo", contenido: "foto", informe: foto([{ tipo: "foto_ilegible", gravedad: "baja", detalle: "algo borrosa" }]), esperado: "amarillo" },
];

const d = desafioDeVoz(new Uint8Array([0, 5, 14, 4, 0, 7]));
const ok = { cuentaAutorizada: true, firmaValida: true };
const casosVoz: { nombre: string; informe: InformePerito | null; transcripcion: string; recibido: number; atribucion: { cuentaAutorizada: boolean; firmaValida: boolean }; esperado: "verde" | "amarillo" | "rojo" }[] = [
  { nombre: "todo en orden: verde", informe: voz([], 0.95), transcripcion: "almendra faro olivo cuatro cero siete", recibido: 1000, atribucion: ok, esperado: "verde" },
  { nombre: "sin firma de cuenta autorizada: rojo", informe: voz([], 0.95), transcripcion: "almendra faro olivo 4 0 7", recibido: 1000, atribucion: { cuentaAutorizada: true, firmaValida: false }, esperado: "rojo" },
  { nombre: "firma de cuenta no autorizada: rojo", informe: voz([], 0.95), transcripcion: "almendra faro olivo 4 0 7", recibido: 1000, atribucion: { cuentaAutorizada: false, firmaValida: true }, esperado: "rojo" },
  { nombre: "audio viejo (fuera de los 5 minutos): rojo", informe: voz([], 0.95), transcripcion: "almendra faro olivo 4 0 7", recibido: 6 * 60_000, atribucion: ok, esperado: "rojo" },
  { nombre: "no dice la frase: rojo", informe: voz([], 0.95), transcripcion: "llegaron diez cajas", recibido: 1000, atribucion: ok, esperado: "rojo" },
  { nombre: "voz sintética con indicio alto: rojo", informe: voz([{ tipo: "voz_sintetica", gravedad: "alta", detalle: "robótica" }], 0.9), transcripcion: "almendra faro olivo 4 0 7", recibido: 1000, atribucion: ok, esperado: "rojo" },
  { nombre: "voz sospechosa con indicio medio: amarillo", informe: voz([{ tipo: "voz_sintetica", gravedad: "media", detalle: "monótona" }], 0.9), transcripcion: "almendra faro olivo 4 0 7", recibido: 1000, atribucion: ok, esperado: "amarillo" },
  { nombre: "mensaje que no se entiende: rojo", informe: voz([], 0.3), transcripcion: "almendra faro olivo 4 0 7", recibido: 1000, atribucion: ok, esperado: "rojo" },
  { nombre: "se entiende a medias: amarillo", informe: voz([], 0.7), transcripcion: "almendra faro olivo 4 0 7", recibido: 1000, atribucion: ok, esperado: "amarillo" },
  { nombre: "perito caído: rojo (no se pudo comprobar la frase)", informe: null, transcripcion: "", recibido: 1000, atribucion: ok, esperado: "rojo" },
];

describe("tabla de casos de fotos", () => {
  for (const c of casosFoto) {
    it(c.nombre, () => {
      expect(analizarFoto({ bytes: bytes(c.contenido), informe: c.informe, fechaEntrega: E, fechaRegistro: R }).veredicto).toBe(c.esperado);
    });
  }
});

describe("tabla de casos de audios", () => {
  for (const c of casosVoz) {
    it(c.nombre, () => {
      expect(analizarVoz({ bytes: bytes("audio"), informe: c.informe, transcripcion: c.transcripcion, desafio: d, emitidoMs: 0, recibidoMs: c.recibido, atribucion: c.atribucion }).veredicto).toBe(c.esperado);
    });
  }
});
