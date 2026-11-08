import Image from "next/image";

/** Logos del sitio con el componente de imágenes de Next (SVG sin optimizar: ya son vectoriales). */
export function LogoGalcoa() {
  return <Image className="logo-img" src="/galcoa-on-navy.svg" alt="GALCOA+" width={931} height={307} priority unoptimized />;
}

export function LogoStellar() {
  return <Image className="logo-stellar" src="/stellar-logo.svg" alt="" aria-hidden="true" width={18} height={18} unoptimized />;
}

/** Imagen de un código QR que viene como data URL (generado en el servidor, no hay nada que optimizar). */
export function ImagenQr({ src, alt, tamano }: { src: string; alt: string; tamano: number }) {
  return <Image src={src} alt={alt} width={tamano} height={tamano} unoptimized />;
}
