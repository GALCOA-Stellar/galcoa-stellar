import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const leerLote = vi.fn();
vi.mock("@/lib/stellar/estado-vivo", () => ({ leerLote: (...a: unknown[]) => leerLote(...a) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:4180" }) }));

import Lote from "@/app/lote/[id]/page";

const HUELLA = "a".repeat(64);
const ver = async (id: string) => renderToStaticMarkup(await Lote({ params: Promise.resolve({ id }) }));

describe("página pública del lote", () => {
  beforeEach(() => leerLote.mockReset());

  it("un id inválido no consulta la red y lo dice", async () => {
    const html = await ver("zz");
    expect(html).toContain("Identificador no válido");
    expect(leerLote).not.toHaveBeenCalled();
  });

  it("muestra vigente, revocado, inexistente y red caída según el contrato", async () => {
    leerLote.mockResolvedValueOnce({ estado: "vigente" });
    expect(await ver(HUELLA)).toContain("Lote vigente");
    leerLote.mockResolvedValueOnce({ estado: "revocado" });
    expect(await ver(HUELLA)).toContain("Lote revocado");
    leerLote.mockResolvedValueOnce({ estado: "inexistente" });
    expect(await ver(HUELLA)).toContain("no figura en el contrato");
    leerLote.mockResolvedValueOnce(null);
    expect(await ver(HUELLA)).toContain("No se pudo consultar la red");
  });
});
