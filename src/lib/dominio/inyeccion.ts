/**
 * ALC-INY-01: detector, en código, de mensajes que intentan darle órdenes a los agentes de IA.
 * No depende de ningún modelo: si el texto de una persona parece una instrucción dirigida a la IA
 * (ignorar reglas, no reportar nada, aprobar sin controlar, hacerse pasar por el sistema), la entrega se retiene.
 * Es una red de seguridad que se suma a los agentes, no los reemplaza. Puede tener falsos positivos: preferimos frenar y que una persona mire.
 * Cada patrón tiene un nombre para que el motivo sea claro en pantalla.
 */
export const REGLA_INYECCION = "ALC-INY-01";

const PATRONES: { motivo: string; re: RegExp }[] = [
  { motivo: "pide ignorar reglas o instrucciones", re: /\b(ignor[aáe]\w*|ignore|olvid[aá]\w*|disregard).{0,40}\b(reglas|instrucciones|anteriores?|previous|prior|rules|instructions|que te dijeron)/i },
  { motivo: "pide no reportar o no frenar nada", re: /\bno\s+(report[eé]s?|frenes|marqu[eé]s|avises)(?![a-z])|\bsalt[aá]\w*\s+el\s+control|\bsin\s+(comparar|controlar)(?![a-z])/i },
  { motivo: "pide dejar vacía la lista de hallazgos", re: /\bhallazgos?\b.{0,30}\b(vac[ií]a|vac[ií]o|sin hallazgos)|\bsin\s+hallazgos|"hallazgos"\s*:\s*\[\s*\]/i },
  { motivo: "se presenta como el sistema o un administrador", re: /(^|\n)\s*(#+\s*)?sistema\s*:?\s*($|\n|sos|aprob|a partir)|\b(sos|soy|eres|you are)\s+(el\s+)?(administrador|admin)\b|\bmensaje\s+(interno|del\s+sistema)\b|\bnota\s+para\s+el\s+(verificador|agente|registrador)/i },
  { motivo: "pide aprobar o marcar todo como correcto", re: /\b(aprob[aá]s?\w*|autorizo|marc[aá]\w*|confirm[aá]\w*|respond[eé]\w*).{0,50}\b(todo\s+(est[aá]\s+)?(fiel|verde|verificado|perfecto|correcto)|todo\s+sin\s+control|como\s+(verde|fiel)|verde\s+sin)/i },
  { motivo: "pide responder con un texto fijo", re: /\brespond[eé]\w*\s+(solo|con\s+este|únicamente)|\brespond\s+only\b/i },
  { motivo: "intenta cerrar o abrir marcas de texto del sistema", re: /<<<\s*(FIN|FUENTE)\b/i },
  { motivo: "anuncia nuevas instrucciones", re: /\b(nueva\s+tarea|nuevas?\s+instrucciones|a\s+partir\s+de\s+ahora)\b/i },
  { motivo: "afirma que ya fue auditado para saltar el control", re: /\bya\s+(fue|est[aá])\s+(auditad|verificad|aprobad)\w*.{0,40}\b(salt|no\s+(frenes|control))/i },
];

// Patrones agregados tras la auditoría externa del 07/11/2026. No son la defensa principal: la principal es el chequeo cruzado de abajo.
PATRONES.push(
  { motivo: "se dirige al modelo con una instrucción", re: /\binstrucci[oó]n\s+para\s+(el\s+)?(modelo|ia|agente)|\bnuevo\s+rol\b|\bdisregard\s+your\b|\bmark\s+this\b.{0,40}\b(faithful|correct|green)/i },
  { motivo: "dice que no hace falta controlar", re: /\bno\s+(hace\s+falta|es\s+necesario|necesit[aá]s)\s+(que\s+)?(controles|verifiques|revises|compares)|\bya\s+revis[oó]\s+todo/i },
  { motivo: "pide poner en verde directamente", re: /\b(pon\w*|dej[aá]\w*|marc[aá]\w*)\b.{0,30}\ben\s+verde\b/i },
);

/** Quita los trucos de escritura más comunes (ign0rá, r3glas) antes de buscar patrones. */
const sinTrucos = (t: string) => t.replace(/(?<=[a-zA-Záéíóú])[0143](?=[a-zA-Záéíóú])/g, (d) => ({ "0": "o", "1": "i", "3": "e", "4": "a" })[d] ?? d);

/** Devuelve los motivos por los que el texto parece una orden para la IA. Lista vacía si no hay señales. */
export function detectarInyeccion(texto: string): string[] {
  const t = texto.normalize("NFC");
  const limpio = sinTrucos(t);
  return PATRONES.filter((p) => p.re.test(t) || p.re.test(limpio)).map((p) => p.motivo);
}

const PALABRAS: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, docena: 12, media: 6 };

/** Todas las cantidades que aparecen en un texto, en cifras ("1.200", "8") o en palabras ("ocho", "docena"). */
export function numerosEn(texto: string): Set<number> {
  const t = texto.normalize("NFC").toLowerCase();
  const presentes = new Set<number>();
  for (const m of t.matchAll(/\d[\d.,]*/g)) {
    const limpio = m[0].replace(/[.,]$/, "");
    for (const n of [Number(limpio.replace(/[.,]/g, "")), Number(limpio.replace(",", "."))]) if (Number.isFinite(n)) presentes.add(n);
  }
  for (const m of t.matchAll(/[a-záéíóúñ]+/g)) if (m[0] in PALABRAS) presentes.add(PALABRAS[m[0]]);
  return presentes;
}

/**
 * Chequeo cruzado en código (no depende de ningún modelo): cada cantidad que propone el registrador tiene que aparecer en el mensaje,
 * con cifras o con palabras. Si no aparece, el modelo la inventó o la calculó: la entrega se retiene para que una persona la mire.
 * Devuelve la posición de cada entrega con una cantidad sin respaldo.
 */
export function cantidadesSinRespaldo(mensaje: string, propuestas: { cantidadPedida?: number; cantidadRecibida?: number }[]): { indice: number; campo: string; valor: number }[] {
  const presentes = numerosEn(mensaje);
  const faltan: { indice: number; campo: string; valor: number }[] = [];
  propuestas.forEach((p, indice) => {
    for (const campo of ["cantidadPedida", "cantidadRecibida"] as const) {
      const v = p[campo];
      if (v !== undefined && !presentes.has(v)) faltan.push({ indice, campo, valor: v });
    }
  });
  return faltan;
}
