import { LogoGalcoa } from "@/app/logos";
export const metadata = { title: "Privacidad · GALCOA+ en Stellar" };

/** Aviso de privacidad (Ley 25.326). Borrador técnico: no reemplaza la revisión de un abogado. */
export default function Privacidad() {
  return (
    <main>
      <header className="marca">
        <LogoGalcoa />
        <div><h1>Privacidad</h1><p className="lema">Qué datos guardamos, para qué y cómo los podés borrar.</p></div>
        <a className="enlace-cab" href="/demo">Volver</a>
      </header>
      <section className="card">
        <h2>Qué guardamos</h2>
        <ul className="puntos">
          <li><b>En esta instalación:</b> el archivo de cada lote sellado (remito, producto, cantidades, fechas, huella del original, y los identificadores internos de quien cargó y quien confirmó) y las respuestas del comercio a los enlaces de confirmación, con el comentario que escriba.</li>
          <li><b>En la red Stellar:</b> solo una huella (32 bytes) del lote. No permite reconstruir ningún dato y no contiene datos personales. Por eso no hay nada que borrar de la red.</li>
          <li><b>Medición de velocidad del sitio:</b> usamos Vercel Speed Insights, que mide cuánto tarda en cargar cada página. No usa cookies ni identifica personas.</li>
          <li><b>Lo que no guardamos:</b> claves secretas, ni datos de salud, religión, política u otros datos sensibles. Si escribís un comentario, <b>no incluyas datos personales</b>.</li>
        </ul>
        <h2>Para qué</h2>
        <p>Para poder demostrar qué se entregó y quién lo cargó y confirmó, y para que el verificador compruebe que un documento no cambió. No usamos los datos para otra cosa ni los compartimos.</p>
        <h2>Cuánto tiempo</h2>
        <p>Los lotes se conservan 12 meses (configurable en la instalación) y las respuestas del comercio hasta 30 días después de que vence el enlace. Después se borran solas.</p>
        <h2>Tus derechos</h2>
        <p>Podés pedir ver, corregir o borrar tus datos. Si ingresaste con tu billetera, en el <a href="/historial">historial</a> tenés los botones <b>Descargar mis datos</b> y <b>Borrar mis datos</b>. Para otra consulta, escribí a <a href="mailto:galcoa.ok@gmail.com"><b>galcoa.ok@gmail.com</b></a>.</p>
        <p className="aviso">Esta página es un borrador técnico de un prototipo en red de prueba y no reemplaza la revisión de un abogado. La Ley 25.326 es la ley argentina de protección de datos personales; la Agencia de Acceso a la Información Pública controla su cumplimiento y recibe reclamos.</p>
      </section>
    </main>
  );
}
