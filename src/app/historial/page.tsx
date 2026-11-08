"use client";

import { useEffect, useState } from "react";

type Op = { id: string; fecha: string; txHash: string; ledger: number; cantidadHojas: number; firmadoPor: string | string[]; personas?: string[]; modo: "2de2" | "una-firma" };
const corta = (g: string) => `${g.slice(0, 5)}…${g.slice(-4)}`;

/** Historial de operaciones selladas (protegido: pide haber ingresado con la billetera, o modo demostración). */
export default function Historial() {
  const [ops, setOps] = useState<Op[] | null>(null);
  const [com, setCom] = useState<{ sellos: number; sinDato: number; totalXlm: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let pase = ""; try { pase = sessionStorage.getItem("galcoa-pase") ?? ""; } catch { /* nada */ }
    fetch("/api/historial", { headers: pase ? { "x-pase": pase } : {} })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setOps(j.operaciones); setCom(j.comisiones ?? null); })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el historial"));
  }, []);

  async function bajar(op: Op) {
    let pase = ""; try { pase = sessionStorage.getItem("galcoa-pase") ?? ""; } catch { /* nada */ }
    const r = await fetch(`/api/historial/${op.id}`, { headers: pase ? { "x-pase": pase } : {} });
    if (!r.ok) { setError("No se pudo descargar el archivo"); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(await r.json(), null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `galcoa-lote-${op.txHash.slice(0, 8)}.json`; a.click(); URL.revokeObjectURL(url);
  }

  const pase = () => { try { return sessionStorage.getItem("galcoa-pase") ?? ""; } catch { return ""; } };
  async function borrarUna(op: Op) {
    if (!confirm("¿Borrar esta operación del historial? La huella en Stellar queda (no contiene datos personales).")) return;
    const r = await fetch(`/api/historial/${op.id}`, { method: "DELETE", headers: { "x-pase": pase() } });
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "No se pudo borrar"); return; }
    setOps((x) => (x ? x.filter((o) => o.id !== op.id) : x));
  }
  async function misDatos() {
    const r = await fetch("/api/mis-datos", { headers: { "x-pase": pase() } });
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "No se pudieron descargar tus datos"); return; }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = url; a.download = "mis-datos-galcoa.json"; a.click(); URL.revokeObjectURL(url);
  }
  async function borrarMisDatos() {
    if (!confirm("¿Borrar TODO lo que esta instalación guarda sobre vos? No se puede deshacer.")) return;
    const r = await fetch("/api/mis-datos", { method: "DELETE", headers: { "x-pase": pase() } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "No se pudo borrar"); return; }
    setError(""); setOps((x) => (x ? x.filter(() => false) : x)); alert(`Se borraron ${j.borradas} operación(es).`);
  }

  return (
    <main>
      <header className="marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" />
        <div><h1>Historial</h1><p className="lema">Lotes sellados en esta instalación. Cada archivo es la prueba del lote.</p></div>
        <a className="enlace-cab" href="/demo">Volver</a>
      </header>
      {error && <p className="error" role="alert">{error}{error.startsWith("Ingresá") && <> Volvé a la <a href="/demo">pantalla principal</a>, ingresá con Varial y reabrí el historial.</>}</p>}
      {ops && ops.length === 0 && <p className="info">Todavía no hay lotes sellados.</p>}
      {com && ops && ops.length > 0 && (
        <p className="info" aria-label="Contador de comisiones">Comisiones de red pagadas: <b>{com.totalXlm} XLM</b> en {com.sellos} sello(s){com.sinDato > 0 && ` (${com.sinDato} sin dato: son anteriores al contador)`}. Testnet: XLM de prueba, sin valor.</p>
      )}
      {ops && ops.length > 0 && (
        <section className="card">
          <table>
            <thead><tr><th scope="col">Fecha</th><th scope="col">Docs</th><th scope="col">Aprobó</th><th scope="col">Prueba</th><th scope="col"></th></tr></thead>
            <tbody>
              {ops.map((o) => (
                <tr key={o.id}>
                  <td>{new Date(o.fecha).toLocaleString("es-AR")}</td>
                  <td>{o.cantidadHojas}</td>
                  <td>{(Array.isArray(o.firmadoPor) ? o.firmadoPor : [o.firmadoPor]).map(corta).join(" + ")}<br /><span className="aviso">{o.modo === "2de2" ? "2 de 2" : "1 firma"}</span></td>
                  <td><a href={`https://stellar.expert/explorer/testnet/tx/${o.txHash}`} target="_blank" rel="noreferrer">ledger {o.ledger}</a></td>
                  <td><button className="sec chico" onClick={() => bajar(o)}>Descargar archivo</button> <button className="sec chico" onClick={() => borrarUna(o)}>Borrar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="card">
        <h2>Tus datos</h2>
        <p className="aviso">Ley 25.326: podés descargar o borrar lo que esta instalación guarda sobre vos (hace falta haber ingresado con tu billetera). <a href="/privacidad">Ver el aviso de privacidad</a>.</p>
        <p><button className="sec" onClick={misDatos}>Descargar mis datos</button> <button className="sec" onClick={borrarMisDatos}>Borrar mis datos</button></p>
      </section>
    </main>
  );
}
