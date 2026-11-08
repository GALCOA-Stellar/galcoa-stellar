// Portada pública de GALCOA+ en Stellar. Texto fijo, sin datos personales ni scripts propios.
import { leerIdioma } from "@/lib/i18n/idioma";
import { TEXTOS } from "@/lib/i18n/textos";
import { leerEstadoVivo } from "@/lib/stellar/estado-vivo";
import { REGISTRO_ID as REGISTRO, LOTE_EJEMPLO, EXPLORADOR_CONTRATO as EXPLORADOR } from "@/lib/config/contratos";
import { LogoGalcoa, LogoStellar } from "@/app/logos";

const corta = (g?: string) => (g ? `${g.slice(0, 6)}…${g.slice(-4)}` : "—");

export default async function Portada() {
  const vivo = await leerEstadoVivo();
  const T = TEXTOS[await leerIdioma()].portada;
  const REPO = "https://github.com/GALCOA-Stellar/galcoa-stellar";
  return (
    <>
      <header className="portada-cab">
        <div className="portada-marcas">
          <LogoGalcoa />
          <span className="sello-red" role="img" aria-label={T.sello}><LogoStellar /> Stellar</span>
        </div>
        <a className="portada-ingresar" href={REPO} target="_blank" rel="noreferrer">GitHub</a>
        <a className="portada-ingresar" href="/demo">{T.demo}</a>
      </header>

      <main className="portada">
        <section className="heroe">
          <h1>{T.h1}</h1>
          <p className="sub">{T.sub1}</p>
          <p className="sub">{T.sub2}</p>
          <div className="acciones">
            <a className="boton" href="/rondas">{T.acciones[0]}</a>
            <a className="boton sec" href="/agentes">{T.acciones[1]}</a>
            <a className="boton sec" href={`/lote/${LOTE_EJEMPLO}`}>{T.acciones[2]}</a>
            <a className="boton sec" href="/verificar">{T.acciones[3]}</a>
          </div>
          <div className="cifras">
            <div><b>2</b><span>{T.cifras[0]}</span></div>
            <div><b>12</b><span>{T.cifras[1]}</span></div>
            <div><b>5</b><span>{T.cifras[2]}</span></div>
            <div><b>2</b><span>{T.cifras[3]}</span></div>
          </div>
          {vivo && (
            <p className="estado-red">
              <b>{T.enVivo}</b> {T.registro} {vivo.ledger} · {T.contrato} <a href={EXPLORADOR + REGISTRO}>{corta(REGISTRO)}</a> · {T.loteEjemplo} {vivo.lote?.estado === "vigente" ? T.vigente : vivo.lote ? vivo.lote.estado : T.sinDato} · <a href="/verificar">{T.verificarAhora}</a>
            </p>
          )}
          <p className="aviso">{T.avisoDatos}</p>
        </section>

        <section className="bloque">
          <h2>{T.h2Tercero}</h2>
          <p>{T.pTercero}</p>
          <div className="acciones">
            <a className="boton sec" href="/verificar">{T.btnTercero[0]}</a>
            <a className="boton sec" href={EXPLORADOR + REGISTRO}>{T.btnTercero[1]}</a>
            <a className="boton sec" href="/spec#eventos">{T.btnTercero[2]}</a>
            <a className="boton sec" href="/custodia">{T.btnTercero[3]}</a>
          </div>
        </section>

        <section className="bloque">
          <h2>{T.h2Como}</h2>
          <ol className="pasos-portada">
            {T.pasos.map(([titulo, texto]) => <li key={titulo}><b>{titulo}</b><span>{texto}</span></li>)}
          </ol>
          <p className="aviso">{T.avisoPasos}</p>
        </section>

        <section className="bloque">
          <h2>{T.h2NoBase}</h2>
          <p>{T.pNoBase}</p>
          <p className="aviso">{T.avisoNoBase}</p>
        </section>

        <section className="bloque" aria-label="Estado en vivo">
          <h2>{T.h2Vivo}</h2>
          <p className="aviso">{T.avisoVivo}</p>
          {vivo ? (
            <div className="estado-red">
              <dl>
                <dt>{T.red}</dt><dd>Stellar testnet · ledger {vivo.ledger}</dd>
                <dt>{T.loteEjemplo.replace(":", "")}</dt><dd><code>{LOTE_EJEMPLO}</code></dd>
                <dt>{T.verAfuera}</dt><dd><a href={`https://stellar.expert/explorer/testnet/contract/${REGISTRO}`}>{T.contratoExplorador}</a> · <a href="https://stellar.expert/explorer/testnet/tx/f33407d7bbed6a8e0ca376b42a474c810c7b6364521c677d53712196f9d0a2d4">{T.txRegistro}</a> · <a href="/spec">{T.guiaNodo}</a> · <a href="/custodia">{T.pantallaCustodia}</a></dd>
                <dt>{T.estado}</dt><dd>{vivo.lote ? (vivo.lote.estado === "vigente" ? T.estadoVigente : vivo.lote.estado === "revocado" ? T.estadoRevocado : vivo.lote.estado === "archivado" ? T.estadoArchivado : T.estadoNoFigura) : T.estadoNoConsulta}</dd>
                <dt>{T.quien}</dt><dd>{vivo.lote?.cargador ? `${corta(vivo.lote.cargador)} / ${corta(vivo.lote.aprobador)} ({T.cuentasDistintas})` : "—"}</dd>
                <dt>{T.custodia}</dt><dd>{vivo.escrowApuntaAlRegistro === null ? T.sinDato : vivo.escrowApuntaAlRegistro ? T.custodiaApunta : T.custodiaNoApunta}{vivo.escrowPausado === null ? "" : vivo.escrowPausado ? T.depPausados : T.depHabilitados}</dd>
                <dt>{T.desbloquea}</dt><dd>{T.desbloqueaTexto}</dd>
              </dl>
            </div>
          ) : (
            <p className="aviso">{T.noRed}</p>
          )}
        </section>

        <section className="bloque">
          <h2>{T.h2Verificar}</h2>
          <ol className="pasos-portada">
            {T.pasosVerificar.map(([titulo, texto]) => <li key={titulo}><b>{titulo}</b><span>{texto}</span></li>)}
          </ol>
          <div className="acciones">
            <a className="boton sec" href="/spec">{T.btnGuia}</a>
          </div>
        </section>

        <section className="bloque">
          <h2>{T.h2Limites}</h2>
          <ul className="puntos">
            {T.limites.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>

        <p className="aviso pie">
          <a href="/privacidad">{T.privacidad}</a> · <a href="/terminos">{T.terminos}</a> · <a href={REPO} target="_blank" rel="noreferrer">GitHub</a> · {T.pie}
        </p>
      </main>
    </>
  );
}
