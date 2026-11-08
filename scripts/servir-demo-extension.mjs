// Sirve la página de demostración de la extensión en http://localhost:4190 (solo para probar a mano).
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const pagina = readFileSync(new URL("../extension/demo/formulario.html", import.meta.url));
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(pagina);
}).listen(4190, "127.0.0.1", () => console.log("Demo en http://localhost:4190"));
