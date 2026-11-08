"use client";

import { use, useEffect, useState } from "react";

type Vista = {
  rol: "proveedor" | "comprador" | "transportista";
  estado: "pendiente" | "confirmada" | "no_coincide";
  vencida: boolean;
  vence: string;
  respondida?: string;
  documento: Record<string, string | number>;
  ronda: { estado: string; confirmaron: number; requeridos: number } | null;
};
const ROTULOS: [string, string][] = [["remito", "Remito"], ["producto", "Producto"], ["unidad", "Unidad"], ["cantidadPedida", "Cantidad pedida"], ["cantidadRecibida", "Cantidad recibida"], ["fechaEntrega", "Fecha de entrega"], ["observacion", "Observación"]];

/** Página pública de cada participante: ve los datos congelados de la entrega y responde con su nombre, sin crear cuenta. */
export default function Invitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [v, setV] = useState<Vista | null>(null);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`/api/invitacion/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setV(j);
      })
      .catch((e) => setError(e.message || "No se pudo abrir este enlace"));
  }, [token]);

  async function responder(respuesta: "confirmada" | "no_coincide") {
    setEnviando(true);
    setError("");
    try {
      const r = await fetch(`/api/invitacion/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ respuesta, nombre, nota }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setV((x) => (x ? { ...x, estado: j.estado, respondida: j.respondida } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar tu respuesta");
    }
    setEnviando(false);
  }

  const nombreOk = nombre.trim().length >= 2;
  return (
    <main>
      <header className="marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" />
        <div>
          <h1>Confirmá esta entrega</h1>
          <p className="lema">Sin crear cuenta. Tarda un minuto.</p>
        </div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {v && (
        <section className="card">
          <h2>Datos de la entrega</h2>
          <p className="aviso">Te piden confirmar como <b>{v.rol}</b>. Todos los participantes confirman estos mismos datos, que ya no se pueden cambiar.</p>
          <table>
            <tbody>
              {ROTULOS.filter(([k]) => v.documento[k] !== undefined).map(([k, r]) => (
                <tr key={k}><th scope="row">{r}</th><td>{String(v.documento[k])}</td></tr>
              ))}
            </tbody>
          </table>
          {v.ronda && <p className="aviso">Confirmaron {v.ronda.confirmaron} de {v.ronda.requeridos}.</p>}
          {v.estado === "pendiente" && !v.vencida ? (
            <>
              <p>¿Lo que recibiste o enviaste coincide con estos datos?</p>
              <p><label>Tu nombre (obligatorio): <input value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} size={30} /></label></p>
              <p><label>Comentario (opcional, sin datos personales): <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} size={40} /></label></p>
              <p className="aviso">Guardamos tu nombre, tu respuesta, la fecha y hora y tu comentario por 30 días después de que venza el enlace, solo para dejar constancia de esta entrega. <a href="/privacidad" target="_blank" rel="noopener">Más información</a>.</p>
              <p>
                <button onClick={() => responder("confirmada")} disabled={enviando || !nombreOk}>Sí, coincide</button>{" "}
                <button className="sec" onClick={() => responder("no_coincide")} disabled={enviando || !nombreOk}>No coincide</button>
              </p>
              <p className="aviso">Tu respuesta queda registrada con fecha y hora. Declarás lo que viste; GALCOA+ no verifica quién sos ni que la mercadería exista.</p>
            </>
          ) : v.estado === "pendiente" ? (
            <p className="info">Este enlace venció. Pedile a la distribuidora uno nuevo.</p>
          ) : (
            <p className={v.estado === "confirmada" ? "gran verde" : "gran amarillo"}>
              {v.estado === "confirmada" ? "✔ Declaraste que coincide." : "▲ Avisaste que no coincide."} <span className="aviso">Ya podés cerrar esta página.</span>
            </p>
          )}
        </section>
      )}
    </main>
  );
}
