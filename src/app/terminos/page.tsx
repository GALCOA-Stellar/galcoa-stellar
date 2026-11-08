import { LogoGalcoa } from "@/app/logos";
export const metadata = { title: "Términos · GALCOA+ en Stellar" };

/** Términos de uso del prototipo. Borrador técnico: no reemplaza la revisión de un abogado. */
export default function Terminos() {
  return (
    <main>
      <header className="marca">
        <LogoGalcoa />
        <div><h1>Términos de uso</h1><p className="lema">Qué es este sitio y qué no es.</p></div>
        <a className="enlace-cab" href="/demo">Volver</a>
      </header>
      <section className="card">
        <h2>Qué es</h2>
        <p>Un prototipo de demostración que funciona en la red de prueba de Stellar (Testnet). No maneja dinero real, no es un servicio comercial y puede cambiar o dejar de funcionar sin aviso. La red de prueba se reinicia cada tanto, y cuando pasa los registros hechos en ella desaparecen.</p>
        <h2>Qué no es</h2>
        <ul className="puntos">
          <li>No es una certificación ni una auditoría. Las reglas son de demostración y el sistema no está validado.</li>
          <li>No prueba que un documento, una foto o un audio sean verdaderos: detecta inconsistencias, repeticiones y alteraciones, y deja que una persona decida.</li>
          <li>No cuenta con respaldo de la Stellar Development Foundation ni de ninguna empresa nombrada en el sitio.</li>
        </ul>
        <h2>Qué te pedimos</h2>
        <ul className="puntos">
          <li>No cargues datos personales ni datos reales de clientes: los modelos de IA corren en servidores de terceros.</li>
          <li>No uses el sitio para engañar a nadie ni para sobrecargarlo. Hay límites de pedidos por origen.</li>
          <li>Usá solo cuentas y activos de prueba.</li>
        </ul>
        <h2>Responsabilidad</h2>
        <p>Se ofrece tal cual está, sin garantías. No nos hacemos responsables por decisiones tomadas a partir de lo que muestra esta demostración.</p>
        <h2>Contacto</h2>
        <p><a href="mailto:galcoa.ok@gmail.com">galcoa.ok@gmail.com</a>. Datos personales: ver <a href="/privacidad">Privacidad</a>.</p>
        <p className="aviso">Borrador técnico de un prototipo en red de prueba. No reemplaza la revisión de un abogado.</p>
      </section>
    </main>
  );
}
