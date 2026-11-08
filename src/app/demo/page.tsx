"use client";

import { useEffect, useState } from "react";
import { csvADocumentos } from "@/lib/dominio/csv";
import { ConfirmacionComercio } from "../confirmacion-comercio";
import { conectarBilletera, firmarAutorizacion, firmarMensaje, firmarTransaccion, type Via } from "@/lib/stellar/billetera";

import { REGISTRO_ID as CONTRATO_REGISTRO, ESCROW_ID as CONTRATO_ESCROW } from "@/lib/config/contratos";
const H = "ab".repeat(32); // huella de ejemplo (64 caracteres hexadecimales) del documento original
const base = { unidad: "caja", fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: H };
const EJEMPLO = [
  { ...base, remito: "R-0001", producto: "Aceite 900 ml", cantidadPedida: 200, cantidadRecibida: 200 },
  { ...base, remito: "R-0002", producto: "Yerba 1 kg", cantidadPedida: 120, cantidadRecibida: 120 },
  { ...base, remito: "R-0003", producto: "Fideos 500 g", cantidadPedida: 300, cantidadRecibida: 298, observacion: "2 cajas dañadas en el flete" },
  { ...base, remito: "R-0004", producto: "Arroz 1 kg", cantidadPedida: 200, cantidadRecibida: 198 },
  { ...base, remito: "R-0005", producto: "Azúcar 1 kg", cantidadPedida: 80, cantidadRecibida: 80, evidenciaHash: undefined },
  { ...base, remito: "R-0006", producto: "Harina 1 kg", cantidadPedida: 50, cantidadRecibida: 50, confirmadoPor: "operador-01" },
  { ...base, remito: "R-0007", producto: "Sal 500 g", cantidadPedida: 60, cantidadRecibida: 60, fechaRegistro: "2026-11-08" },
];

type Veredicto = "verde" | "amarillo" | "rojo";
type Resultado = { posicion: number; veredicto: Veredicto; reglas: { id: string; ok: boolean; detalle: string }[]; enLote: boolean };
type Respuesta = {
  resultados: Resultado[];
  sellado: { raiz: string; memo: string; cantidadHojas: number; txHash: string; ledger: number } | null;
  comprobantes: Record<string, unknown>[];
  explorador: string | null;
  archivo?: unknown;
  error?: string;
  firmadoPor?: string | string[];
  comisionPagadaPor?: string | null;
};
type Vista = {
  reglasVersion: string; red: string; sellan: number; afuera: number; raiz: string | null; memo: string | null;
  documentos: { posicion: number; remito: string | null; veredicto: Veredicto; enLote: boolean; avisos: { id: string; detalle: string }[] }[];
  error?: string;
};

const ETIQUETA: Record<Veredicto, { icono: string; texto: string }> = {
  verde: { icono: "✔", texto: "Verificado" },
  amarillo: { icono: "▲", texto: "Declarado" },
  rojo: { icono: "✖", texto: "Requiere revisión" },
};
const Pill = ({ v }: { v: Veredicto }) => <span className={`pill ${v}`}>{ETIQUETA[v].icono} {ETIQUETA[v].texto}</span>;
const corta = (g: string) => `${g.slice(0, 5)}…${g.slice(-4)}`;
const PLANTILLA_CSV = "remito,producto,unidad,cantidadPedida,cantidadRecibida,fechaEntrega,fechaRegistro,cargadoPor,confirmadoPor,evidenciaHash,observacion\n";

/** Convierte un error técnico en un mensaje claro que dice qué pasó y qué hacer. */
function explicar(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (e instanceof SyntaxError) return "Los datos no tienen el formato esperado. Revisá la planilla o volvé a cargarla.";
  if (/User declined|rejected|denied|declin/i.test(m)) return "Rechazaste la firma en la billetera. Si fue sin querer, volvé a intentar.";
  if (/not installed|Varial|wallet/i.test(m) && !/firma|cuenta/i.test(m)) return "No encontramos la billetera Varial. Instalala en tu navegador, ponela en Testnet y recargá la página.";
  if (/passphrase|network mismatch|wrong network|Public Global|Futurenet/i.test(m)) return "La billetera está en otra red. Cambiala a Testnet (Test SDF Network) en Varial y volvé a intentar.";
  if (/BUSY|TRY_AGAIN_LATER|timeout|timed out|504|503/i.test(m)) return "La red de prueba está ocupada o tardó en responder. Esperá unos segundos y volvé a intentar: no se registró nada dos veces.";
  if (/MismaPersona|same person|misma persona/i.test(m)) return "Quien carga y quien aprueba tienen que ser personas distintas. Usá dos cuentas diferentes.";
  if (/insufficient|tx_insufficient|underfunded|no existe la cuenta|account not found|op_no_source/i.test(m)) return "La cuenta no existe o no tiene saldo de prueba en Testnet. Fondeala con Friendbot y volvé a intentar.";
  if (/ya (fue )?registrad|already|YaRegistrad|Duplicad/i.test(m)) return "Este lote ya figura registrado en la red: no se puede registrar dos veces. Verificalo en /verificar.";
  return m || "Algo salió mal. Probá de nuevo.";
}
const TAREAS: Record<string, string> = {
  revisando: "Revisando los documentos…", preparando: "Preparando el paquete para firmar…", enviando: "Confirmando en Stellar (unos 10 segundos)…",
  firmando: "Esperando tu firma en la billetera… (mirá la ventana de Varial)", confirmando: "Confirmando en la red…",
  contrato: "Confirmando el registro en el contrato (unos 10 segundos)…", "contrato-prep": "Preparando el registro…",
};

export default function Pagina() {
  const [texto, setTexto] = useState(JSON.stringify(EJEMPLO, null, 2));
  const [cuenta, setCuenta] = useState("");
  const [via, setVia] = useState<Via>("extension"); // cómo se conectó la billetera: extensión del navegador o celular
  const [yo, setYo] = useState<{ cuenta: string; identidad: string } | null>(null);
  const [demo, setDemo] = useState(false);
  const [xdr2, setXdr2] = useState("");
  const [firmas2, setFirmas2] = useState<string[]>([]);
  const [pendiente, setPendiente] = useState<{ mensaje: string; marca: string } | null>(null);
  const [firmaManual, setFirmaManual] = useState("");
  const [cargando, setCargando] = useState("");
  const [resp, setResp] = useState<Respuesta | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [vista, setVista] = useState<Vista | null>(null);
  const [vistaTexto, setVistaTexto] = useState("");
  const [contrato, setContrato] = useState<{ ledger: number; comisionStroops: number } | null>(null);
  const [cuentaAprobador, setCuentaAprobador] = useState("");
  const [paqueteC, setPaqueteC] = useState<{ datos: string; marca: string; porFirmar: { cuenta: string; preimage: string }[] } | null>(null);
  const [firmasC, setFirmasC] = useState<{ cuenta: string; firma: string }[]>([]);
  const vistaVigente = vista !== null && vistaTexto === texto && vista.sellan > 0;
  const paso = resp?.sellado ? 4 : vistaVigente ? 3 : vista ? 2 : 1;
  const ocupado = cargando !== "";

  useEffect(() => { fetch("/api/demo/firmar").then((r) => r.json()).then((j) => setDemo(!!j.activo)).catch(() => {}); }, []);

  const fallo = (e: unknown) => setError(explicar(e));
  const post = async (ruta: string, cuerpo: unknown) => {
    let r: Response;
    try { r = await fetch(ruta, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) }); }
    catch { throw new Error("No hay conexión con el servidor. Revisá tu internet y volvé a intentar."); }
    const j = await r.json().catch(() => ({} as { error?: string }));
    if (r.status === 429) throw new Error("Hiciste muchos pedidos seguidos. Esperá un minuto y probá de nuevo.");
    if (!r.ok) throw new Error(j.error ?? "El servidor no pudo completar la acción. Probá de nuevo.");
    return j;
  };

  async function cargarPlanilla(f: File | undefined) {
    if (!f) return;
    setError(""); setAviso(""); setVista(null); setResp(null);
    try { setTexto(JSON.stringify(csvADocumentos(await f.text()), null, 2)); setAviso(`Planilla "${f.name}" cargada. Ahora revisá qué se va a sellar.`); }
    catch (e) { fallo(e); }
  }

  async function revisar() {
    setError(""); setAviso(""); setVista(null); setResp(null); setXdr2(""); setFirmas2([]); setContrato(null); setCargando("revisando");
    try { setVista(await post("/api/previsualizar", { documentos: JSON.parse(texto) })); setVistaTexto(texto); }
    catch (e) { fallo(e instanceof SyntaxError ? new Error("Los datos no son válidos. Revisá la planilla o el texto.") : e); }
    setCargando("");
  }

  async function conectar(como: Via = "extension") {
    setError("");
    try {
      setCuenta(await conectarBilletera(como));
      setVia(como);
    } catch (e) { setError(como === "celular" ? "No pude conectar Varial del celular. Abrí Varial, elegí Testnet y escaneá el código de nuevo. " + (e instanceof Error ? e.message : "") : "No pude conectar Varial (¿está instalada y en Testnet?). También podés pegar tu cuenta. " + (e instanceof Error ? e.message : "")); }
  }

  async function ingresar() {
    setError("");
    try {
      const d = await post("/api/sesion", { cuenta });
      const firma = await firmarMensaje(via, d.mensaje, cuenta);
      const j = await post("/api/sesion", { acceso: { cuenta, mensaje: d.mensaje, marca: d.marca, firma } });
      setYo({ cuenta: j.cuenta, identidad: j.identidad });
      try { sessionStorage.setItem("galcoa-pase", j.pase); } catch { /* sin almacenamiento: el historial pedirá ingresar de nuevo */ }
    } catch (e) { fallo(e); }
  }

  // Paso 3 (principal): sello con aprobación de dos personas. La red rechaza la transacción si falta una firma.
  async function preparar2() {
    setError(""); setResp(null); setFirmas2([]); setCargando("preparando");
    try { setXdr2((await post("/api/sello-2de2/preparar", { documentos: JSON.parse(texto) })).xdr); }
    catch (e) { fallo(e); }
    setCargando("");
  }
  async function firmarConBilletera() {
    setError(""); setCargando("firmando");
    try {
      const r = await firmarTransaccion(via, xdr2, cuenta);
      setXdr2(r.xdr); setFirmas2((x) => [...x, r.firmante]);
    } catch (e) { fallo(e); }
    setCargando("");
  }
  async function firmarDemo(rol: "cargador" | "aprobador") {
    setError("");
    try { const j = await post("/api/demo/firmar", { xdr: xdr2, rol }); setXdr2(j.xdr); setFirmas2((x) => [...x, j.cuenta]); }
    catch (e) { fallo(e); }
  }
  async function enviar2() {
    setError(""); setCargando("enviando");
    try { setResp(await post("/api/sello-2de2/enviar", { documentos: JSON.parse(texto), xdr: xdr2 })); }
    catch (e) { fallo(e); }
    setCargando("");
  }
  async function registrarContrato() {
    setError(""); setCargando("contrato");
    try { setContrato(await post("/api/contrato/registrar", { documentos: JSON.parse(texto) })); }
    catch (e) { fallo(e); }
    setCargando("");
  }

  // Registro en el contrato con billeteras: cada persona firma SU autorización (signAuthEntry de Varial).
  async function prepararContrato() {
    setError(""); setCargando("contrato-prep"); setFirmasC([]);
    try { setPaqueteC(await post("/api/contrato/preparar", { documentos: JSON.parse(texto), cargador: cuenta, aprobador: cuentaAprobador })); }
    catch (e) { fallo(e); }
    setCargando("");
  }
  async function firmarContrato() {
    setError(""); setCargando("firmando");
    try {
      const mia = paqueteC?.porFirmar.find((x) => x.cuenta === cuenta);
      if (!mia) throw new Error("Esta cuenta no es ninguna de las dos del registro: conectá la cuenta correcta en Varial.");
      const firma = await firmarAutorizacion(via, mia.preimage, cuenta);
      setFirmasC((x) => [...x.filter((y) => y.cuenta !== cuenta), { cuenta, firma }]);
    } catch (e) { fallo(e); }
    setCargando("");
  }
  async function enviarContrato() {
    setError(""); setCargando("contrato");
    try { setContrato(await post("/api/contrato/enviar", { documentos: JSON.parse(texto), datos: paqueteC!.datos, marca: paqueteC!.marca, firmas: firmasC })); }
    catch (e) { fallo(e); }
    setCargando("");
  }

  // Alternativa de prototipo: una sola persona confirma con su firma (SEP-53).
  async function pedirMensaje() {
    const d = await post("/api/desafio", { cuenta, documentos: JSON.parse(texto) });
    setPendiente({ mensaje: d.mensaje, marca: d.marca });
    return d as { mensaje: string; marca: string };
  }
  async function sellarUnaFirma(d: { mensaje: string; marca: string }, firma: string) {
    setCargando("enviando"); setError(""); setResp(null);
    try { setResp(await post("/api/sellar-lote", { documentos: JSON.parse(texto), acceso: { cuenta, mensaje: d.mensaje, marca: d.marca, firma } })); }
    catch (e) { fallo(e); }
    setCargando("");
  }
  async function firmarYSellarUna() {
    setError("");
    try {
      const d = await pedirMensaje();
      await sellarUnaFirma(d, await firmarMensaje(via, d.mensaje, cuenta));
    } catch (e) { fallo(e); }
  }

  async function descargarConstancia(posicion: number) {
    setError("");
    try {
      const k = resp!.resultados.filter((x) => x.enLote).findIndex((x) => x.posicion === posicion);
      const r = await fetch("/api/constancia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(resp!.comprobantes[k]) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo generar la constancia");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = `constancia-${posicion + 1}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { fallo(e); }
  }

  function descargar(nombre: string, contenido: string, tipo: string) {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = document.createElement("a");
    a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
  }

  const pasos = ["Cargar", "Revisar", "Firmar", "Prueba"];

  return (
    <main>
      <header className="marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" />
        <div>
          <h1>GALCOA+ en Stellar</h1>
          <p className="lema">Registros que la red se niega a sellar sin la segunda firma.</p>
        </div>
        <span className="etiqueta-red">Red de prueba · sin dinero real</span>
        <a className="enlace-cab" href="/historial">Historial</a>
      </header>

      <section className="vistazo" aria-label="De un vistazo">
        <div><b>Qué se verifica</b><span>Que los datos de cada entrega pasan reglas claras y que no cambiaron desde que se cargaron.</span></div>
        <div><b>Quién lo verifica</b><span>Las reglas del código y dos personas distintas: quien carga y quien aprueba, cada una con su billetera.</span></div>
        <div><b>Qué pasa con el pago</b><span>Con el lote vigente en el registro de Stellar, un contrato de custodia libera un pago de prueba. Si se revoca, no se paga y el dinero vuelve al pagador al vencer el plazo.</span></div>
      </section>

      <ol className="pasos" aria-label="Pasos">
        {pasos.map((p, i) => (
          <li key={p} className={i + 1 < paso ? "hecho" : i + 1 === paso ? "actual" : ""} aria-current={i + 1 === paso ? "step" : undefined}>
            <span className="num">{i + 1 < paso ? "✔" : i + 1}</span> {p}
          </li>
        ))}
      </ol>

      {ocupado && <p className="trabajando" role="status"><span className="spinner" aria-hidden="true" /> {TAREAS[cargando] ?? "Trabajando…"}</p>}
      {error && <p className="error" role="alert">{error} <button className="sec chico" onClick={() => setError("")}>Cerrar</button></p>}
      {aviso && <p className="info" role="status">{aviso}</p>}

      <section className="card" aria-labelledby="h1">
        <h2 id="h1">1. Cargar las entregas</h2>
        <p className="aviso">Subí una planilla (CSV) con un remito por fila. <a href="#plantilla" onClick={(e) => { e.preventDefault(); descargar("plantilla-remitos.csv", PLANTILLA_CSV, "text/csv"); }}>Descargar plantilla</a>. Abajo hay un ejemplo con 7 remitos para probar.</p>
        <p><input type="file" accept=".csv,text/csv" onChange={(e) => cargarPlanilla(e.target.files?.[0])} aria-label="Planilla de remitos en CSV" /></p>
        <details><summary>Ver o editar los datos (avanzado)</summary>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false} aria-label="Datos de los remitos" />
        </details>
        <p><button onClick={revisar} disabled={ocupado}>{cargando === "revisando" ? "Revisando…" : "Revisar qué se va a sellar"}</button></p>
        <p className="aviso">Las reglas de esta demostración (completo, atribuible, consistente, a tiempo, con original y exacto) son un subconjunto del motor completo y no lo reemplazan.</p>
      </section>

      {vista && (
        <section className="card" aria-labelledby="h2">
          <h2 id="h2">2. Qué se va a sellar</h2>
          <div className="cifras">
            <div><b className="verde">{vista.sellan}</b><span>entran al lote</span></div>
            <div><b className={vista.afuera ? "rojo" : ""}>{vista.afuera}</b><span>quedan afuera, a revisión de una persona</span></div>
          </div>
          <table>
            <thead><tr><th scope="col">Remito</th><th scope="col">Estado</th><th scope="col">Qué pasó</th></tr></thead>
            <tbody>
              {vista.documentos.map((d) => (
                <tr key={d.posicion}>
                  <td><b>{d.remito ?? `Documento ${d.posicion + 1}`}</b></td>
                  <td><Pill v={d.veredicto} /></td>
                  <td>{d.avisos.length ? d.avisos.map((a) => a.detalle).join("; ") : "Pasó todas las reglas"}{!d.enLote && " · no se sella"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vista.memo ? <p className="aviso">A la red solo viaja una huella de 32 bytes (<code>{vista.memo}</code>): ningún dato de los documentos ni de las personas.</p> : <p>Ningún documento pasó: no se enviaría nada.</p>}
          {vistaTexto !== texto && <p className="info">Cambiaste los datos: volvé a revisar antes de firmar.</p>}
        </section>
      )}

      {vista && !resp?.sellado && <ConfirmacionComercio texto={texto} setTexto={setTexto} />}

      {vistaVigente && !resp?.sellado && (
        <section className="card" aria-labelledby="h3">
          <h2 id="h3">3. Firmar: aprobación de dos personas</h2>
          <p className="aviso">La cuenta de sellado está configurada en Stellar para <b>no aceptar ningún sello con menos de dos firmas</b>. Una persona firma, la segunda revisa y firma, y recién ahí se envía. El servicio paga la comisión.</p>

          {!xdr2 ? (
            <p><button onClick={preparar2} disabled={ocupado}>{cargando === "preparando" ? "Preparando…" : "Preparar el paquete para firmar"}</button></p>
          ) : (
            <>
              <div className="estado-red" aria-label="Simulación previa">
                <dl><dt>Simulación previa</dt><dd>✔ Hecha por el servidor antes de pedirte la firma: si fallara, no llegarías a este paso.</dd>
                  <dt>Red</dt><dd>Stellar testnet (Test SDF Network)</dd>
                  <dt>Qué vas a firmar</dt><dd>Autorizar un sello de lote con dos firmas (la comisión la paga el servicio)</dd>
                  <dt>Contrato</dt><dd>cuenta de sellado con umbral 2 de 2</dd></dl>
              </div>
              <div className="firmas" aria-live="polite">
                <div className={firmas2.length >= 1 ? "firma ok" : "firma"}><span>{firmas2.length >= 1 ? "✔" : "1"}</span> Primera persona{firmas2[0] ? ` · ${corta(firmas2[0])}` : ""}</div>
                <div className={firmas2.length >= 2 ? "firma ok" : "firma"}><span>{firmas2.length >= 2 ? "✔" : "2"}</span> Segunda persona{firmas2[1] ? ` · ${corta(firmas2[1])}` : ""}</div>
              </div>
              {demo && (
                <p className="demo"><b>Modo demostración</b> (claves de prueba del servidor, no son personas reales)<br />
                  <button className="sec" onClick={() => firmarDemo("cargador")} disabled={ocupado}>Firmar como cargador</button>{" "}
                  <button className="sec" onClick={() => firmarDemo("aprobador")} disabled={ocupado}>Firmar como aprobador</button></p>
              )}
              <details open={!demo}><summary>Firmar con mi billetera</summary>
                <p><label>Mi cuenta: <input value={cuenta} onChange={(e) => setCuenta(e.target.value.trim())} placeholder="G…" size={50} spellCheck={false} /></label>{" "}
                  <button className="sec" onClick={() => conectar("extension")} disabled={ocupado}>Conectar Varial (navegador)</button>{" "}
                  <button className="sec" onClick={() => conectar("celular")} disabled={ocupado}>Conectar Varial del celular</button></p>
                <p><button className="sec" onClick={firmarConBilletera} disabled={ocupado || !cuenta}>Firmar con Varial</button>
                  <span className="aviso"> Para la segunda persona, cambiá de cuenta en Varial y firmá de nuevo, o pasale el paquete.</span></p>
                <details><summary>Paquete para firmar (se puede copiar y pasar a la otra persona)</summary>
                  <textarea value={xdr2} onChange={(e) => setXdr2(e.target.value.trim())} spellCheck={false} aria-label="Paquete para firmar" />
                </details>
              </details>
              <p><button onClick={enviar2} disabled={ocupado}>{cargando === "enviando" ? "Enviando a Stellar… (unos 10 s)" : "Enviar con las dos firmas"}</button>
                {firmas2.length < 2 && <span className="aviso"> Con menos de dos firmas, Stellar lo rechaza.</span>}</p>
            </>
          )}

          <details><summary>Alternativa de prototipo: una sola persona confirma</summary>
            <p className="aviso">Firmás un mensaje que nombra la huella exacta del lote. Solo pueden confirmar las cuentas autorizadas y quien confirma no puede haber cargado los documentos.</p>
            <p><label>Mi cuenta: <input value={cuenta} onChange={(e) => setCuenta(e.target.value.trim())} placeholder="G…" size={50} spellCheck={false} /></label>{" "}
              <button className="sec" onClick={ingresar} disabled={ocupado || !cuenta}>Ingresar (firmar)</button>{yo && <> · Ingresaste como <b>{yo.identidad}</b></>}</p>
            <p><button className="sec" onClick={firmarYSellarUna} disabled={ocupado || !cuenta}>Firmar y sellar</button></p>
            <details><summary>Firmar a mano (otra billetera)</summary>
              <p><button className="sec" onClick={() => pedirMensaje().catch(fallo)} disabled={ocupado || !cuenta}>Pedir mensaje a firmar</button></p>
              {pendiente && <><pre style={{ whiteSpace: "pre-wrap" }}>{pendiente.mensaje}</pre>
                <p><input aria-label="Firma en base64" value={firmaManual} onChange={(e) => setFirmaManual(e.target.value.trim())} placeholder="Firma en base64" size={60} spellCheck={false} />{" "}
                  <button className="sec" onClick={() => sellarUnaFirma(pendiente, firmaManual)} disabled={ocupado || !firmaManual}>Sellar con esta firma</button></p></>}
            </details>
          </details>
        </section>
      )}

      {resp && (
        <section className="card ok-card" aria-labelledby="h4">
          <h2 id="h4">4. Prueba</h2>
          {resp.sellado ? (
            <>
              <p className="gran"><span className="verde">✔</span> {resp.sellado.cantidadHojas} documento(s) sellados con una sola transacción (ledger {resp.sellado.ledger}).</p>
              {resp.firmadoPor && <p>Aprobado por {Array.isArray(resp.firmadoPor) ? resp.firmadoPor.map(corta).join(" + ") : corta(resp.firmadoPor)}.{resp.comisionPagadaPor && " La comisión la pagó el servicio."}</p>}
              <p><a href={resp.explorador ?? "#"} target="_blank" rel="noreferrer">Ver la transacción en el explorador</a></p>
              <div className="estado-red" aria-label="Estado en la red">
                <h3>Estado en la red</h3>
                <dl>
                  <dt>Red</dt><dd>Stellar testnet (sin dinero real)</dd>
                  <dt>Huella del lote</dt><dd><code>{resp.sellado.memo}</code></dd>
                  <dt>Registro</dt><dd><a href={`https://stellar.expert/explorer/testnet/contract/${CONTRATO_REGISTRO}`} target="_blank" rel="noreferrer">contrato de registro</a> · escrow: <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRATO_ESCROW}`} target="_blank" rel="noreferrer">contrato de custodia</a></dd>
                  <dt>Roles</dt><dd>cargador y aprobador deben ser cuentas distintas; el servicio autoriza y paga la comisión</dd>
                  <dt>Consecuencia económica</dt><dd>con la huella vigente en el registro, el escrow puede liberar un pago de prueba; si se revoca, no se paga</dd>
                  <dt>Vida del dato</dt><dd>la vigencia se extiende al escribir y cualquiera puede renovarla; si la red lo archiva, se restaura y se verifica de nuevo</dd>
                </dl>
              </div>
              <p>
                <button onClick={() => descargar(`galcoa-lote-${resp.sellado!.txHash.slice(0, 8)}.json`, JSON.stringify(resp.archivo, null, 2), "application/json")}>Descargar el archivo del lote</button>{" "}
                <a href="/verificar" target="_blank" rel="noopener">Abrir el verificador</a>
              </p>
              <p className="aviso">Guardá el archivo: lleva la transacción firmada y la hora del ledger, así la prueba se puede revisar aunque la red olvide el historial.</p>
              {demo && (
                <p className="demo">Modo demostración: <button className="sec" onClick={registrarContrato} disabled={ocupado || !!contrato}>{cargando === "contrato" ? "Registrando…" : "Registrar también en el contrato"}</button>
                  {contrato && <> ✔ Registrado en el contrato (ledger {contrato.ledger}, comisión {(contrato.comisionStroops / 1e7).toFixed(4)} XLM)</>}</p>
              )}
              <details><summary>Registrar también en el contrato con las billeteras de las dos personas</summary>
                <p className="aviso">La red exige la autorización de dos cuentas distintas. Cada persona firma la suya con Varial; el servicio paga la comisión. (Necesita Varial reciente; en modo demostración usá el botón de arriba.)</p>
                <p><label>Cargador (mi cuenta): <input value={cuenta} onChange={(e) => setCuenta(e.target.value.trim())} placeholder="G…" size={50} spellCheck={false} /></label></p>
                <p><label>Aprobador: <input value={cuentaAprobador} onChange={(e) => setCuentaAprobador(e.target.value.trim())} placeholder="G…" size={50} spellCheck={false} /></label></p>
                {!paqueteC ? (
                  <p><button className="sec" onClick={prepararContrato} disabled={ocupado || !cuenta || !cuentaAprobador}>{cargando === "contrato-prep" ? "Preparando…" : "Preparar el registro"}</button></p>
                ) : (
                  <>
                    <div className="estado-red" aria-label="Simulación previa">
                <dl><dt>Simulación previa</dt><dd>✔ Hecha por el servidor antes de pedirte la firma: si fallara, no llegarías a este paso.</dd>
                  <dt>Red</dt><dd>Stellar testnet (Test SDF Network)</dd>
                  <dt>Qué vas a firmar</dt><dd>Autorizar el registro de la huella del lote en el contrato (cada persona firma su autorización)</dd>
                  <dt>Contrato</dt><dd><a href={`https://stellar.expert/explorer/testnet/contract/${CONTRATO_REGISTRO}`} target="_blank" rel="noreferrer">{corta(CONTRATO_REGISTRO)}</a></dd></dl>
              </div>
                    <div className="firmas" aria-live="polite">
                      {paqueteC.porFirmar.map((x) => { const ya = firmasC.some((y) => y.cuenta === x.cuenta); return <div key={x.cuenta} className={ya ? "firma ok" : "firma"}><span>{ya ? "✔" : "…"}</span> {corta(x.cuenta)}</div>; })}
                    </div>
                    <p><button className="sec" onClick={firmarContrato} disabled={ocupado}>Firmar con Varial (cuenta conectada)</button>{" "}
                      <button onClick={enviarContrato} disabled={ocupado || firmasC.length < 2 || !!contrato}>{cargando === "contrato" ? "Registrando…" : "Registrar con las dos firmas"}</button></p>
                    <p className="aviso">Para la segunda persona: cambiá de cuenta en Varial, poné su cuenta arriba y volvé a firmar.</p>
                  </>
                )}
                {contrato && <p>✔ Registrado en el contrato (ledger {contrato.ledger}, comisión {(contrato.comisionStroops / 1e7).toFixed(4)} XLM)</p>}
              </details>
            </>
          ) : <p>Ningún documento pasó la verificación: no se envió nada a la red.</p>}
          <details><summary>Detalle por documento</summary>
            <table>
              <thead><tr><th scope="col">#</th><th scope="col">Estado</th><th scope="col">Reglas</th><th scope="col">Sellado</th></tr></thead>
              <tbody>
                {resp.resultados.map((r) => (
                  <tr key={r.posicion}>
                    <td>{r.posicion + 1}</td><td><Pill v={r.veredicto} /></td>
                    <td>{r.reglas.map((x) => `${x.id}: ${x.detalle}`).join(" · ")}</td>
                    <td>{r.enLote ? <>sí<br /><button className="sec chico" onClick={() => descargarConstancia(r.posicion)} disabled={ocupado}>Constancia PDF</button></> : "no (revisión)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}

      <p className="aviso pie">¿Ya tenés un comprobante? <a href="/verificar">Verificalo acá</a> · <a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a> · Cuentas oficiales: <a href="/.well-known/stellar.toml">stellar.toml</a> · Esta herramienta verifica coherencia, atribución y que lo declarado no cambió; no comprueba que la mercadería exista.</p>
    </main>
  );
}
