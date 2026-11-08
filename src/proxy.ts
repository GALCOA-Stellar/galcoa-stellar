import { NextResponse, type NextRequest } from "next/server";

/**
 * Política de contenido (CSP) con nonce por pedido, solo en producción.
 * Los scripts solo corren si llevan el nonce de ESTE pedido ('strict-dynamic' deja que esos scripts carguen otros).
 * Así, aunque alguien lograra inyectar un <script> en una página, el navegador no lo ejecuta.
 * En desarrollo no se aplica (el recargador de Next necesita permisos que acá no queremos dar).
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // Solo la demo conecta la billetera del celular (WalletConnect): ahí, y solo ahí, se permiten sus dominios.
  const wc = request.nextUrl.pathname.startsWith("/demo");
  const WC_RED = "wss://*.walletconnect.org wss://*.walletconnect.com https://*.walletconnect.org https://*.walletconnect.com https://*.reown.com https://*.web3modal.org";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'", // React usa estilos en línea; los scripts son lo que más importa cerrar
    `img-src 'self' data: blob:${wc ? " https://*.walletconnect.com https://*.walletconnect.org https://*.reown.com https://*.web3modal.org" : ""}`,
    `font-src 'self'${wc ? " https://fonts.reown.com" : ""}`,
    `connect-src 'self'${wc ? ` ${WC_RED}` : ""}`,
    wc ? "frame-src https://verify.walletconnect.org https://verify.walletconnect.com https://secure.walletconnect.org https://secure.walletconnect.com" : "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  const encabezados = new Headers(request.headers);
  encabezados.set("x-nonce", nonce);
  encabezados.set("Content-Security-Policy", csp); // Next lee el nonce de acá para sus propios scripts
  const respuesta = NextResponse.next({ request: { headers: encabezados } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = { matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }] };
