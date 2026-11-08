/**
 * Forma de los pedidos que entran por la API (Zod). Acá solo se controla la FORMA (tipos, largos, formato);
 * el contenido lo siguen decidiendo las reglas en código. Todos los mensajes están en castellano y son seguros de mostrar.
 */
import { z } from "zod";

export const MAX_MENSAJE_PEDIDO = 1500;
const ID_INTERNO = /^[A-Za-z0-9._-]{1,60}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** Chat de carga: lo que manda el navegador al registrador. */
export const pedidoRegistrar = z.object({
  mensaje: z
    .string("Escribí qué entrega querés cargar")
    .refine((s) => s.trim() !== "", "Escribí qué entrega querés cargar")
    .refine((s) => s.length <= MAX_MENSAJE_PEDIDO, `El mensaje es demasiado largo (máximo ${MAX_MENSAJE_PEDIDO} caracteres)`),
  cargadoPor: z.string("Falta quién carga (un identificador interno, sin datos personales)").regex(ID_INTERNO, "Falta quién carga (un identificador interno, sin datos personales)"),
  // Una huella mal formada se ignora (como antes): no frena la carga.
  evidenciaHash: z.string().regex(HEX64).optional().catch(undefined),
});

const documentos = z.array(z.unknown(), "Mandá al menos un documento");

/** "Qué se sella": lista de documentos. */
export const pedidoPrevisualizar = z.object({ documentos });

/** Sello de una firma: documentos y prueba de acceso (la prueba la valida `verificarAcceso`). */
export const pedidoSellar = z.object({ documentos, acceso: z.unknown() });

const documentoUnico = z.record(z.string(), z.unknown(), "Los datos del documento no son válidos");

/** Confirmación simple de un comercio. */
export const pedidoConfirmacion = z.object({ documento: documentoUnico });

/** Ronda de confirmación por terceros. */
export const pedidoRonda = z.object({ documento: documentoUnico, roles: z.array(z.string(), "Elegí quiénes confirman") });

export type PedidoRegistrar = z.infer<typeof pedidoRegistrar>;
