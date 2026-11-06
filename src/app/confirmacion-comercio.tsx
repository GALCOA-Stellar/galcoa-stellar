"use client";

import { useState } from "react";
import QR from "qrcode";

type Estado = "pendiente" | "confirmada" | "no_coincide";
type Enlace = { id: string; url: string; qr: string; estado: Estado; nota?: string; sello?: string };

/** Pedir la confirmación del comercio por enlace o QR y aplicarla al documento (confirmadoPor). */
export function ConfirmacionComercio({ texto, setTexto }: { texto: string; setTexto: (t: string) => void }) {
  const [enlaces, setEnlaces] = useState<Record<number, Enlace>>({});
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  let docs: Record<string, unknown>[] = [];
  try { const j = JSON.parse(texto); if (Array.isArray(j)) docs = j; } catch { /* el texto se está editando */ }
  if (docs.length === 0) return null;

  async function crear(i: number) {
    setError(""); setOcupado(true);
    try {
      let pase = ""; try { pase = sessionStorage.getItem("galcoa-pase") ?? ""; } catch { /* sin almacenamiento */ }
      const r = await fetch("/api/confirmacion", { method: "POST", headers: { "content-type": "application/json", ...(pase ? { "x-pase": pase } : {}) }, body: JSON.stringify({ documento: docs[i] }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo crear el enlace");
      const url = `${location.origin}${j.ruta}`;
      setEnlaces((x) => ({ ...x, [i]: { id: j.id, url, qr: "", estado: "pendiente" } }));
      const qr = await QR.toDataURL(url, { margin: 1, width: 192, color: { dark: "#1E3A5F", light: "#FFFFFF" } });
      setEnlaces((x) => ({ ...x, [i]: { ...x[i], qr } }));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el enlace"); }
    setOcupado(false);
  }

  async function ver(i: number) {
    setError(""); setOcupado(true);
    try {
      const e = enlaces[i];
      const r = await fetch(`/api/confirmacion/${e.id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo consultar");
      setEnlaces((x) => ({ ...x, [i]: { ...x[i], estado: j.estado, nota: j.nota, sello: j.sello } }));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo consultar"); }
    setOcupado(false);
  }

  function aplicar(i: number) {
    if (!enlaces[i].sello) { setError("El servidor no pudo emitir el sello de confirmación. Probá de nuevo."); return; }
    const nuevo = docs.map((d, k) => (k === i ? { ...d, confirmadoPor: enlaces[i].sello } : d));
    setTexto(JSON.stringify(nuevo, null, 2));
  }

  return (
    <section className="card" aria-labelledby="hc">
      <h2 id="hc">Confirmación del comercio (opcional)</h2>
      <p className="aviso">El comercio abre el enlace o escanea el QR, ve la entrega y responde, sin crear cuenta. Su respuesta queda registrada con fecha y hora. Cuando confirme, aplicala al documento y volvé a revisar.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <table>
        <thead><tr><th>Remito</th><th>Confirmación</th></tr></thead>
        <tbody>
          {docs.map((d, i) => {
            const e = enlaces[i];
            return (
              <tr key={i}>
                <td>{String(d.remito ?? i + 1)}</td>
                <td>
                  {!e ? <button className="sec chico" onClick={() => crear(i)} disabled={ocupado}>Crear enlace</button> : (
                    <>
                      {e.qr && /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.qr} alt="QR para que el comercio confirme" width={96} height={96} />}
                      <br /><code>{e.url}</code><br />
                      <button className="sec chico" onClick={() => navigator.clipboard?.writeText(e.url)}>Copiar enlace</button>
                      <button className="sec chico" onClick={() => ver(i)} disabled={ocupado}>Ver respuesta</button>
                      <br />
                      {e.estado === "pendiente" && <span className="aviso">Esperando al comercio…</span>}
                      {e.estado === "confirmada" && <><span className="verde">✔ El comercio confirmó.</span> <button className="chico" onClick={() => aplicar(i)}>Aplicar al documento</button></>}
                      {e.estado === "no_coincide" && <span className="amarillo">▲ El comercio avisó que no coincide{e.nota ? `: “${e.nota}”` : ""}. Revisá antes de sellar.</span>}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
