// Especificación pública del comprobante y guía de verificación independiente. Texto fijo.
import { REGISTRO_ID as REGISTRO, LOTE_EJEMPLO as MEMO_EJEMPLO } from "@/lib/config/contratos";

export const metadata = { title: "Especificación del comprobante · GALCOA+ en Stellar" };

export default function Spec() {
  return (
    <main>
      <div className="marca"><a className="enlace-cab" href="/">Volver</a></div>
      <h1>Cómo verificar un comprobante sin pedirnos permiso</h1>
      <p className="sub">Todo lo necesario es público: el formato, un verificador sin dependencias, un ejemplo y los vectores de prueba. Red de prueba de Stellar, sin dinero real.</p>

      <section className="card">
        <h2>Archivos</h2>
        <ul className="puntos">
          <li><a href="/spec/comprobante-v2.md">Especificación del formato (v2)</a></li>
          <li><a href="/spec/galcoa-comprobante.mjs">Verificador independiente (JavaScript, sin dependencias)</a> · <a href="/spec/LEEME-paquete.md">cómo usarlo</a></li>
          <li><a href="/spec/ejemplo-comprobante.json">Comprobante de ejemplo (lote real de prueba en testnet)</a></li>
          <li><a href="/spec/vectores-comprobante-v2.json">Vectores de prueba</a> generados con una implementación independiente en Python</li>
        </ul>
      </section>

      <section className="card">
        <h2>Los tres pasos</h2>
        <ol className="pasos-portada">
          <li><b>1. El contenido no fue alterado</b><span>El verificador recalcula la huella del manifiesto y comprueba que lleva a la raíz del lote. Si alguien cambia un solo dato, deja de coincidir. No usa nuestro servidor ni la red.</span></li>
          <li><b>2. El lote está registrado en Stellar</b><span>Del paso 1 sale la huella esperada del lote (<code>memoEsperado</code>). Se la consulta al contrato de registro con la función de solo lectura <code>existe</code>: responde si está vigente o no. Cualquiera puede preguntarlo desde su propio nodo.</span></li>
          <li><b>3. Quién cargó y quién aprobó</b><span>La función <code>obtener</code> del mismo contrato devuelve las dos cuentas, que deben ser distintas, y si el lote fue revocado.</span></li>
        </ol>
      </section>

      <section className="card">
        <h2>Probalo con el ejemplo</h2>
        <p>Descargá <code>galcoa-comprobante.mjs</code> y <code>ejemplo-comprobante.json</code> en una carpeta y corré (Node 20 o más):</p>
        <pre><code>{`node --input-type=module -e '
import { verificarComprobante } from "./galcoa-comprobante.mjs";
import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync("ejemplo-comprobante.json", "utf8"));
console.log(verificarComprobante(c));'`}</code></pre>
        <p>Tiene que mostrar <code>coherente: true</code> y esta huella esperada:</p>
        <p><code>{MEMO_EJEMPLO}</code></p>
        <p>Cambiale cualquier valor del manifiesto (por ejemplo <code>cantidadRecibida</code>) y vuelve a correrlo: pasa a <code>coherente: false</code>.</p>
      </section>

      <section className="card">
        <h2>Preguntarle a la red</h2>
        <p>Con la CLI de Stellar y cualquier cuenta de prueba (es una lectura, no gasta nada):</p>
        <pre><code>{`stellar contract invoke --id ${REGISTRO} \
  --network testnet --source-account <tu-cuenta> --send=no \
  -- existe --huella ${MEMO_EJEMPLO}`}</code></pre>
        <p>Responde <code>true</code> mientras el lote esté vigente. El contrato en el explorador: <a href={`https://stellar.expert/explorer/testnet/contract/${REGISTRO}`}>Stellar Expert</a>.</p>
      </section>

      <section className="card">
        <h2>Roles y estados</h2>
        <p><b>Quién puede qué</b> (lo exige el contrato, no la aplicación):</p>
        <ul>
          <li><b>Cargador:</b> firma su autorización al registrar un lote. No puede ser la misma persona que el aprobador.</li>
          <li><b>Aprobador:</b> revisa y firma su autorización. Sin las dos firmas la red rechaza el registro.</li>
          <li><b>Servicio:</b> firma también y paga la comisión; es la única cuenta que puede enviar el registro. Registrar y revocar están cofirmados por el servicio: revocar exige su firma y la de quien cargó o quien aprobó el lote.</li>
          <li><b>Cualquier persona:</b> lee y verifica, sin permiso y sin cuenta.</li>
        </ul>
        <p><b>Estados de un lote:</b> <code>no figura</code> → <code>vigente</code> (registrado con dos firmas) → <code>revocado</code> (el servicio lo revoca y queda el hash del motivo). Un lote revocado no vuelve a vigente y una huella ya registrada no se puede registrar de nuevo. Además, el verificador puede mostrar <code>archivado</code>: el dato venció por antigüedad en la red y se restaura renovándolo, no es lo mismo que revocado.</p>
        <p><b>Un solo identificador:</b> la huella del lote identifica todo el flujo. Es la clave del registro, viaja en cada evento de la custodia (<code>depositado</code>, <code>liberado</code>, <code>reembolsado</code>) y es lo que el servidor escribe en sus registros. Con ella se sigue un lote de punta a punta.</p>
        <p><b>En la custodia:</b> <code>depositado</code> → <code>liberado</code> (solo si el lote está vigente) o <code>reembolsado</code> (si se revoca o vence el plazo). Un trato se liquida una sola vez.</p>
      </section>

      <section className="card" id="eventos">
        <h2>Leer los eventos del contrato</h2>
        <p>Cada cambio de estado deja un evento: el registro emite <code>lote_registrado</code> (huella, cargador, aprobador) y <code>lote_revocado</code> (huella, quién revocó, hash del motivo); la custodia emite <code>depositado</code>, <code>liberado</code> y <code>reembolsado</code>. Cualquiera los lee sin permiso, con cualquier nodo RPC de Stellar (la testnet conserva unos 7 días):</p>
        <pre><code>{`curl -s -X POST https://soroban-testnet.stellar.org \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getEvents","params":{
    "startLedger": <ledger reciente>,
    "filters":[{"type":"contract","contractIds":["${REGISTRO}"]}],
    "pagination":{"limit":100}}}'`}</code></pre>
      </section>

      <section className="card" id="limites">
        <h2>Cómo leer las respuestas y límites conocidos</h2>
        <ul>
          <li><b>Publicar y revocar dependen del servicio; verificar no.</b> El alta y la revocación están cofirmadas por el servicio. Una vez publicado, el estado se lee en la red sin pasar por nuestro servidor.</li>
          <li><b><code>existe</code> significa “vigente”, no “alguna vez registrado”.</b> Un lote revocado responde <code>false</code>. Para saber si existió y fue revocado, usá <code>obtener</code> (devuelve quién cargó, quién aprobó, el estado y el ledger de cada paso) o los eventos.</li>
          <li><b>Corregir un lote no lo reabre:</b> un lote revocado no se vuelve a registrar; se prepara y registra uno nuevo con su propia huella.</li>
          <li><b>Vida del dato:</b> cada lote está en almacenamiento persistente con vida renovable. <code>renovar</code> puede llamarlo cualquiera, no cambia el contenido y la comisión la paga quien lo pide. Si un lote no se renueva, queda archivado y se restaura; no se pierde por eso.</li>
          <li><b>Vida de la instancia (corregido el 06/11/2026):</b> la cuenta del servicio, en el registro, y la dirección del registro y la administración, en la custodia, viven en el almacenamiento de la instancia. En los contratos vigentes su vida se renueva en todas las operaciones (<code>registrar</code>, <code>revocar</code>, <code>renovar</code>, <code>depositar</code>, <code>liberar</code>, <code>reembolsar</code>) y cualquiera puede renovarla con <code>renovar_instancia</code>. Los contratos anteriores quedan como historial de prueba y no son la referencia.</li>
          <li><b>Sin ruta de actualización y sin auditoría externa:</b> una corrección se publica como contrato nuevo y se anuncia cuál es el vigente. Es un prototipo de testnet.</li>
          <li><b>El ledger y el hash de la transacción</b> de cada evento vienen en la respuesta de <code>getEvents</code>, no en el cuerpo del evento.</li>
        </ul>
      </section>

      <p className="aviso pie">
        Esto verifica que el contenido no cambió y que dos personas distintas lo firmaron; no prueba que la mercadería exista. La testnet se reinicia de tanto en tanto: si el ejemplo deja de figurar, es por eso. · <a href="/verificar">Verificar un comprobante en el navegador</a> · <a href="/.well-known/stellar.toml">stellar.toml</a>
      </p>
    </main>
  );
}
