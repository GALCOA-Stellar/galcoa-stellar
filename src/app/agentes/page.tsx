"use client";

import { useState } from "react";

type Veredicto = "verde" | "amarillo" | "rojo";
type Regla = { id: string; ok: boolean; detalle: string };
type Propuesta = { remito?: string; producto?: string; unidad?: string; cantidadPedida?: number; cantidadRecibida?: number; fechaEntrega?: string; observacion?: string };
type Vista = { indice: number; propuesta: Propuesta; evaluacion: { veredicto: Veredicto; reglas: Regla[] }; pendienteDeConfirmacion: boolean };
type Hallazgo = { indice: number; campo: string; severidad: "critica" | "advertencia"; mensaje: string };
/** "gemini:a,b,c" → "gemini:a (+2 de respaldo)": la lista completa es la cadena de respaldo, no lo que respondió. */
const modeloCorto = (m: string) => { const [p, ...r] = m.split(","); return r.length ? `${p} (+${r.length} de respaldo)` : p; };
type Registrado = { vistas: Vista[]; hallazgos: Hallazgo[] | null; independientes: boolean; modelos: { registrador: string; verificador: string }; datos: string; marca: string; error?: string };
type Confirmado = { vistas: Vista[]; documentos: unknown[]; error?: string };

const PERSONAS = ["ana", "luis", "gaston", "maria"];
const ETIQUETA: Record<Veredicto, { icono: string; texto: string }> = {
  verde: { icono: "✔", texto: "Verificado" },
  amarillo: { icono: "●", texto: "Declarado" },
  rojo: { icono: "✖", texto: "Retenido: requiere revisión" },
};
const EJEMPLO = "Hoy 6 de noviembre llegó el remito R-2041: pedimos 40 cajas de aceite 900 ml y recibimos 38, dos venían rotas. Entrega del 5 de noviembre.";

async function post<T>(url: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  return (await r.json()) as T;
}

export default function Agentes() {
  const [quien, setQuien] = useState(PERSONAS[0]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [reg, setReg] = useState<Registrado | null>(null);
  const [confirma, setConfirma] = useState(PERSONAS[1]);
  const [conf, setConf] = useState<Confirmado | null>(null);
  const [huella, setHuella] = useState("");

  async function cargar() {
    setCargando(true); setConf(null); setReg(null);
    try { setReg(await post<Registrado>("/api/agentes/registrar", { mensaje, cargadoPor: quien, ...(/^[0-9a-f]{64}$/.test(huella.trim()) ? { evidenciaHash: huella.trim() } : {}) })); }
    catch { setReg({ vistas: [], hallazgos: null, independientes: false, modelos: { registrador: "", verificador: "" }, datos: "", marca: "", error: "No se pudo conectar" }); }
    finally { setCargando(false); }
  }
  async function confirmar() {
    if (!reg) return;
    setConf(await post<Confirmado>("/api/agentes/confirmar", { datos: reg.datos, marca: reg.marca, confirmadoPor: confirma }));
  }

  const vistas = conf?.vistas ?? reg?.vistas ?? [];
  return (
    <main>
      <header className="marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" />
        <div>
          <h1>Cargá una entrega con tus palabras</h1>
          <p className="lema">Un agente de IA ordena el dato, otro lo controla y unas reglas fijas deciden. La IA no aprueba nada.</p>
        </div>
      </header>

      <section className="card">
        <div className="agentes-esquema" aria-label="Cómo funciona">
          <p><b>1. Agente registrador:</b> lee tu mensaje y arma la ficha de la entrega. Solo propone.</p>
          <p><b>2. Agente verificador:</b> la compara con tu mensaje. Solo puede frenar.</p>
          <p><b>3. Reglas fijas</b> deciden: verde (verificado), amarillo (declarado) o rojo (requiere revisión). <b>4. Otra persona</b> confirma: quien carga no puede aprobar.</p>
        </div>
        <p className="aviso">No cargues datos personales ni reales de clientes: los modelos de IA corren en servidores de terceros. Es una demostración en una red de prueba, sin dinero real.</p>
        <label>Quién carga
          <select value={quien} onChange={(e) => setQuien(e.target.value)}>{PERSONAS.map((p) => <option key={p}>{p}</option>)}</select>
        </label>
        <label>Qué pasó
          <textarea rows={5} maxLength={1500} value={mensaje} onChange={(e) => setMensaje(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !cargando && mensaje.trim() !== "") cargar(); }} placeholder={EJEMPLO} />
        </label>
        <label>Huella de la evidencia (opcional)
          <input value={huella} onChange={(e) => setHuella(e.target.value.trim().toLowerCase())} placeholder="64 caracteres, la da la pantalla de Evidencia" spellCheck={false} maxLength={64} />
        </label>
        <p className="aviso">Si el mensaje cuenta una sola entrega y tenés la huella de su foto o su audio, pegala acá: la regla de original la usa. <a href="/evidencia">Revisar una foto o un audio</a>.</p>
        <div className="acciones">
          <button className="boton" disabled={cargando || mensaje.trim() === ""} onClick={cargar}>{cargando ? "Los agentes están trabajando…" : "Cargar"}</button>
          <button className="boton sec" type="button" onClick={() => setMensaje(EJEMPLO)}>Usar un ejemplo</button>
        </div>
        {reg?.error && <p className="error" role="alert">{reg.error}</p>}
      </section>

      {reg && !reg.error && (
        <section className="card" aria-live="polite">
          <h2>Resultado</h2>
          <p className="aviso">
            Agente 1: {modeloCorto(reg.modelos.registrador)} · Agente 2: {modeloCorto(reg.modelos.verificador)}
            {!reg.independientes && " · Ojo: los dos agentes usan el mismo proveedor de IA, así que no son independientes."}
            {reg.hallazgos === null && " · El agente verificador no respondió: nada queda verificado."}
          </p>
          {vistas.length === 0 && <p>No encontramos ninguna entrega en el mensaje. Probá con "Usar un ejemplo".</p>}
          {vistas.map((v) => {
            const e = ETIQUETA[v.evaluacion.veredicto];
            const motivos = v.evaluacion.reglas.filter((r) => !r.ok && !(v.pendienteDeConfirmacion && r.id === "ALC-ATR-01"));
            return (
              <div key={v.indice} className="card" style={{ borderColor: `var(--${v.evaluacion.veredicto === "rojo" ? "bad" : "line"})` }}>
                <p className="gran">
                  <span className={v.evaluacion.veredicto}>{e.icono}</span> {v.propuesta.remito ?? "(sin remito)"} · {e.texto}
                  {v.pendienteDeConfirmacion && v.evaluacion.veredicto !== "rojo" && " · pendiente de segunda persona"}
                </p>
                <ul className="puntos">
                  <li>{v.propuesta.producto ?? "—"}: pedido {v.propuesta.cantidadPedida ?? "—"}, recibido {v.propuesta.cantidadRecibida ?? "—"} {v.propuesta.unidad ?? ""}</li>
                  <li>Entrega: {v.propuesta.fechaEntrega ?? "—"}{v.propuesta.observacion ? ` · ${v.propuesta.observacion}` : ""}</li>
                  {motivos.map((r) => <li key={r.id}><code>{r.id}</code> {r.detalle}</li>)}
                </ul>
              </div>
            );
          })}

          {!conf && vistas.length > 0 && (
            <div>
              <label>Confirma (otra persona)
                <select value={confirma} onChange={(e) => setConfirma(e.target.value)}>{PERSONAS.map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              <button className="boton" onClick={confirmar}>Confirmar como {confirma}</button>
            </div>
          )}
          {conf?.error && <p className="error" role="alert">{conf.error}</p>}
          {conf && !conf.error && (
            <div>
              <p><b>{conf.documentos.length}</b> entrega(s) aprobada(s), listas para dejar su prueba en la red Stellar. Lo que quedó en rojo o sin confirmar no se incluye.</p>
              {conf.documentos.length > 0 && (
                <>
                  <details>
                    <summary>Ver el detalle técnico</summary>
                    <textarea readOnly rows={6} value={JSON.stringify(conf.documentos, null, 2)} aria-label="Detalle técnico de las entregas aprobadas" />
                  </details>
                  <p className="aviso">Para dejar la prueba en la red seguí en <a href="/demo">la demo con firma</a>: necesita una billetera de Stellar en una computadora.</p>
                </>
              )}
            </div>
          )}
        </section>
      )}
      <p className="aviso pie"><a href="/">Inicio</a> · <a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a> · La IA propone y controla; las reglas deciden y una persona firma.</p>
    </main>
  );
}
