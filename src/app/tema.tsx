"use client";

import { useEffect, useState } from "react";

/** Botón para alternar entre el tema oscuro (por defecto) y uno claro. Recuerda la elección si el navegador lo permite. */
export function BotonTema({ claroTexto, oscuroTexto }: { claroTexto: string; oscuroTexto: string }) {
  const [claro, setClaro] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("galcoa-tema") === "claro") { document.documentElement.dataset.tema = "claro"; setClaro(true); } } catch { /* sin almacenamiento: queda el tema oscuro */ }
  }, []);
  const alternar = () => {
    const nuevo = !claro;
    setClaro(nuevo);
    if (nuevo) document.documentElement.dataset.tema = "claro"; else delete document.documentElement.dataset.tema;
    try { localStorage.setItem("galcoa-tema", nuevo ? "claro" : "oscuro"); } catch { /* idem */ }
  };
  return <button type="button" className="boton-tema" onClick={alternar} aria-pressed={claro}>{claro ? oscuroTexto : claroTexto}</button>;
}
