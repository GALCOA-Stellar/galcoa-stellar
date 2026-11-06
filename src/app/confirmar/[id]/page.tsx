"use client";

import { use, useEffect, useState } from "react";

type Vista = { estado: "pendiente" | "confirmada" | "no_coincide"; vencida: boolean; vence: string; respondida?: string; documento: Record<string, string | number> };
const ROTULOS: [string, string][] = [["remito", "Remito"], ["producto", "Producto"], ["unidad", "Unidad"], ["cantidadPedida", "Cantidad pedida"], ["cantidadRecibida", "Cantidad recibida"], ["fechaEntrega", "Fecha de entrega"], ["observacion", "Observación"]];

/** Página pública del comercio: ve los datos de la entrega y responde, sin crear cuenta. */
export default function Confirmar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [v, setV] = useState<Vista | null>(null);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`/api/confirmacion/${encodeURIComponent(id)}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setV(j); }).catch((e) => setError(e.message || "No se pudo abrir este enlace"));
  }, [id]);

  async function responder(respuesta: "confirmada" | "no_coincide") {
    setEnviando(true); setError("");
    try {
      const r = await fetch(`/api/confirmacion/${encodeURIComponent(id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ respuesta, nota }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setV((x) => (x ? { ...x, estado: j.estado, respondida: j.respondida } : x));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo enviar tu respuesta"); }
    setEnviando(false);
  }

  return (
    <main>
      <header className="marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" />
        <div><h1>Confirmá tu entrega</h1><p className="lema">Sin crear cuenta. Tarda un minuto.</p></div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {v && (
        <section className="card">
          <h2>Datos de la entrega</h2>
          <table><tbody>{ROTULOS.filter(([k]) => v.documento[k] !== undefined).map(([k, r]) => <tr key={k}><th scope="row">{r}</th><td>{String(v.documento[k])}</td></tr>)}</tbody></table>
          {v.estado === "pendiente" && !v.vencida ? (
            <>
              <p>¿Lo que recibiste coincide con estos datos?</p>
              <p><label>Comentario (opcional, sin datos personales): <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} size={40} /></label></p>
              <p className="aviso">Guardamos tu respuesta, la fecha y hora y tu comentario por 30 días después de que venza el enlace, solo para dejar constancia de esta entrega. <a href="/privacidad" target="_blank">Más información</a>.</p>
              <p><button onClick={() => responder("confirmada")} disabled={enviando}>Sí, lo recibí así</button>{" "}
                <button className="sec" onClick={() => responder("no_coincide")} disabled={enviando}>No coincide</button></p>
              <p className="aviso">Tu respuesta queda registrada con fecha y hora. Declarás lo que recibiste; GALCOA+ no verifica quién sos ni que la mercadería exista.</p>
            </>
          ) : v.estado === "pendiente" ? <p className="info">Este enlace venció. Pedile a la distribuidora uno nuevo.</p>
            : <p className={v.estado === "confirmada" ? "gran verde" : "gran amarillo"}>{v.estado === "confirmada" ? "✔ Confirmaste esta entrega." : "▲ Avisaste que no coincide."} <span className="aviso">Ya podés cerrar esta página.</span></p>}
        </section>
      )}
    </main>
  );
}
