import type { ReactNode } from "react";
import { ETIQUETA, type Resultado, type Veredicto, type Vista } from "./datos";

export const Pill = ({ v }: { v: Veredicto }) => <span className={`pill ${v}`}>{ETIQUETA[v].icono} {ETIQUETA[v].texto}</span>;

/** Paso 2: qué entra al lote y qué queda afuera. */
export function VistaPrevia({ vista, desactualizada }: { vista: Vista; desactualizada: boolean }): ReactNode {
  return (
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
      {desactualizada && <p className="info">Cambiaste los datos: volvé a revisar antes de firmar.</p>}
    </section>
  );
}

/** Paso 4: detalle de cada documento, con su constancia en PDF. */
export function DetalleResultados({ resultados, ocupado, alConstancia }: { resultados: Resultado[]; ocupado: boolean; alConstancia: (posicion: number) => void }): ReactNode {
  return (
    <details><summary>Detalle por documento</summary>
      <table>
        <thead><tr><th scope="col">#</th><th scope="col">Estado</th><th scope="col">Reglas</th><th scope="col">Sellado</th></tr></thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.posicion}>
              <td>{r.posicion + 1}</td><td><Pill v={r.veredicto} /></td>
              <td>{r.reglas.map((x) => `${x.id}: ${x.detalle}`).join(" · ")}</td>
              <td>{r.enLote ? <>sí<br /><button type="button" className="sec chico" onClick={() => alConstancia(r.posicion)} disabled={ocupado}>Constancia PDF</button></> : "no (revisión)"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
