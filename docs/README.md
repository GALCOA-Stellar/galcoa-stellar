# Documentación de GALCOA+ en Stellar

Si dos documentos se contradicen, gana la **fuente de verdad**: [`producto/FUENTE-DE-VERDAD.md`](producto/FUENTE-DE-VERDAD.md).

| Carpeta | Qué hay | Para quién |
|---|---|---|
| [`producto/`](producto/) | Qué es el producto: fuente de verdad, MVP, requisitos (SRS), requisitos de dato, tablero, hoja de ruta, costos | Negocio, legal y desarrollo |
| [`arquitectura/`](arquitectura/) | Cómo está hecho: arquitectura, despliegue canónico, especificación del comprobante, modelo de amenazas, glosario, decisiones de interoperabilidad | Desarrollo y quien evalúe el diseño |
| [`adr/`](adr/) | Decisiones de diseño numeradas y su porqué | Desarrollo |
| [`evidencia/`](evidencia/) | Pruebas medidas en testnet (tabla de evidencia, informes con transacciones, resumen de entrevistas) | Quien evalúe el proyecto |
| [`en/`](en/) | Producto, arquitectura, flujo de demo, límites y FAQ en inglés | Lectores internacionales |
| [`vectores/`](vectores/) | Vectores de prueba del comprobante | Desarrollo |

## Convenciones
- Documentos en español, nombres en MAYÚSCULAS con guiones. Decisiones nuevas: un ADR numerado en `adr/`.
- No se nombran empresas ni personas entrevistadas. Nunca "cumple" ni "está validado": el sistema se diseña para poder validarse.
- Todo es testnet y activos de prueba.
- Comprobar enlaces: `node scripts/revisar-enlaces.mjs`.
