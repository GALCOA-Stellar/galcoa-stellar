// Batería de intrusión: ataques reales contra la app compilada y corriendo (idea tomada de evals/intrusion de arm-whatsapp).
// Levanta `next start` con datos inventados y cuentas descartables, ataca, y falla (código 1) si algún ataque pasa.
// Uso: npm run build && npm run intrusion
import { Keypair } from "@stellar/stellar-sdk";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PUERTO = 4191, BASE = `http://localhost:${PUERTO}`;
if (!existsSync(".next/BUILD_ID")) { console.error("Primero compilá: npm run build"); process.exit(1); }
try { await fetch(BASE); console.error(`El puerto ${PUERTO} ya está en uso. Cerralo y repetí.`); process.exit(1); } catch {}

const A = Keypair.random(), B = Keypair.random(), C = Keypair.random(); // A y B autorizadas; C no
const servidor = spawn("npx", ["next", "start", "-p", String(PUERTO)], {
  shell: true, stdio: "ignore",
  env: { ...process.env, NODE_ENV: "production", GALCOA_DATOS: mkdtempSync(join(tmpdir(), "galcoa-intr-")), DESAFIO_SECRETO: randomBytes(32).toString("hex"), CUENTAS_AUTORIZADAS: `${A.publicKey()}=operador-01,${B.publicKey()}=aprobador-01`, CUENTA_SELLADORA_2DE2: Keypair.random().publicKey(), MODO_DEMO: "1" },
});

let ip = 0;
const pedir = async (ruta, { metodo = "GET", cuerpo, cabeceras = {}, crudo, mismoIp } = {}) => {
  const h = { "x-forwarded-for": mismoIp ?? `10.9.${Math.floor(++ip / 250)}.${ip % 250}`, ...cabeceras };
  if (cuerpo !== undefined) { h["content-type"] ??= "application/json"; h.origin ??= BASE; }
  const r = await fetch(BASE + ruta, { method: metodo, headers: h, body: crudo ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)), redirect: "manual" });
  const texto = await r.text();
  let j = null; try { j = JSON.parse(texto); } catch {}
  return { s: r.status, j, texto, h: r.headers };
};
const hashSep53 = (m) => createHash("sha256").update("Stellar Signed Message:\n" + m, "utf8").digest();
async function sesion(kp) {
  const d = await pedir("/api/sesion", { metodo: "POST", cuerpo: { cuenta: kp.publicKey() } });
  const firma = Buffer.from(kp.sign(hashSep53(d.j.mensaje))).toString("base64");
  const r = await pedir("/api/sesion", { metodo: "POST", cuerpo: { acceso: { cuenta: kp.publicKey(), mensaje: d.j.mensaje, marca: d.j.marca, firma } } });
  return r.j?.pase;
}

const doc = { remito: "R-INT", producto: "Aceite", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: "ab".repeat(32) };
const resultados = [];
const ataque = async (nombre, fn) => {
  try { const r = await fn(); resultados.push({ nombre, ok: r === true, detalle: r === true ? "" : String(r) }); }
  catch (e) { resultados.push({ nombre, ok: false, detalle: "excepción: " + e.message }); }
};
const bloqueado = (r, ...codigos) => (codigos.includes(r.s) ? true : `respondió ${r.s} (se esperaba ${codigos.join("/")}): ${r.texto.slice(0, 120)}`);

try {
  for (let i = 0; i < 90; i++) { try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
  const paseA = await sesion(A);
  if (!paseA) throw new Error("No se pudo abrir una sesión legítima: la batería no puede seguir");
  const conA = { "x-pase": paseA };

  // ---- Cabeceras y configuración
  await ataque("Cabeceras de seguridad (CSP con nonce y sin unsafe-inline en scripts, HSTS, nosniff, sin X-Powered-By)", async () => {
    const r = await pedir("/");
    const csp = r.h.get("content-security-policy") ?? "";
    const scripts = (csp.match(/script-src[^;]*/) ?? [""])[0];
    if (!/'nonce-[A-Za-z0-9+/=]+'/.test(scripts)) return "la CSP no trae nonce";
    if (scripts.includes("unsafe-inline")) return "script-src admite unsafe-inline";
    if (!r.h.get("strict-transport-security")) return "falta HSTS";
    if (r.h.get("x-content-type-options") !== "nosniff") return "falta nosniff";
    if (r.h.get("x-powered-by")) return "expone X-Powered-By";
    return /<script[^>]*nonce=/.test(r.texto) || "los scripts de la página no llevan el nonce";
  });
  await ataque("El nonce cambia en cada pedido", async () => { const [x, y] = [await pedir("/"), await pedir("/")]; return x.h.get("content-security-policy") !== y.h.get("content-security-policy") || "el nonce se repite"; });
  await ataque("Salud responde sin exponer secretos", async () => { const r = await pedir("/api/health"); return (r.s === 200 && !/SECRET|secret|S[A-Z2-7]{55}/.test(r.texto)) || `status ${r.s}`; });

  // ---- Identidad y sesión
  await ataque("Historial sin sesión", async () => bloqueado(await pedir("/api/historial"), 401));
  await ataque("Historial con pase inventado", async () => bloqueado(await pedir("/api/historial", { cabeceras: { "x-pase": "aaaa.bbbb" } }), 401));
  await ataque("Historial con pase válido alterado", async () => bloqueado(await pedir("/api/historial", { cabeceras: { "x-pase": paseA.slice(0, -2) + (paseA.endsWith("aa") ? "bb" : "aa") } }), 401));
  await ataque("Sesión pedida para una cuenta no autorizada", async () => bloqueado(await pedir("/api/sesion", { metodo: "POST", cuerpo: { cuenta: C.publicKey() } }), 403));
  await ataque("Sesión con la firma de OTRA cuenta", async () => {
    const d = await pedir("/api/sesion", { metodo: "POST", cuerpo: { cuenta: A.publicKey() } });
    const firma = Buffer.from(B.sign(hashSep53(d.j.mensaje))).toString("base64");
    return bloqueado(await pedir("/api/sesion", { metodo: "POST", cuerpo: { acceso: { cuenta: A.publicKey(), mensaje: d.j.mensaje, marca: d.j.marca, firma } } }), 401);
  });
  await ataque("Sesión con el mensaje alterado (otra cuenta)", async () => {
    const d = await pedir("/api/sesion", { metodo: "POST", cuerpo: { cuenta: A.publicKey() } });
    const mensaje = d.j.mensaje.replace(A.publicKey(), B.publicKey());
    const firma = Buffer.from(B.sign(hashSep53(mensaje))).toString("base64");
    return bloqueado(await pedir("/api/sesion", { metodo: "POST", cuerpo: { acceso: { cuenta: B.publicKey(), mensaje, marca: d.j.marca, firma } } }), 401);
  });
  await ataque("Mis datos sin sesión (descargar y borrar)", async () => {
    const g = await pedir("/api/mis-datos"); const d = await pedir("/api/mis-datos", { metodo: "DELETE", cabeceras: { origin: BASE } });
    return bloqueado(g, 401) === true && bloqueado(d, 401) === true ? true : `GET ${g.s}, DELETE ${d.s}`;
  });
  await ataque("Borrar mis datos desde otro sitio (CSRF)", async () => bloqueado(await pedir("/api/mis-datos", { metodo: "DELETE", cabeceras: { ...conA, origin: "https://sitio-malo.example" } }), 403));
  await ataque("Borrar una operación sin sesión", async () => bloqueado(await pedir("/api/historial/" + "0".repeat(32), { metodo: "DELETE", cabeceras: { origin: BASE } }), 401));

  // ---- Confirmación del comercio
  await ataque("Crear enlace de confirmación sin sesión", async () => bloqueado(await pedir("/api/confirmacion", { metodo: "POST", cuerpo: { documento: doc } }), 401));
  await ataque("Crear enlace con datos inválidos", async () => bloqueado(await pedir("/api/confirmacion", { metodo: "POST", cuerpo: { documento: { remito: "x" } }, cabeceras: conA }), 400));
  for (const [nombre, id] of [["id inexistente", "0".repeat(32)], ["path traversal", "..%2f..%2f..%2fpackage.json"], ["path traversal con barras", "../../.env"], ["id con comillas", "%22%3E%3Cscript%3E"], ["id enorme", "a".repeat(5000)]])
    await ataque(`Confirmación: ${nombre}`, async () => bloqueado(await pedir("/api/confirmacion/" + id), 404, 400));
  await ataque("Un enlace de confirmación se usa una sola vez (8 respuestas simultáneas, gana 1)", async () => {
    const c = await pedir("/api/confirmacion", { metodo: "POST", cuerpo: { documento: doc }, cabeceras: conA });
    if (!c.j?.id) return "no se pudo crear el enlace: " + c.texto.slice(0, 100);
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => pedir(`/api/confirmacion/${c.j.id}`, { metodo: "POST", cuerpo: { respuesta: i % 2 ? "confirmada" : "no_coincide" } })));
    const ok = rs.filter((r) => r.s === 200).length;
    return ok === 1 || `${ok} respuestas aceptadas`;
  });
  await ataque("Comentario con HTML/JS se devuelve como texto, nunca como página", async () => {
    const c = await pedir("/api/confirmacion", { metodo: "POST", cuerpo: { documento: doc }, cabeceras: conA });
    await pedir(`/api/confirmacion/${c.j.id}`, { metodo: "POST", cuerpo: { respuesta: "no_coincide", nota: "<img src=x onerror=alert(1)>" } });
    const g = await pedir(`/api/confirmacion/${c.j.id}`);
    return (g.h.get("content-type") ?? "").startsWith("application/json") && g.h.get("x-content-type-options") === "nosniff" || "no es JSON con nosniff";
  });
  await ataque("El comercio no ve datos internos (quién cargó, huella del original)", async () => {
    const c = await pedir("/api/confirmacion", { metodo: "POST", cuerpo: { documento: doc }, cabeceras: conA });
    const g = await pedir(`/api/confirmacion/${c.j.id}`);
    return !/operador-01|receptor-01|abababab/.test(g.texto) || "se filtraron datos internos: " + g.texto.slice(0, 150);
  });

  // ---- Falsificaciones
  await ataque("Documento con 'confirmadoPor: comercio-…' escrito a mano queda en rojo", async () => {
    const r = await pedir("/api/previsualizar", { metodo: "POST", cuerpo: { documentos: [{ ...doc, confirmadoPor: "comercio-12345678-" + "0".repeat(32) }] } });
    return r.j?.documentos?.[0]?.veredicto === "rojo" || `veredicto ${r.j?.documentos?.[0]?.veredicto}`;
  });
  await ataque("Constancia PDF de un comprobante armado a mano", async () => {
    const manifiesto = { documento: doc, reglasVersion: "reglas-demo-0.2", reglasIds: ["ALC-COM-01"], veredicto: "verde" };
    // se arma coherente por dentro: un solo documento, raíz = huella (el servidor no lo selló)
    const { createHash: h } = await import("node:crypto");
    const canon = (v) => (Array.isArray(v) ? "[" + v.map(canon).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v));
    const manifestHash = h("sha256").update(canon(manifiesto)).digest("hex");
    const r = await pedir("/api/constancia", { metodo: "POST", cuerpo: { schemaVersion: "galcoa.stellar.comprobante.v1", red: "stellar:testnet", txHash: "f".repeat(64), manifiesto, manifestHash, indice: 0, cantidadHojas: 1, camino: [], raiz: manifestHash } });
    return bloqueado(r, 400, 403, 422);
  });
  await ataque("Constancia con txHash que intenta inyectar cabeceras", async () => bloqueado(await pedir("/api/constancia", { metodo: "POST", cuerpo: { schemaVersion: "galcoa.stellar.comprobante.v1", manifiesto: {}, txHash: 'x"\r\nSet-Cookie: a=b', indice: 0 } }), 400, 422));
  await ataque("Modo de una sola firma apagado en producción", async () => bloqueado(await pedir("/api/sellar-lote", { metodo: "POST", cuerpo: { documentos: [doc], acceso: {} } }), 403));
  await ataque("Sello 2 de 2 con una transacción inventada", async () => {
    const r = await pedir("/api/sello-2de2/enviar", { metodo: "POST", cuerpo: { documentos: [doc], xdr: "AAAA" } });
    return r.s >= 400 && r.s < 500 || `respondió ${r.s}`;
  });
  await ataque("Registro en contrato con las dos cuentas iguales", async () => bloqueado(await pedir("/api/contrato/preparar", { metodo: "POST", cuerpo: { documentos: [doc], cargador: A.publicKey(), aprobador: A.publicKey() } }), 403, 400, 503));
  await ataque("Registro en contrato con datos ajenos al servidor (marca falsa)", async () => bloqueado(await pedir("/api/contrato/enviar", { metodo: "POST", cuerpo: { documentos: [doc], datos: JSON.stringify({ memo: "a".repeat(64) }), marca: "0".repeat(64), firmas: [] } }), 403));
  await ataque("Modo demostración no funciona en producción", async () => {
    const r = await pedir("/api/demo/firmar"); return r.j?.activo === false || "el modo demostración está activo";
  });

  // ---- Tamaño, tipo y origen
  await ataque("Cuerpo enorme (300 KB) se rechaza sin tumbar el servidor", async () => {
    const r = await pedir("/api/previsualizar", { metodo: "POST", crudo: JSON.stringify({ documentos: [{ x: "a".repeat(300_000) }] }), cuerpo: {} });
    const vivo = await pedir("/api/health");
    return r.s >= 400 && r.s < 500 && vivo.s === 200 || `respondió ${r.s}, salud ${vivo.s}`;
  });
  await ataque("Content-Type incorrecto", async () => bloqueado(await pedir("/api/previsualizar", { metodo: "POST", crudo: "documentos=1", cabeceras: { "content-type": "text/plain", origin: BASE }, cuerpo: {} }), 400));
  await ataque("Pedido desde otro sitio (Origin ajeno)", async () => bloqueado(await pedir("/api/previsualizar", { metodo: "POST", cuerpo: { documentos: [doc] }, cabeceras: { origin: "https://sitio-malo.example" } }), 400, 403));
  await ataque("Pedido cross-site según el navegador", async () => bloqueado(await pedir("/api/previsualizar", { metodo: "POST", cuerpo: { documentos: [doc] }, cabeceras: { "sec-fetch-site": "cross-site" } }), 400, 403));
  await ataque("JSON roto no produce error 500", async () => { const r = await pedir("/api/previsualizar", { metodo: "POST", crudo: "{no es json", cuerpo: {} }); return r.s >= 400 && r.s < 500 || `respondió ${r.s}`; });
  await ataque("Límite de pedidos: ráfaga desde una misma IP", async () => {
    const rs = []; for (let i = 0; i < 40; i++) rs.push((await pedir("/api/verificar", { metodo: "POST", cuerpo: {}, mismoIp: "10.250.250.250" })).s);
    return rs.includes(429) || "no hubo ningún 429 en 40 pedidos";
  });
} finally {
  servidor.kill();
  // en Windows el servidor queda como proceso hijo: se cierra por puerto y se espera a que termine
  await new Promise((fin) => spawn("powershell", ["-NoProfile", "-Command", `Get-NetTCPConnection -LocalPort ${PUERTO} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`], { stdio: "ignore" }).on("close", fin));
}

const mal = resultados.filter((r) => !r.ok);
for (const r of resultados) console.log(`${r.ok ? "BLOQUEADO " : "¡PASÓ!    "} ${r.nombre}${r.ok ? "" : "\n           → " + r.detalle}`);
console.log(`\n${resultados.length - mal.length}/${resultados.length} ataques bloqueados`);
process.exit(mal.length ? 1 : 0);
