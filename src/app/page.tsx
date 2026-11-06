// Portada pública de GALCOA+ en Stellar. Texto fijo, sin datos personales ni scripts propios.
const REGISTRO = "CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV";
const ESCROW = "CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6";
const EXPLORADOR = "https://stellar.expert/explorer/testnet/contract/";

import { leerEstadoVivo, LOTE_EJEMPLO } from "@/lib/estado-vivo";

const corta = (g?: string) => (g ? `${g.slice(0, 6)}…${g.slice(-4)}` : "—");

export default async function Portada() {
  const vivo = await leerEstadoVivo();
  return (
    <>
      <header className="portada-cab">
        <div className="portada-marcas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" />
          <span className="sello-red" aria-label="Construido sobre Stellar">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="logo-stellar" src="/stellar-logo.svg" alt="" aria-hidden="true" /> Stellar</span>
        </div>
        <a className="portada-ingresar" href="/demo">Ingresar</a>
      </header>

      <main className="portada">
        <section className="heroe">
          <h1>Comprobantes comerciales verificables que pueden gatillar pagos de prueba en Stellar Testnet.</h1>
          <p className="sub">
            GALCOA+ registra huellas y estados de comprobantes B2B en Stellar Testnet, sin publicar documentos ni datos personales, y permite verificarlos sin depender de nuestro servidor.
          </p>
          <div className="acciones">
            <a className="boton" href="/demo">Ver la demo</a>
            <a className="boton sec" href="/verificar">Verificar un comprobante</a>
          </div>
          <div className="cifras">
            <div><b>2</b><span>contratos en Testnet</span></div>
            <div><b>12</b><span>lotes registrados</span></div>
            <div><b>5</b><span>verificaciones con el verificador independiente</span></div>
            <div><b>2</b><span>flujos de custodia de prueba</span></div>
          </div>
          {vivo && (
            <p className="estado-red" aria-label="Prueba en vivo">
              <b>En vivo:</b> ledger {vivo.ledger} · contrato <a href={EXPLORADOR + REGISTRO}>{corta(REGISTRO)}</a> · lote de ejemplo: {vivo.lote?.estado === "vigente" ? "✔ vigente" : vivo.lote ? vivo.lote.estado : "sin dato"} · <a href="/verificar">Verificar ahora</a>
            </p>
          )}
          <p className="aviso">Datos de prueba medidos por GALCOA+ al 06/11/2026. Stellar Testnet, sin dinero real.</p>
        </section>

        <section className="bloque">
          <h2>Qué puede comprobar hoy un tercero</h2>
          <p>Un tercero puede comprobar el estado del comprobante, verificar que su huella coincide y leer los eventos del contrato. Con el verificador público y cualquier nodo de Stellar no se usa infraestructura de GALCOA+; la página de verificación web es una comodidad que sí pasa por nuestro servidor.</p>
          <div className="acciones">
            <a className="boton sec" href="/verificar">Probar verificación</a>
            <a className="boton sec" href={EXPLORADOR + REGISTRO}>Ver contrato</a>
            <a className="boton sec" href="/spec#eventos">Ver eventos</a>
            <a className="boton sec" href="/custodia">Ver la custodia de prueba</a>
          </div>
        </section>

        <section className="bloque">
          <h2>Cómo funciona</h2>
          <ol className="pasos-portada">
            <li><b>Se valida fuera de cadena</b><span>El sistema prepara el comprobante y una persona decide si aprobarlo. <small>La IA no decide el veredicto: lo deciden reglas fijas y una persona.</small></span></li>
            <li><b>Se registra en Stellar Testnet</b><span>El contrato exige la autorización de dos cuentas distintas (quien carga y quien aprueba) y guarda la huella y el estado del lote.</span></li>
            <li><b>Un tercero lo verifica</b><span>Un tercero puede verificar el comprobante sin depender de nuestro servidor, consultando a la red con la huella esperada.</span></li>
            <li><b>La custodia de prueba reacciona al estado</b><span>La custodia de prueba consulta ese estado y solo permite ejecutar un pago de prueba si el lote figura verificado; si se revoca, la ejecución no corresponde.</span></li>
          </ol>
          <p className="aviso">Esto detecta cambios en el contenido; no prueba que la mercadería exista.</p>
        </section>

        <section className="bloque">
          <h2>Por qué no es una base de datos</h2>
          <p>No usamos Stellar para guardar documentos. Usamos Stellar para publicar un estado verificable por terceros y para que otro contrato pueda tomar una acción económica de prueba basada en ese estado.</p>
          <p className="aviso">En cadena quedan solo huellas, estados, cuentas y eventos; nunca documentos ni datos personales. En una frase: GALCOA+ convierte una validación comercial en una condición económica verificable sobre Stellar.</p>
        </section>

        <section className="bloque" aria-label="Estado en vivo">
          <h2>Estado en vivo en Stellar</h2>
          <p className="aviso">Estado leído de la red al cargar la página: red y ledger actuales, lote de ejemplo, estado, cuentas intervinientes, custodia asociada y enlaces al explorador, la transacción y la guía de verificación.</p>
          {vivo ? (
            <div className="estado-red">
              <dl>
                <dt>Red</dt><dd>Stellar testnet · ledger {vivo.ledger}</dd>
                <dt>Lote de ejemplo</dt><dd><code>{LOTE_EJEMPLO}</code></dd>
                <dt>Verificarlo afuera</dt><dd><a href={`https://stellar.expert/explorer/testnet/contract/${REGISTRO}`}>contrato en el explorador</a> · <a href="https://stellar.expert/explorer/testnet/tx/f33407d7bbed6a8e0ca376b42a474c810c7b6364521c677d53712196f9d0a2d4">transacción del registro</a> · <a href="/spec">guía para leerlo con tu propio nodo</a> · <a href="/custodia">pantalla de la custodia del pago</a></dd>
                <dt>Estado</dt><dd>{vivo.lote ? (vivo.lote.estado === "vigente" ? "✔ vigente en el registro" : vivo.lote.estado === "revocado" ? "revocado" : vivo.lote.estado === "archivado" ? "archivado: hay que restaurarlo" : "no figura (la testnet pudo reiniciarse)") : "no se pudo consultar ahora"}</dd>
                <dt>Quién cargó / quién aprobó</dt><dd>{vivo.lote?.cargador ? `${corta(vivo.lote.cargador)} / ${corta(vivo.lote.aprobador)} (cuentas distintas)` : "—"}</dd>
                <dt>Custodia (escrow)</dt><dd>{vivo.escrowApuntaAlRegistro === null ? "sin dato" : vivo.escrowApuntaAlRegistro ? "consulta a este registro antes de pagar" : "no apunta a este registro"}{vivo.escrowPausado === null ? "" : vivo.escrowPausado ? " · depósitos pausados" : " · depósitos habilitados"}</dd>
                <dt>Qué se desbloquea</dt><dd>con el lote vigente, el escrow puede liberar un pago de prueba; si se revoca, no se paga y el dinero vuelve al pagador al vencer el plazo</dd>
              </dl>
            </div>
          ) : (
            <p className="aviso">No pudimos consultar la red en este momento. Mirá los contratos directamente en el explorador (abajo).</p>
          )}
        </section>

        <section className="bloque">
          <h2>Cómo verificarlo vos</h2>
          <ol className="pasos-portada">
            <li><b>Descargá el comprobante</b><span>Un archivo JSON con el contenido y su huella.</span></li>
            <li><b>Corré el verificador público</b><span>Si cambia un solo dato, deja de coincidir.</span></li>
            <li><b>Consultá a la red</b><span>Si el lote sigue vigente y qué cuentas intervinieron.</span></li>
          </ol>
          <div className="acciones">
            <a className="boton sec" href="/spec">Ver la guía y descargar el ejemplo</a>
          </div>
        </section>

        <section className="bloque">
          <h2>Estado actual y límites</h2>
          <ul className="puntos">
            <li>Prototipo en Testnet: pagos de prueba, sin Mainnet y sin auditoría externa.</li>
            <li>La demo incluye un modo demostración avisado en pantalla con cuentas de prueba; no reemplaza la validación con dos personas reales y dos billeteras, que es el siguiente hito.</li>
            <li>No reemplaza una auditoría ni dice que algo “cumple” una norma.</li>
          </ul>
        </section>

        <p className="aviso pie">
          <a href="/privacidad">Privacidad</a> · Proyecto independiente que usa la red Stellar; no cuenta con respaldo oficial de la Stellar Development Foundation.
        </p>
      </main>
    </>
  );
}
