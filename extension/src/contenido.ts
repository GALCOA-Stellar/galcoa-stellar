// Content script (esqueleto): busca formularios con campos de una entrega y marca cada campo con su estado.
// Todo ocurre dentro de la página: no hace pedidos de red, no guarda nada y no envía el contenido a ningún lado.
import { CAMPOS, evaluarFormulario, type EstadoCampo } from "./estado-campos";

const COLOR: Record<EstadoCampo, string> = { verde: "#1a7f37", amarillo: "#b08800", rojo: "#cf222e" };
const MINIMO_DE_CAMPOS = 3; // evita marcar formularios ajenos que solo comparten un nombre

type Campo = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function camposDe(form: HTMLFormElement): Record<string, Campo> {
  const out: Record<string, Campo> = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
    if ((CAMPOS as readonly string[]).includes(el.name)) out[el.name] = el;
  }
  return out;
}

export function marcarFormulario(form: HTMLFormElement): void {
  const campos = camposDe(form);
  if (Object.keys(campos).length < MINIMO_DE_CAMPOS) return;
  const valores = Object.fromEntries(Object.entries(campos).map(([k, el]) => [k, el.value]));
  const { campos: estados } = evaluarFormulario(valores);
  for (const [nombre, el] of Object.entries(campos)) {
    const r = estados[nombre];
    if (!r) continue;
    el.style.outline = `2px solid ${COLOR[r.estado]}`;
    el.dataset.galcoaEstado = r.estado;
    el.title = r.motivos.length > 0 ? `GALCOA+ (${r.estado}): ${r.motivos.join(" · ")}` : "GALCOA+ (verde): las reglas no encontraron problemas en este campo";
  }
}

function iniciar(): void {
  for (const form of Array.from(document.forms)) {
    marcarFormulario(form);
    form.addEventListener("input", () => marcarFormulario(form));
    form.addEventListener("change", () => marcarFormulario(form));
  }
}

if (typeof document !== "undefined") iniciar();
