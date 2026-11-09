// Hace solos los clics de la demo para grabar el video: abrís OBS, ejecutás este script y hablás.
// Uso:  node scripts/video-demo.mjs            (abre Chrome visible y arranca en 8 segundos)
//       node scripts/video-demo.mjs --prueba    (corre sin ventana para verificar que todo anda)
// Tiempos (en segundos) ajustables con variables: T_INTRO, T_CARGA_EXTRA, T_VERDE, T_VERIFICAR, T_CIERRE.
import { chromium } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITIO = process.env.SITIO || "https://galcoa-stellar.vercel.app";
const prueba = process.argv.includes("--prueba");
const seg = (nombre, porDefecto) => Number(process.env[nombre] ?? porDefecto) * (prueba ? 0.05 : 1);
const T = { intro: seg("T_INTRO", 20), cargaExtra: seg("T_CARGA_EXTRA", 14), verde: seg("T_VERDE", 8), verificar: seg("T_VERIFICAR", 14), cierre: seg("T_CIERRE", 16) };
const espera = (s) => new Promise((r) => setTimeout(r, s * 1000));
const aviso = (m) => console.log(`[${new Date().toLocaleTimeString("es-AR")}] ${m}`);

// Cursor visible (círculo) para que en el video se vea dónde se hace clic.
const CURSOR = `
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText = "position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(255,218,71,.85);border:2px solid #0c1a2e;pointer-events:none;left:-50px;top:-50px;transform:translate(-50%,-50%);transition:transform .08s";
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; });
    addEventListener("mousedown", () => { c.style.transform = "translate(-50%,-50%) scale(.6)"; });
    addEventListener("mouseup", () => { c.style.transform = "translate(-50%,-50%) scale(1)"; });
  });`;

const navegador = await chromium.launch({ channel: process.env.E2E_CANAL || "chrome", headless: prueba || process.argv.includes("--grabar"), args: ["--window-size=1138,720", "--window-position=0,0"] });
const grabar = process.argv.includes("--grabar");
const ctx = await navegador.newContext({ ...(grabar ? { recordVideo: { dir: "video", size: { width: 1138, height: 640 } } } : {}), viewport: { width: 1138, height: 640 }, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.addInitScript(CURSOR);
const pagina = await ctx.newPage();
const creada = Date.now();

async function clic(localizador) {
  await localizador.scrollIntoViewIfNeeded();
  const caja = await localizador.boundingBox();
  if (!caja) throw new Error("No se encontró el botón");
  await pagina.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2, { steps: 35 });
  await espera(prueba ? 0.05 : 0.6);
  await localizador.click();
}

try {
  if (!prueba && !grabar) { for (let i = 8; i > 0; i--) { aviso(`Empieza en ${i}… (iniciá la grabación en OBS)`); await espera(1); } }
  // Agenda en segundos desde que se ve la portada (pensada para un guion hablado de ~1:40).
  const A = process.env.AGENDA ? process.env.AGENDA.split(",").map(Number) : [22, 24, 42, 62, 64, 66, 70, 84, 100];
  const [tAgentes, tEjemplo, tCargar, tConfirmar, tVerificarPag, tArchivo, tVerificar, tCierre, tFin] = A;
  const escala = prueba ? 0.02 : 1;
  const tVerde = Number(process.env.T_VERDE_EN ?? 58); // segundo en que se muestra el resultado verde (cuando decís "Verde")

  await pagina.goto(`${SITIO}/`, { waitUntil: "networkidle" });
  const cargada = (Date.now() - creada) / 1000; // segundos de video antes de ver la portada
  const inicio = Date.now();
  const hasta = async (s) => { const falta = s * escala - (Date.now() - inicio) / 1000; if (falta > 0) await espera(falta); };
  if (grabar) writeFileSync("video/recorte.txt", String(cargada.toFixed(2)));
  aviso(`1/4 INTRO: portada (recorte ${cargada.toFixed(1)} s)`);
  await pagina.mouse.move(640, 400, { steps: 5 });

  await hasta(tAgentes);
  aviso("2/4 CARGA: pantalla de agentes");
  await pagina.goto(`${SITIO}/agentes`, { waitUntil: "networkidle" });
  await hasta(tEjemplo);
  await clic(pagina.getByRole("button", { name: "Usar un ejemplo" }));
  await hasta(tCargar);
  // El resultado se muestra recién en el segundo "tVerde", aunque la IA haya contestado antes.
  await pagina.route("**/api/agentes/registrar", async (ruta) => { const r = await ruta.fetch(); await hasta(tVerde); await ruta.fulfill({ response: r }); });
  await clic(pagina.getByRole("button", { name: "Cargar", exact: true }));
  aviso("Los agentes están trabajando…");
  const verde = pagina.locator(".gran", { hasText: "· Verificado" }).first();
  await verde.waitFor({ timeout: 120000 });
  aviso("Resultado verde en pantalla");
  await verde.scrollIntoViewIfNeeded();
  await hasta(tConfirmar);
  await clic(pagina.getByRole("button", { name: /Confirmar como/ }));
  await pagina.getByText("aprobada", { exact: false }).first().waitFor({ timeout: 60000 });

  await hasta(tVerificarPag);
  aviso("3/4 VERIFICAR: comprobante de ejemplo");
  await pagina.goto(`${SITIO}/verificar`, { waitUntil: "networkidle" });
  const ejemplo = await (await fetch(`${SITIO}/spec/ejemplo-comprobante.json`)).text();
  const archivo = join(mkdtempSync(join(tmpdir(), "galcoa-video-")), "ejemplo-comprobante.json");
  writeFileSync(archivo, ejemplo);
  await hasta(tArchivo);
  const entrada = pagina.locator('input[type="file"]');
  const caja = await entrada.boundingBox();
  if (caja) await pagina.mouse.move(caja.x + 20, caja.y + caja.height / 2, { steps: 35 });
  await entrada.setInputFiles(archivo);
  await hasta(tVerificar);
  await clic(pagina.getByRole("button", { name: "Verificar", exact: true }));
  await pagina.getByText(/figura vigente/i).first().waitFor({ timeout: 60000 });
  aviso("Verificado");
  await hasta(tCierre);
  aviso("4/4 CIERRE: pantalla quieta");
  await hasta(tFin);
  aviso("LISTO.");
} catch (e) {
  console.error("Falló un paso:", e.message);
  process.exitCode = 1;
} finally {
  await espera(prueba ? 0 : 3);
  const v = grabar ? pagina.video() : null;
  await ctx.close();
  if (v) console.log("Video de pantalla guardado en:", await v.path());
  await navegador.close();
}
