"use client";

import { useRef, useState } from "react";

type Regla = { id: string; atributo: string; ok: boolean; gravedad: "critica" | "advertencia"; detalle: string };
type Resultado = { tipo: "foto" | "voz"; huella: string; bytes: number; veredicto: "verde" | "amarillo" | "rojo"; reglas: Regla[]; transcripcion?: string; aviso: string; cuentaQueRespalda?: string; error?: string };
type Frase = { frase: string; datos: string; marca: string };

const ETIQUETA = { verde: { icono: "✔", texto: "Sin señales de problema" }, amarillo: { icono: "●", texto: "Declarado: revisar" }, rojo: { icono: "✖", texto: "Retenido: requiere revisión" } } as const;
const hoy = () => new Date().toISOString().slice(0, 10);

function Veredicto({ r }: { r: Resultado }) {
  const e = ETIQUETA[r.veredicto];
  return (
    <section className="card" aria-live="polite">
      <h2><span className={r.veredicto}>{e.icono} {e.texto}</span></h2>
      <p className="aviso">{r.aviso}</p>
      <p>Huella SHA-256 del archivo: <code>{r.huella}</code> ({Math.round(r.bytes / 1024)} KB)</p>
      <p className="aviso">Para usarla en una entrega, copiá la huella y pegala en <a href="/agentes">la pantalla de carga</a>. Una misma huella no puede respaldar dos entregas.</p>
      {r.transcripcion !== undefined && <p>Lo que se entendió del audio: <i>{r.transcripcion || "(no se pudo transcribir)"}</i></p>}
      {r.cuentaQueRespalda && <p>Respaldado con la firma de la cuenta <code>{r.cuentaQueRespalda}</code>.</p>}
      <table>
        <thead><tr><th scope="col">Regla</th><th scope="col">Atributo</th><th scope="col">Resultado</th></tr></thead>
        <tbody>
          {r.reglas.map((x, i) => (
            <tr key={`${x.id}-${i}`}><td><code>{x.id}</code></td><td>{x.atributo}</td><td className={x.ok ? "verde" : x.gravedad === "critica" ? "rojo" : "amarillo"}>{x.ok ? "✔" : x.gravedad === "critica" ? "✖" : "●"} {x.detalle}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Evidencia() {
  const [foto, setFoto] = useState<File | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState(hoy());
  const [fechaRegistro, setFechaRegistro] = useState(hoy());
  const [resFoto, setResFoto] = useState<Resultado | null>(null);
  const [cargandoFoto, setCargandoFoto] = useState(false);

  const [frase, setFrase] = useState<Frase | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [cuenta, setCuenta] = useState("");
  const [mensaje, setMensaje] = useState<{ mensaje: string; marca: string } | null>(null);
  const [firma, setFirma] = useState("");
  const [resVoz, setResVoz] = useState<Resultado | null>(null);
  const [cargandoVoz, setCargandoVoz] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const grabador = useRef<MediaRecorder | null>(null);

  async function analizarFoto(e?: React.FormEvent) {
    e?.preventDefault();
    if (!foto) return;
    setCargandoFoto(true);
    setResFoto(null);
    const f = new FormData();
    f.set("archivo", foto);
    f.set("fechaEntrega", fechaEntrega);
    f.set("fechaRegistro", fechaRegistro);
    try {
      const r = await fetch("/api/evidencia/foto", { method: "POST", body: f });
      setResFoto(await r.json());
    } catch {
      setResFoto({ error: "No se pudo conectar" } as Resultado);
    }
    setCargandoFoto(false);
  }

  async function pedirFrase() {
    setFrase(null); setResVoz(null); setMensaje(null);
    const r = await fetch("/api/evidencia/voz/desafio", { method: "POST" });
    setFrase(await r.json());
  }

  async function grabar() {
    if (grabando) { grabador.current?.stop(); return; }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(flujo);
      const trozos: Blob[] = [];
      rec.ondataavailable = (ev) => trozos.push(ev.data);
      rec.onstop = () => {
        flujo.getTracks().forEach((t) => t.stop());
        const tipo = rec.mimeType.split(";")[0] || "audio/webm";
        setAudio(new File(trozos, "grabacion." + (tipo.split("/")[1] ?? "webm"), { type: tipo }));
        setMensaje(null);
        setGrabando(false);
      };
      grabador.current = rec;
      rec.start();
      setGrabando(true);
    } catch {
      setResVoz({ error: "No se pudo usar el micrófono. Subí un archivo de audio." } as Resultado);
    }
  }

  async function pedirMensaje() {
    if (!audio || !cuenta) return;
    const f = new FormData();
    f.set("archivo", audio);
    f.set("cuenta", cuenta.trim());
    const r = await fetch("/api/evidencia/voz/firmar", { method: "POST", body: f });
    const j = await r.json();
    if (j.error) setResVoz({ error: j.error } as Resultado); else setMensaje(j);
  }

  async function analizarVoz() {
    if (!audio || !frase) return;
    setCargandoVoz(true);
    setResVoz(null);
    const f = new FormData();
    f.set("archivo", audio);
    f.set("datos", frase.datos);
    f.set("marca", frase.marca);
    if (mensaje && firma && cuenta) f.set("acceso", JSON.stringify({ cuenta: cuenta.trim(), mensaje: mensaje.mensaje, marca: mensaje.marca, firma: firma.trim() }));
    try {
      const r = await fetch("/api/evidencia/voz", { method: "POST", body: f });
      setResVoz(await r.json());
    } catch {
      setResVoz({ error: "No se pudo conectar" } as Resultado);
    }
    setCargandoVoz(false);
  }

  return (
    <main>
      <header className="marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" />
        <div><h1>Evidencia: fotos y voz</h1><p className="lema">Revisamos si una foto o un audio muestra señales de edición, repetición o falta de respaldo.</p></div>
        <span className="etiqueta-red">Testnet · prototipo</span>
      </header>
      <p className="aviso">No cargues datos personales ni reales de clientes: un modelo de IA de un tercero mira el archivo. El archivo no se guarda: solo se calcula su huella. Ninguna regla dice que algo sea auténtico; dice &quot;requiere revisión&quot;.</p>

      <section className="card">
        <h2>1. Foto del remito o de la mercadería</h2>
        <form onSubmit={analizarFoto}>
          <p><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Foto de evidencia" onChange={(e) => { setFoto(e.target.files?.[0] ?? null); setResFoto(null); }} /></p>
          <p>
            <label>Fecha de entrega <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} /></label>{" "}
            <label>Fecha de registro <input type="date" value={fechaRegistro} onChange={(e) => setFechaRegistro(e.target.value)} /></label>
          </p>
          <div className="acciones"><button className="boton" disabled={!foto || cargandoFoto}>{cargandoFoto ? "Revisando la foto…" : "Revisar foto"}</button></div>
        </form>
        {resFoto?.error && <p className="error" role="alert">{resFoto.error}</p>}
      </section>
      {resFoto && !resFoto.error && <Veredicto r={resFoto} />}

      <section className="card">
        <h2>2. Audio</h2>
        <p>Primero pedí una frase al azar y decila en el audio. Un audio viejo o reutilizado no puede contenerla.</p>
        <div className="acciones"><button className="boton sec" type="button" onClick={pedirFrase}>Pedir frase</button></div>
        {frase && "frase" in frase && (
          <>
            <p className="info">Decí exactamente: <b>{frase.frase}</b>. Tenés 5 minutos.</p>
            <p>
              <button className="boton sec" type="button" onClick={grabar}>{grabando ? "Parar grabación" : "Grabar con el micrófono"}</button>{" "}
              <input type="file" accept="audio/*" aria-label="Archivo de audio" onChange={(e) => { setAudio(e.target.files?.[0] ?? null); setMensaje(null); setResVoz(null); }} />
            </p>
            {audio && <p className="aviso">Audio listo: {audio.name} ({Math.round(audio.size / 1024)} KB)</p>}
            <details>
              <summary>Respaldar el audio con una cuenta autorizada (recomendado)</summary>
              <p className="aviso">La identidad de quien carga la da la firma de su billetera, no su voz. Sin firma, el audio queda retenido (ALC-VOZ-04).</p>
              <p><label>Mi cuenta: <input value={cuenta} onChange={(e) => { setCuenta(e.target.value.trim()); setMensaje(null); }} placeholder="G…" size={50} spellCheck={false} /></label>{" "}
                <button className="boton sec chico" type="button" disabled={!audio || !cuenta} onClick={pedirMensaje}>Pedir mensaje a firmar</button></p>
              {mensaje && (
                <>
                  <p>Firmá este mensaje con tu billetera (SEP-53) y pegá la firma en base64:</p>
                  <textarea readOnly rows={7} value={mensaje.mensaje} aria-label="Mensaje a firmar" />
                  <p><input value={firma} onChange={(e) => setFirma(e.target.value.trim())} placeholder="Firma en base64" size={60} spellCheck={false} aria-label="Firma en base64" /></p>
                </>
              )}
            </details>
            <div className="acciones"><button className="boton" disabled={!audio || cargandoVoz} onClick={analizarVoz}>{cargandoVoz ? "Revisando el audio…" : "Revisar audio"}</button></div>
          </>
        )}
        {resVoz?.error && <p className="error" role="alert">{resVoz.error}</p>}
      </section>
      {resVoz && !resVoz.error && <Veredicto r={resVoz} />}

      <p className="aviso pie"><a href="/">Inicio</a> · <a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a> · Los peritos de IA solo pueden frenar; las reglas en código deciden y una persona revisa.</p>
    </main>
  );
}
