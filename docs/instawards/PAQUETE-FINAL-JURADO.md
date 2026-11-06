# Paquete final para jurado (06/11/2026)

Bloques de texto listos para campos del formulario formal o para un anexo. Salen de la auditoría de Ask Stellar, **ajustados a nuestras decisiones**: el contrato exige la autorización de dos cuentas distintas (está probado); las verificaciones las hizo el equipo con el verificador independiente; el sprint apunta a 10 a 20 entrevistas nuevas; no nos regalamos con confesiones que nadie pidió. Los textos base (one-liner, resumen, problema, por qué Stellar, alcance) siguen en `FORMULARIO-LISTO-PARA-PEGAR.md`; este archivo suma lo que ahí no estaba. Pruebas con link: `docs/evidencia/TABLA-EVIDENCIA.md`.

## Por qué no alcanza una base de datos
Una base de datos puede guardar registros, pero no ofrece una condición pública y compartida que otro contrato pueda consultar para ejecutar una acción. En GALCOA+ el tercero no necesita confiar en nuestro servidor para comprobar el estado del comprobante, y la custodia de prueba depende de ese estado publicado en la red.

## Solución (qué hacemos y qué no)
No subimos documentos a la cadena. Tomamos un comprobante ya validado fuera de cadena (reglas fijas y una persona que aprueba), registramos en Stellar Testnet su huella y su estado, y cualquier tercero puede consultarlo sin usar infraestructura de GALCOA+ (con el verificador público y un nodo de Stellar). Ese mismo estado lo usa un contrato de custodia de prueba para habilitar o bloquear una ejecución.

## Qué ya está probado
Dos contratos desplegados en Stellar Testnet, 12 lotes de prueba registrados con cuentas distintas, 5 verificaciones con el verificador independiente, 2 flujos de custodia de prueba condicionados al estado del comprobante, y un caso documentado donde alterar un dato hace fallar la verificación. Verificador, guía y eventos públicos.

## Innovación
No es digitalizar un comprobante: es volverlo portable y verificable por terceros y conectar ese estado con una consecuencia económica de prueba sobre Stellar. El diferencial es la combinación de verificación independiente, estado público consultable y composición entre contratos.

## Por qué ahora
Stellar ofrece contratos y lectura pública de estado y eventos con costos bajos. Al mismo tiempo, muchas validaciones comerciales B2B siguen dependiendo de documentos frágiles y de confiar en el emisor. Este proyecto explora una forma mínima y verificable de cerrar esa brecha.

## Usuario inicial
Pymes distribuidoras del NEA y las marcas que las proveen, que necesitan demostrar el estado de una entrega sin depender del emisor. En esta etapa validamos un flujo puntual y repetible, no todo el proceso comercial.

## Evidencia de necesidad
Dos entrevistas a dos roles distintos (una distribuidora y un distribuidor de una marca) describen el mismo problema, y las marcas piden historial comprobable a quien las representa. Ambos entrevistados autorizaron citarlos sin nombre. En el sprint sumamos entre 10 y 20 entrevistas nuevas para medir cuánto se repite.

## Entregables medibles (30 días)
10 comprobantes registrados con cuentas distintas; 3 verificaciones hechas por personas ajenas al equipo; 1 o 2 pagos de prueba condicionados; de 10 a 20 entrevistas nuevas; 1 prueba guiada documentada con una empresa interesada; especificación pública y video corto. El foco del grant es evidencia reproducible, no adopción masiva.

## Uso de fondos (USD 5.000)
Contratos y pruebas, USD 2.100. Frontend y experiencia de billetera, USD 1.100. Verificación independiente y especificación pública, USD 700. Demo, evidencia y prueba guiada, USD 1.100. El presupuesto cierra un prototipo verificable y bien documentado; no escala una operación.

## Riesgos y mitigación
El sistema verifica integridad y estado, no la existencia física de la mercadería, y lo decimos así. La evidencia de necesidad es inicial: por eso el sprint prioriza entrevistas y una prueba guiada antes que más funciones. El paso pendiente es validar el flujo con dos personas reales y dos billeteras.

## Respuestas cortas
**¿Qué falta?** Validar el flujo con dos personas y dos billeteras reales, ampliar la evidencia con más entrevistas y reforzar la experiencia antes de pensar en mainnet o pagos reales.
**¿Por qué no centralizado?** Porque el valor no es almacenar datos, sino publicar un estado verificable por terceros y usarlo como condición compartida para otra acción, sin depender del servidor del emisor.
**¿Qué aprendimos?** Que el valor no está en subir documentos a la cadena, sino en exponer un estado mínimo, verificable y reutilizable por terceros; y que el siguiente paso correcto es sumar evidencia, no más funciones.

## Demo de 75 a 80 segundos (versión corta)
"Una entrega puede estar hecha y aun así terminar en reclamo porque después nadie puede probar qué pasó. GALCOA+ toma ese comprobante, registra en Stellar Testnet una huella verificable y guarda su estado sin publicar documentos. Un tercero puede comprobar ese estado sin depender de nuestro servidor, y si alteramos un dato, la verificación falla. Ese estado lo consulta un contrato de custodia de prueba: si el comprobante figura verificado, la ejecución puede avanzar; si se revoca, no. Hoy funciona como prototipo en Testnet, con evidencia pública."

## Qué NO se tomó de la auditoría y por qué
- "Todavía no contamos con validación comercial suficiente para afirmar demanda" y "la técnica avanza más rápido que el mercado": son confesiones que nadie pidió. Se dice lo que hay (dos roles, mismo problema, más entrevistas en el sprint).
- "5 verificaciones de terceros": las hizo el equipo; los terceros reales son meta del sprint.
- "5 entrevistas nuevas": el equipo definió 10 a 20.
- "El flujo está diseñado para requerir dos cuentas": el contrato lo exige y está probado; se dice así, aclarando que son cuentas y que la prueba con dos personas es el siguiente hito.
