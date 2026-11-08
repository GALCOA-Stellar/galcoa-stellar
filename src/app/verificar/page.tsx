"use client";
import { useState } from "react";
import { LogoGalcoa } from "@/app/logos";

type Contrato = { registrado: boolean; estado?: "vigente" | "revocado" | "archivado" | "no-figura"; ledgerRevocacion?: number; motivoHash?: string; cargador?: string; aprobador?: string; ledger?: number; cuentasConocidas?: boolean | null } | null;
type Verif = { verificado?: boolean; motivo?: string; paso?: string; explorador?: string; ledger?: number; cierreLedger?: string | null; contrato?: Contrato; consumo?: { estado: "liberado" | "reembolsado" | "sin-pagos-recientes"; ledger?: number } | null; pendiente?: boolean; error?: string };
const corta = (g: string) => `${g.slice(0, 5)}…${g.slice(-4)}`;

/** Verificador público: no pide cuenta ni firma; cualquiera con un comprobante (o un archivo del lote) puede comprobarlo. */
export default function Verificar() {
  const [texto, setTexto] = useState("");
  const [verif, setVerif] = useState<Verif | null>(null);
  const [cargando, setCargando] = useState(false);

  async function leerArchivo(f: File | undefined) {
    if (!f) return;
    if (f.size > 1_000_000) return setVerif({ error: "El archivo es demasiado grande" });
    setVerif(null);
    setTexto(await f.text());
  }

  async function verificar() {
    setVerif(null);
    setCargando(true);
    try {
      let cuerpo = texto;
      // Acepta un comprobante suelto o el archivo del lote completo (se verifica el primer comprobante).
      const j = JSON.parse(texto);
      if (Array.isArray(j?.comprobantes)) cuerpo = JSON.stringify(j.comprobantes[0]);
      const r = await fetch("/api/verificar", { method: "POST", headers: { "content-type": "application/json" }, body: cuerpo });
      setVerif(await r.json());
    } catch {
      setVerif({ error: "No pude leer el archivo. Tiene que ser un comprobante o el archivo del lote que descargaste." });
    }
    setCargando(false);
  }

  const ok = verif?.verificado === true;
  const sinRed = verif?.paso === "prueba-guardada";
  const c = verif?.contrato;

  return (
    <main>
      <header className="marca">
        <LogoGalcoa />
        <div>
          <h1>Verificar un comprobante</h1>
          <p className="lema">Abierto a cualquier persona. No pide cuenta y no guarda nada.</p>
        </div>
      </header>
      <section className="card">
        <p className="aviso">Subí el archivo del lote (o pegá un comprobante). Se recalcula la huella del documento, se sube hasta la raíz del lote y se compara con lo escrito en Stellar.</p>
        <p><input type="file" accept="application/json,.json" aria-label="Archivo del comprobante" onChange={(e) => leerArchivo(e.target.files?.[0])} /></p>
        <details><summary>O pegar el texto del comprobante</summary>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false} aria-label="Comprobante en JSON" placeholder="Pegá acá el comprobante o el archivo del lote" />
        </details>
        <p><button type="button" onClick={verificar} disabled={!texto.trim() || cargando}>{cargando ? "Verificando…" : "Verificar"}</button></p>

        {verif?.error && <p className="error" role="alert">{verif.error}</p>}
        {verif && !verif.error && (
          <div role="status" className={ok ? "ok-card card" : "card"} style={ok ? undefined : { borderColor: "var(--bad)" }}>
            <p className="gran"><span className={ok ? "verde" : sinRed ? "amarillo" : "rojo"}>{ok ? "✔" : sinRed ? "●" : "✖"}</span> {ok ? "Verificado" : sinRed ? "Prueba guardada coherente, sin confirmar en la red" : "No se pudo verificar"}</p>
            <p>{verif.motivo}</p>
            {ok && (
              <ul className="puntos">
                <li>✔ El contenido del documento no cambió desde que se selló.</li>
                <li>{`✔ Está escrito en Stellar (ledger ${verif.ledger}).`}</li>
                {c && (c.estado === "archivado"
                  ? <li>▲ El registro existe pero está archivado en la red (venció su vida útil): hay que restaurarlo para consultarlo. No significa que no exista.</li>
                  : c.estado === "revocado"
                  ? <li>✖ Este lote fue REVOCADO después de registrarse (registro n.º {c.ledgerRevocacion}). El sello sigue en la red, pero el lote ya no vale: no debe usarse.{c.motivoHash && <> Huella del motivo: <code>{corta(c.motivoHash)}</code>.</>}</li>
                  : c.registrado
                  ? (c.cuentasConocidas === false
                    ? <li>▲ Figura en el contrato, pero con cuentas que esta instalación no reconoce (<code>{corta(c.cargador ?? "")}</code> y <code>{corta(c.aprobador ?? "")}</code>): no se toma como registro propio.</li>
                    : <li>{c.cuentasConocidas ? "✔" : "▲"} Lo registraron dos cuentas distintas en el contrato: cargó <code>{corta(c.cargador ?? "")}</code> y aprobó <code>{corta(c.aprobador ?? "")}</code>.{c.cuentasConocidas === null && " (No se pudo comprobar si son cuentas conocidas.)"}</li>)
                  : <li>▲ No figura en el contrato de registro; el sello lo mandó una cuenta selladora conocida.</li>)}
                {verif.consumo && (verif.consumo.estado === "liberado"
                  ? <li>◆ CONSUMIDO: este lote ya habilitó un pago en la custodia (liberado, registro n.º {verif.consumo.ledger}). Un lote se usa una sola vez.</li>
                  : verif.consumo.estado === "reembolsado"
                  ? <li>◆ La custodia reembolsó el depósito de este lote (registro n.º {verif.consumo.ledger}): no se pagó.</li>
                  : <li>◇ Sin pagos de la custodia en los eventos recientes (la red conserva unos 7 días). Este lote no figura como consumido.</li>)}
              </ul>
            )}
            {verif.explorador && <p><a href={verif.explorador} target="_blank" rel="noreferrer">Ver la transacción en el explorador</a></p>}
          </div>
        )}
        <p className="aviso">Esto prueba que el contenido existía tal cual y no cambió. No prueba que sea verdad (por ejemplo, que la mercadería exista).</p>
      </section>
      <p className="aviso pie"><a href="/demo">Volver a la herramienta</a> · Cuentas oficiales: <a href="/.well-known/stellar.toml">stellar.toml</a></p>
    </main>
  );
}
