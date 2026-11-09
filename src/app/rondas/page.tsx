"use client";

import { useState } from "react";

type Creada = { id: string; enlaces: Record<string, string>; vence: string };
type Resumen = { estado: string; requeridos: number; confirmaron: number; rechazaron: number; faltan: string[]; detalle: { rol: string; estado: string; nombre?: string; sinEnlace?: boolean }[] };
const pase = () => { try { return sessionStorage.getItem("galcoa-pase") ?? ""; } catch { return ""; } };
const hoy = () => new Date().toISOString().slice(0, 10);
const ESTADOS: Record<string, string> = { pendiente: "Esperando confirmaciones", completa: "Todos confirmaron los mismos datos", rechazada: "Alguien avisó que no coincide", vencida: "Venció sin completarse" };

/** La distribuidora pide a cada participante (proveedor, comprador, transportista) que confirme los mismos datos por un enlace privado. */
export default function Rondas() {
  const [f, setF] = useState({ remito: "", producto: "", unidad: "cajas", cantidadPedida: "", cantidadRecibida: "", fechaEntrega: hoy(), observacion: "" });
  const [transporte, setTransporte] = useState(false);
  const [creada, setCreada] = useState<Creada | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const cab = () => ({ "content-type": "application/json", "x-pase": pase() });

  async function crear() {
    setOcupado(true); setError(""); setCreada(null); setResumen(null);
    try {
      const documento = { ...f, cantidadPedida: Number(f.cantidadPedida), cantidadRecibida: Number(f.cantidadRecibida), observacion: f.observacion || undefined, fechaRegistro: hoy(), cargadoPor: "distribuidora", confirmadoPor: "ronda-de-confirmacion" };
      const roles = transporte ? ["proveedor", "comprador", "transportista"] : ["proveedor", "comprador"];
      const r = await fetch("/api/rondas", { method: "POST", headers: cab(), body: JSON.stringify({ documento, roles }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setCreada(j);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear"); }
    setOcupado(false);
  }
  async function actualizar() {
    if (!creada) return;
    setError("");
    const r = await fetch(`/api/rondas/${creada.id}`, { headers: { "x-pase": pase() } });
    const j = await r.json();
    if (!r.ok) setError(j.error); else setResumen(j);
  }
  const campo = (k: keyof typeof f, rotulo: string, tipo = "text", ejemplo?: string) => (
    <p><label>{rotulo}: <input type={tipo} value={f[k]} placeholder={ejemplo} inputMode={tipo === "number" ? "numeric" : undefined} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label></p>
  );
  const completo = f.remito && f.producto && f.cantidadPedida && f.cantidadRecibida;

  return (
    <main>
      <header className="marca"><div><h1>Pedir confirmaciones</h1><p className="lema">Cada participante confirma los mismos datos desde su enlace, sin crear cuenta.</p></div></header>
      {error && <p className="error" role="alert">{error}</p>}
      {!creada && (
        <section className="card">
          <h2>Datos de la entrega</h2>
          {campo("remito", "Remito", "text", "Ej.: A-0012")}{campo("producto", "Producto", "text", "Ej.: Aceite de girasol 900 ml")}{campo("unidad", "Tipo de envase", "text", "Ej.: cajas, bidones, pallets")}
          {campo("cantidadPedida", "Cantidad pedida (número)", "number", "Ej.: 10")}{campo("cantidadRecibida", "Cantidad recibida (número)", "number", "Ej.: 8")}
          {campo("fechaEntrega", "Fecha de entrega", "date")}{campo("observacion", "Observación (si hubo diferencia)", "text", "Ej.: faltaron 2 cajas")}
          <p><label><input type="checkbox" checked={transporte} onChange={(e) => setTransporte(e.target.checked)} /> Sumar al transportista (opcional)</label></p>
          <p className="aviso">Proveedor y comprador siempre confirman. Se necesita haber ingresado con la billetera (o estar en modo demostración).</p>
          <button type="button" onClick={crear} disabled={ocupado || !completo}>Crear los enlaces</button>
        </section>
      )}
      {creada && (
        <section className="card">
          <h2>Enlaces privados</h2>
          <p className="aviso">Se muestran <b>una sola vez</b>: copialos ahora y mandá cada uno a su persona. Vencen el {new Date(creada.vence).toLocaleDateString("es-AR")}.</p>
          <ul className="puntos">
            {Object.entries(creada.enlaces).map(([rol, e]) => (
              <li key={rol}><b>{rol}</b>: <input readOnly size={50} value={`${location.origin}${e}`} onFocus={(ev) => ev.currentTarget.select()} /> <a className="boton sec" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Hola, confirmá por favor los datos de la entrega (remito ${f.remito}) en este enlace: ${location.origin}${e}`)}`}>Mandar por WhatsApp</a></li>
            ))}
          </ul>
          <p><button type="button" className="sec" onClick={actualizar}>Ver quién confirmó</button></p>
          {resumen && (
            <>
              <p className={resumen.estado === "completa" ? "gran verde" : resumen.estado === "rechazada" ? "gran amarillo" : "info"}>{ESTADOS[resumen.estado] ?? resumen.estado} ({resumen.confirmaron} de {resumen.requeridos})</p>
              <ul className="puntos">
                {resumen.detalle.map((d) => <li key={d.rol}>{d.rol}: {d.estado === "pendiente" ? "todavía no respondió" : d.estado === "confirmada" ? `declaró que coincide${d.nombre ? ` (${d.nombre})` : ""}` : `avisó que no coincide${d.nombre ? ` (${d.nombre})` : ""}`}</li>)}
              </ul>
            </>
          )}
          <p className="aviso">Cada persona declara lo que vio; GALCOA+ no verifica quién es ni que la mercadería exista.</p>
        </section>
      )}
    </main>
  );
}
