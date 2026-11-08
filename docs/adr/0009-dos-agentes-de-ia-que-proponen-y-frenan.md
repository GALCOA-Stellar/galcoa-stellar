# 0009 — Dos agentes de IA que proponen y frenan; las reglas deciden (06/11/2026)

Estado: aceptada por Facundo ("esa es nuestra identidad").

## Contexto
La versión anterior del proyecto (en otra red) se basaba en un chat con dos agentes de IA: un registrador que ordena el dato y un verificador independiente que lo controla, con reglas en código que deciden. Esa es la identidad de GALCOA+ y faltaba en la versión de Stellar, que solo tenía las reglas.

## Decisión
Se incorporan los dos agentes en `src/lib/agentes/` y una pantalla de chat en `/agentes`:
1. **Registrador:** convierte el mensaje de una persona en datos. Solo propone. No puede fijar quién cargó, quién confirma ni la fecha de registro: los pone el servidor.
2. **Verificador:** compara lo propuesto con el mensaje original, de preferencia con un proveedor de IA distinto. Solo puede frenar: agrega la regla `ALC-VER-01`, que puede bajar el veredicto y nunca subirlo. Si falla o no responde, nada queda verificado.
3. **Reglas en código** (`reglas-demo-0.2`, sin cambios) deciden verde, amarillo o rojo. Una segunda persona confirma (cuatro ojos).
4. El estado entre el paso de carga y el de confirmación viaja firmado por el servidor para que no se pueda alterar.

## Consecuencias
- La regla de que la IA no decide el veredicto (ADR 0003) se mantiene: los agentes proponen y frenan.
- Los modelos corren en servidores de terceros: no se cargan datos personales ni reales. Los proveedores son configurables por variables de entorno (`GEMINI_API_KEY`, `GROQ_API_KEY`); sin claves los agentes quedan apagados. Con una sola clave los dos agentes usan el mismo proveedor y la pantalla lo avisa.
- Límite: el freno del verificador se aplica al preparar los documentos para sellar; el sellado vuelve a evaluar solo las reglas deterministas.
- El sitio público no tiene claves cargadas: los agentes corren en local o donde se configuren. Hay un tope diario de uso y un límite de pedidos por IP.
- Las pruebas automáticas usan proveedores simulados. Además se probó con modelos reales (Gemini y Groq) en 4 casos el 06/11/2026: ver `docs/evidencia/AGENTES-PRUEBA-REAL.md`. La medición completa con errores sembrados sigue pendiente.
