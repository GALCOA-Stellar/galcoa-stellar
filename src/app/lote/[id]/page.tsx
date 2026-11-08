import { headers } from "next/headers";
import QR from "qrcode";
import { leerLote } from "@/lib/stellar/estado-vivo";
import { EXPLORADOR_CONTRATO, REGISTRO_ID } from "@/lib/config/contratos";
import { ImagenQr, LogoGalcoa } from "@/app/logos";

export const dynamic = "force-dynamic";
const corta = (g: string) => `${g.slice(0, 5)}…${g.slice(-4)}`;

/** Enlace público de un lote: muestra su estado leído directo del contrato. No pide cuenta ni archivo. */
export default async function Lote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idv = id.toLowerCase();
  const valido = /^[0-9a-f]{64}$/.test(idv);
  const r = valido ? await leerLote(idv) : null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const url = `${host.startsWith("localhost") ? "http" : "https"}://${host}/lote/${idv}`;
  const qr = valido && host ? await QR.toDataURL(url, { margin: 1, width: 192, color: { dark: "#1E3A5F", light: "#FFFFFF" } }) : null;

  const titulo = !valido ? "Identificador no válido" : r === null ? "No se pudo consultar la red" : r.estado === "vigente" ? "Lote vigente" : r.estado === "revocado" ? "Lote revocado" : r.estado === "archivado" ? "Registro archivado en la red" : "Este lote no figura en el contrato";
  const bueno = r?.estado === "vigente";

  return (
    <main>
      <header className="marca">
        <LogoGalcoa />
        <div>
          <h1>Estado de un lote</h1>
          <p className="lema">Se lee directo del contrato en Stellar Testnet. No pide cuenta.</p>
        </div>
      </header>
      <section className="card" role="status">
        <p className="gran"><span className={bueno ? "verde" : "rojo"}>{bueno ? "✔" : "✖"}</span> {titulo}</p>
        {valido && <p>Huella del lote: <code>{corta(idv)}</code></p>}
        {r?.estado === "vigente" && (
          <ul className="puntos">
            <li>✔ Está registrado y vigente: la custodia lo reconoce como válido.</li>
            <li>Lo registraron dos cuentas distintas: cargó <code>{corta(r.cargador ?? "")}</code> y aprobó <code>{corta(r.aprobador ?? "")}</code> (registro n.º {r.ledger}).</li>
          </ul>
        )}
        {r?.estado === "revocado" && <p>Se registró y después fue revocado (registro n.º {r.ledgerRevocacion}). El historial sigue en la red, pero el lote ya no vale y la custodia no paga por él.</p>}
        {r?.estado === "archivado" && <p>El dato existe pero venció su vida útil en la red y hay que restaurarlo. No significa que no exista.</p>}
        {r?.estado === "no-figura" && <p>El contrato no tiene registrado este identificador.</p>}
        {r === null && valido && <p>La red de prueba no respondió a tiempo. Probá de nuevo en un momento.</p>}
        <p><a href={`${EXPLORADOR_CONTRATO}${REGISTRO_ID}`} target="_blank" rel="noreferrer">Ver el contrato de registro en el explorador</a></p>
        {qr && (
          <p>
            <ImagenQr src={qr} alt="Código QR que lleva a esta página" tamano={192} />
            <br /><small>Escaneá para abrir este estado en el celular.</small>
          </p>
        )}
        <p className="aviso">Esto muestra el estado del registro. No prueba que la mercadería exista: eso depende de quienes cargan y aprueban el dato.</p>
      </section>
      <p className="aviso pie"><a href="/verificar">Verificar un comprobante</a> · <a href="/">Inicio</a></p>
    </main>
  );
}
