# Scripts

Se corren desde la raíz con `node scripts/<nombre>`. Los que figuran en `package.json` también con `npm run`.

| Script | Para qué |
|---|---|
| `crear-cuenta-testnet.mjs` | Crea una cuenta de testnet y escribe `.env.local` |
| `configurar-2de2.mjs`, `prueba-multifirma.mjs`, `e2e-2de2.mjs` | Cuenta con dos firmas y su prueba de punta a punta |
| `probar-contrato.mjs`, `probar-escrow.mjs` | Pruebas de los contratos en testnet |
| `criterios-de-exito.mjs` | Corrida reproducible que genera la evidencia (`docs/evidencia/`) |
| `medir-lote-vs-individual.mjs`, `comparar-opciones-integracion.mjs` | Mediciones de comisión y tiempo |
| `generar-vectores-v2.py` | Genera los vectores de prueba del comprobante |
| `aprobar-reglas.mjs`, `intrusion.mjs` | Aprobación de reglas y pruebas de intrusión locales |
| `revisar-enlaces.mjs` | Revisa enlaces relativos de los `.md` |
