import "server-only";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { create as crearQr } from "qrcode";
import { GALCOA_LOGO_PNG } from "./logo-pdf";
import type { Comprobante } from "../aplicacion/lote";

/**
 * Constancia en PDF de UN documento sellado (misma identidad visual que GALCOA+ original: azul, verde, amarillo).
 * Se genera solo con lo que lleva el comprobante, sin red ni reloj. El PDF no es la prueba: la prueba es la
 * huella anclada en Stellar; el QR lleva a esa transacción en el explorador público.
 * Lenguaje: "verificado / declarado / requiere revisión". Nunca "cumple" ni "validado".
 */
const C = { navy: "#1E3A5F", green: "#176A57", yellow: "#FFDA47", ink: "#0B1220", muted: "#5B6678", line: "#D5DBE3", zebra: "#F4F6F9", danger: "#B42318" } as const;
const ETIQUETA = { verde: "VERIFICADO", amarillo: "DECLARADO", rojo: "REQUIERE REVISIÓN" } as const;
const BADGE = { verde: { backgroundColor: C.green, color: "#FFFFFF" }, amarillo: { backgroundColor: C.yellow, color: C.navy }, rojo: { backgroundColor: C.danger, color: "#FFFFFF" } } as const;

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: C.ink, fontFamily: "Helvetica" },
  cab: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 3, borderBottomColor: C.yellow, paddingBottom: 12, marginBottom: 16 },
  logo: { width: 120, height: 39 },
  titulo: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 4 },
  sub: { color: C.muted, marginBottom: 14 },
  badge: { fontSize: 10, fontFamily: "Helvetica-Bold", paddingVertical: 4, paddingHorizontal: 10 },
  fila: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5, paddingHorizontal: 6 },
  clave: { width: 150, color: C.muted },
  valor: { flex: 1 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 16, marginBottom: 6 },
  mono: { fontFamily: "Courier", fontSize: 8, color: C.ink },
  pie: { flexDirection: "row", gap: 14, marginTop: 20, alignItems: "center", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  qr: { width: 96, height: 96 },
  nota: { color: C.muted, fontSize: 8.5, marginTop: 10 },
});

const ROTULOS: [string, string][] = [
  ["remito", "Remito"], ["producto", "Producto"], ["unidad", "Unidad"], ["cantidadPedida", "Cantidad pedida"], ["cantidadRecibida", "Cantidad recibida"],
  ["fechaEntrega", "Fecha de entrega"], ["fechaRegistro", "Fecha de registro"], ["cargadoPor", "Cargado por"], ["confirmadoPor", "Confirmado por"], ["observacion", "Observación"],
];

export const urlExplorador = (c: Comprobante) => `https://stellar.expert/explorer/${c.red === "stellar:mainnet" ? "public" : "testnet"}/tx/${c.txHash}`;

async function qrComoImagen(texto: string): Promise<string> {
  const { default: QR } = await import("qrcode");
  return QR.toDataURL(texto, { margin: 1, width: 192, errorCorrectionLevel: "M", color: { dark: "#1E3A5F", light: "#FFFFFF" } });
}

export async function pdfDeComprobante(c: Comprobante): Promise<Buffer> {
  void crearQr; // la importación estática asegura que el paquete esté disponible en el empaquetado
  const doc = (c.manifiesto.documento ?? {}) as Record<string, unknown>;
  const v = c.manifiesto.veredicto;
  const qr = await qrComoImagen(urlExplorador(c));
  const datos = ROTULOS.filter(([k]) => doc[k] !== undefined && doc[k] !== null && doc[k] !== "");
  const pdf = (
    <Document title={`Constancia GALCOA+ ${String(doc.remito ?? "")}`} author="GALCOA+" producer="galcoa-stellar-pdf-v1" creationDate={new Date(0)}>
      <Page size="A4" style={s.page}>
        <View style={s.cab}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={GALCOA_LOGO_PNG} style={s.logo} />
          <Text style={{ ...s.badge, ...BADGE[v] }}>{ETIQUETA[v]}</Text>
        </View>
        <Text style={s.titulo}>Constancia de verificación de entrega</Text>
        <Text style={s.sub}>Documento {c.indice + 1} de {c.cantidadHojas} del lote · red {c.red}</Text>
        <Text style={s.h2}>Datos del documento</Text>
        {datos.map(([k, rotulo], i) => (
          <View key={k} style={{ ...s.fila, backgroundColor: i % 2 ? C.zebra : "#FFFFFF" }}>
            <Text style={s.clave}>{rotulo}</Text><Text style={s.valor}>{String(doc[k])}</Text>
          </View>
        ))}
        <Text style={s.h2}>Verificación</Text>
        <View style={s.fila}><Text style={s.clave}>Versión de reglas</Text><Text style={s.valor}>{c.manifiesto.reglasVersion}</Text></View>
        <View style={s.fila}><Text style={s.clave}>Reglas aplicadas</Text><Text style={s.valor}>{c.manifiesto.reglasIds.join(", ")}</Text></View>
        <Text style={s.h2}>Prueba en Stellar</Text>
        <View style={s.fila}><Text style={s.clave}>Transacción</Text><Text style={{ ...s.valor, ...s.mono }}>{c.txHash}</Text></View>
        <View style={s.fila}><Text style={s.clave}>Huella del documento</Text><Text style={{ ...s.valor, ...s.mono }}>{c.manifestHash}</Text></View>
        <View style={s.fila}><Text style={s.clave}>Raíz del lote</Text><Text style={{ ...s.valor, ...s.mono }}>{c.raiz}</Text></View>
        {c.prueba && <View style={s.fila}><Text style={s.clave}>Ledger</Text><Text style={s.valor}>{c.prueba.ledger}{c.prueba.cierreLedger ? ` · ${c.prueba.cierreLedger}` : ""}</Text></View>}
        <View style={s.pie}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qr} style={s.qr} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: C.navy }}>Comprobá esta constancia</Text>
            <Text style={s.nota}>Escaneá el código para ver la transacción en el explorador público. Para comprobar este documento, abrí el verificador de GALCOA+ y cargá el archivo del lote: si alguien cambió un dato, la verificación falla.</Text>
          </View>
        </View>
        <Text style={s.nota}>Prototipo en red de prueba, sin dinero real. Las reglas son un subconjunto del motor completo. Este documento muestra lo declarado y lo verificado por reglas; no certifica que la mercadería exista ni reemplaza una firma con valor legal.</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(pdf);
}
