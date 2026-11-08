import { leerIdioma } from "@/lib/i18n/idioma";
import { TEXTOS } from "@/lib/i18n/textos";
import { LogoGalcoa } from "@/app/logos";

const REPO = "https://github.com/GALCOA-Stellar/galcoa-stellar";

export async function generateMetadata() {
  return { title: TEXTOS[await leerIdioma()].dev.titulo };
}

/** Portada para quienes construyen en Stellar. Dice con honestidad qué hay hoy y qué es hipótesis. */
export default async function Desarrolladores() {
  const idioma = await leerIdioma();
  const T = TEXTOS[idioma].dev;
  return (
    <main>
      <header className="marca">
        <LogoGalcoa />
        <div><h1>{T.h1}</h1><p className="lema">{T.lema}</p></div>
        <span className="etiqueta-red">{T.etiqueta}</span>
      </header>

      <section className="card">
        <h2>{T.h2Da}</h2>
        <ul className="puntos">
          {T.da.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>

      <section className="card">
        <h2>{T.h2Prueba}</h2>
        <ol className="puntos">
          <li><a href="/agentes">{T.prueba[0]}</a></li>
          <li><a href="/evidencia">{T.prueba[1]}</a></li>
          <li><a href="/demo">{T.prueba[2]}</a> · <a href="/verificar">/verificar</a></li>
          <li><a href={REPO} target="_blank" rel="noreferrer">{T.prueba[3]}</a></li>
        </ol>
      </section>

      <section className="card">
        <h2>{T.h2Estado}</h2>
        <p className="aviso">{T.estado}</p>
      </section>

      <p className="aviso pie"><a href="/">{T.inicio}</a> · <a href="/privacidad">{idioma === "en" ? "Privacy" : "Privacidad"}</a> · <a href="/terminos">{idioma === "en" ? "Terms" : "Términos"}</a> · <a href="/spec">Spec</a></p>
    </main>
  );
}
