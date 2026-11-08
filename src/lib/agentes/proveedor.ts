// Acceso a los modelos de IA. Sin dependencias nuevas: solo fetch. Los modelos son configurables.
// Regla del proyecto: la IA no decide el veredicto; estos proveedores solo devuelven texto JSON que se valida después.
export type Pedido = {
  sistema: string;
  usuario: string;
  /** Momento (ms) en que se acaba el tiempo para este agente: ningún modelo de la lista arranca ni espera más allá. */
  hasta?: number;
  /** Avisa qué modelo respondió de verdad (para que la evaluación no confunda el principal con un respaldo). */
  alResponder?: (modelo: string) => void;
};
export type Proveedor = (p: Pedido) => Promise<string>;
export type ConfigAgentes = {
  registrador: Proveedor;
  verificador: Proveedor;
  independientes: boolean;
  modelos: { registrador: string; verificador: string };
};

const ESPERA_MS = 25_000;
/** Con menos de esto no vale la pena arrancar otro modelo. */
const MINIMO_MS = 2_000;

export const SIN_TIEMPO = "Se acabó el tiempo para la IA";

/**
 * Prueba cada modelo de la lista (separados por coma) hasta que uno responda: si el primero está saturado o retirado, sigue el siguiente.
 * Cada intento espera como mucho ESPERA_MS y nunca más allá de `hasta`: sin ese tope, tres modelos lentos sumaban 75 s
 * y la ruta (maxDuration 60 s) moría sin explicar nada.
 */
export async function conRespaldo(modelos: string, p: Pedido, prefijo: string, intento: (modelo: string, esperaMs: number) => Promise<string>): Promise<string> {
  let ultimo: unknown = new Error("Sin modelos configurados");
  for (const m of modelos.split(",").map((x) => x.trim()).filter(Boolean)) {
    const restante = p.hasta === undefined ? ESPERA_MS : p.hasta - Date.now();
    if (restante < MINIMO_MS) throw new Error(SIN_TIEMPO);
    try {
      const t = await intento(m, Math.min(ESPERA_MS, restante));
      p.alResponder?.(`${prefijo}:${m}`);
      return t;
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo;
}

function gemini(clave: string, modelos: string): Proveedor {
  return (p) => conRespaldo(modelos, p, "gemini", async (modelo, esperaMs) => {
    const { sistema, usuario } = p;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": clave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: usuario }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(esperaMs),
    });
    if (!r.ok) throw new Error(`Gemini respondió ${r.status}`);
    const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const t = j.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof t !== "string") throw new Error("Gemini no devolvió texto");
    return t;
  });
}

/** Proveedor extra opcional con API compatible con OpenAI (OpenRouter, Cerebras, Mistral, GitHub Models, etc.): se usa solo si fallan los principales. */
function compatible(url: string, clave: string, modelos: string): Proveedor {
  return (p) => conRespaldo(modelos, p, "extra", async (modelo, esperaMs) => {
    const { sistema, usuario } = p;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${clave}` },
      body: JSON.stringify({ model: modelo, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }] }),
      signal: AbortSignal.timeout(esperaMs),
    });
    if (!r.ok) throw new Error(`Proveedor extra respondió ${r.status}`);
    const t = ((await r.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
    if (typeof t !== "string") throw new Error("Proveedor extra no devolvió texto");
    return t;
  });
}

/** Si el proveedor principal falla del todo, prueba el de reserva. Ojo: si ambos agentes caen en la reserva, comparten proveedor aunque `independientes` diga true; la reserva solo evita que la carga se corte, y el verificador sigue sin poder subir un veredicto. */
const conReserva = (principal: Proveedor, reserva: Proveedor | null): Proveedor =>
  reserva ? async (p) => { try { return await principal(p); } catch { return reserva(p); } } : principal;

function groq(clave: string, modelos: string): Proveedor {
  return (p) => conRespaldo(modelos, p, "groq", async (modelo, esperaMs) => {
    const { sistema, usuario } = p;
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${clave}` },
      body: JSON.stringify({
        model: modelo,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
      }),
      signal: AbortSignal.timeout(esperaMs),
    });
    if (!r.ok) throw new Error(`Groq respondió ${r.status}`);
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const t = j.choices?.[0]?.message?.content;
    if (typeof t !== "string") throw new Error("Groq no devolvió texto");
    return t;
  });
}

/**
 * Agente 1 (registrador) y Agente 2 (verificador) usan, si se puede, proveedores DISTINTOS: así el segundo no repite
 * los errores del primero. Con una sola clave usan el mismo proveedor y se declara (independientes: false).
 * Sin ninguna clave devuelve null: los agentes quedan apagados.
 */
export function proveedoresDesdeEntorno(env: Record<string, string | undefined> = process.env): ConfigAgentes | null {
  const g = env.GEMINI_API_KEY;
  const q = env.GROQ_API_KEY;
  const mg = env.AGENTE_MODELO_GEMINI || "gemini-3.5-flash,gemini-3.6-flash,gemini-3.5-flash-lite";
  const mq = env.AGENTE_MODELO_GROQ || "openai/gpt-oss-120b,qwen/qwen3.8-27b";
  const mv = env.AGENTE_MODELO_VERIFICADOR;
  const extra = env.OPENAI_COMPAT_URL && env.OPENAI_COMPAT_KEY && env.OPENAI_COMPAT_MODELOS ? compatible(env.OPENAI_COMPAT_URL, env.OPENAI_COMPAT_KEY, env.OPENAI_COMPAT_MODELOS) : null;
  if (g && q) return { registrador: conReserva(gemini(g, mg), extra), verificador: conReserva(groq(q, mq), extra), independientes: true, modelos: { registrador: `gemini:${mg}`, verificador: `groq:${mq}` } };
  if (g) return { registrador: gemini(g, mg), verificador: gemini(g, mv || mg), independientes: false, modelos: { registrador: `gemini:${mg}`, verificador: `gemini:${mv || mg}` } };
  if (q) return { registrador: groq(q, mq), verificador: groq(q, mv || mq), independientes: false, modelos: { registrador: `groq:${mq}`, verificador: `groq:${mv || mq}` } };
  return null;
}

/** Quita vallas de código y parsea. Lanza si no es JSON. */
export function jsonDeRespuesta(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(limpio);
}
