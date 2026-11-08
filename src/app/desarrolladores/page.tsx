export const metadata = { title: "Para desarrolladores · GALCOA+ en Stellar" };

/** Portada para quienes construyen en Stellar. Dice con honestidad qué hay hoy y qué es hipótesis. */
export default function Desarrolladores() {
  return (
    <main>
      <header className="marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" />
        <div><h1>Verificación de datos para quienes construyen en Stellar</h1><p className="lema">Antes de que un dato llegue a la red, que pase por reglas en código y por agentes que solo pueden frenar.</p></div>
        <span className="etiqueta-red">Testnet · prototipo</span>
      </header>

      <section className="card">
        <h2>Qué te da</h2>
        <ul className="puntos">
          <li><b>Reglas con identificador (<code>ALC-…</code>)</b> que deciden verde, amarillo o rojo. Lo rojo no se ancla nunca.</li>
          <li><b>Agentes con harness:</b> instrucciones en Markdown portable; solo proponen o frenan, nunca aprueban.</li>
          <li><b>Defensa contra órdenes escondidas</b> en el texto, más un chequeo cruzado en código de cada cantidad que propone el modelo.</li>
          <li><b>Evaluación</b> de los agentes con casos de respuesta conocida y etiquetas congeladas.</li>
          <li><b>Comprobantes</b> que cualquiera verifica sin confiar en nosotros: paquete <code>galcoa-comprobante</code> (sin dependencias, MIT) y <a href="/spec">guía pública</a>.</li>
          <li><b>A Stellar va solo una huella de 32 bytes</b> por lote, nunca datos personales.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Probalo en 10 minutos</h2>
        <ol className="puntos">
          <li><a href="/agentes">Cargá una entrega con tus palabras</a> y mirá qué proponen los agentes y qué deciden las reglas.</li>
          <li><a href="/evidencia">Revisá una foto o un audio</a> con los peritos de IA.</li>
          <li><a href="/demo">Dejá la prueba en Stellar Testnet</a> y <a href="/verificar">verificala</a>.</li>
          <li>Mirá el código y la guía de integración en <a href="https://github.com/GALCOA-Stellar/galcoa-stellar" target="_blank" rel="noreferrer">el repositorio</a> (<code>docs/desarrolladores/GUIA-10-MINUTOS.md</code>).</li>
        </ol>
      </section>

      <section className="card">
        <h2>Estado real</h2>
        <p className="aviso">Prototipo en Stellar Testnet, con reglas de demostración, sin auditoría externa y sin dinero real. El paquete todavía no está publicado en npm. Pensamos esta capa para desarrolladores y builders de Stellar, y para quien suba datos a la red: es una hipótesis que estamos evaluando, todavía no validada. El primer caso de uso con el que se probó todo es el de las entregas entre empresas. Proyecto independiente, sin respaldo de la Stellar Development Foundation.</p>
      </section>

      <p className="aviso pie"><a href="/">Inicio</a> · <a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a></p>
    </main>
  );
}
