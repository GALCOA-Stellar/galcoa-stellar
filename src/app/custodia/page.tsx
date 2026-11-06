// Pantalla pública de la custodia (escrow): muestra, leyendo de la red, que el pago es consecuencia del estado del lote.
import { leerEstadoVivo, ESCROW_ID, REGISTRO_ID } from "@/lib/estado-vivo";
import { listarEventosCustodia } from "@/lib/contrato";

export const metadata = { title: "Custodia del pago · GALCOA+ en Stellar" };
const EXP = "https://stellar.expert/explorer/testnet";
const corta = (g: string) => `${g.slice(0, 8)}…${g.slice(-6)}`;
const TEXTO = {
  depositado: "Depósito: el pagador deja el pago de prueba en custodia, atado a la huella de un lote.",
  liberado: "Pago liberado: el contrato consultó al registro, el lote figuraba vigente y el pago llegó al beneficiario.",
  reembolsado: "Reembolso: el lote se revocó o venció el plazo, no se pagó y el dinero volvió al pagador.",
} as const;

export default async function Custodia() {
  const [vivo, eventos] = await Promise.all([leerEstadoVivo(), listarEventosCustodia()]);
  const lista = eventos ? [...eventos].reverse() : null;
  return (
    <main>
      <div className="marca"><a className="enlace-cab" href="/">Volver</a></div>
      <h1>El pago es la consecuencia del estado del lote</h1>
      <p className="sub">La custodia no decide nada por su cuenta: antes de pagar le pregunta al contrato de registro si el lote sigue vigente. Si se revocó, no paga y el dinero vuelve. Todo en la red de prueba de Stellar, con activos de prueba, sin dinero real.</p>

      <section className="card">
        <h2>Cómo se encadena</h2>
        <ol>
          <li><b>Lote vigente</b> en el contrato de registro (dos personas distintas lo firmaron).</li>
          <li><b>Depósito</b> en la custodia, atado a la huella de ese lote.</li>
          <li><b>Liberación:</b> la custodia llama al registro (<code>existe</code>). Si el lote está vigente, paga. Si fue revocado, se niega y el depósito se puede reembolsar.</li>
        </ol>
        <p className="aviso">Un depósito se liquida una sola vez. Solo se guardan huellas y montos de prueba: ningún documento ni dato personal.</p>
      </section>

      <section className="card">
        <h2>Estado ahora, leído de la red</h2>
        {vivo ? (
          <dl className="estado-red">
            <dt>Ledger actual</dt><dd>{vivo.ledger}</dd>
            <dt>Contrato de custodia</dt><dd><a href={`${EXP}/contract/${ESCROW_ID}`}>{corta(ESCROW_ID)}</a></dd>
            <dt>Consulta al registro</dt><dd>{vivo.escrowApuntaAlRegistro === null ? "no se pudo leer" : vivo.escrowApuntaAlRegistro ? <>✔ apunta al <a href={`${EXP}/contract/${REGISTRO_ID}`}>contrato de registro</a></> : "✖ apunta a otro contrato"}</dd>
            <dt>Pausa de emergencia</dt><dd>{vivo.escrowPausado === null ? "no se pudo leer" : vivo.escrowPausado ? "▲ en pausa" : "✔ activa (no está en pausa)"}</dd>
          </dl>
        ) : <p className="aviso">No se pudo leer la red en este momento. Recargá en unos segundos.</p>}
      </section>

      <section className="card">
        <h2>Movimientos (eventos del contrato)</h2>
        {lista === null ? <p className="aviso">No se pudieron leer los eventos ahora. La red conserva unos 7 días de eventos; recargá en unos segundos.</p>
          : lista.length === 0 ? <p className="aviso">No hay movimientos en los eventos recientes (la red conserva unos 7 días).</p>
          : (
            <ul className="puntos">
              {lista.map((e) => (
                <li key={e.tx + e.accion}>
                  <b>{e.accion === "liberado" ? "✔ Liberado" : e.accion === "reembolsado" ? "↩ Reembolsado" : "● Depositado"}</b> · ledger {e.ledger} · lote <code>{e.huella.slice(0, 12)}…</code> · <a href={`${EXP}/tx/${e.tx}`}>ver transacción</a>
                  <br /><span className="aviso">{TEXTO[e.accion]}</span>
                </li>
              ))}
            </ul>
          )}
        <p className="aviso">Los montos son de un activo de prueba. Esta pantalla solo lee de la red: ninguna acción se ejecuta desde acá. Cómo leer los mismos eventos con tu propio nodo: <a href="/spec">guía</a>.</p>
      </section>
      <p className="aviso pie"><a href="/verificar">Verificar un comprobante</a> · <a href="/demo">Herramienta</a></p>
    </main>
  );
}
