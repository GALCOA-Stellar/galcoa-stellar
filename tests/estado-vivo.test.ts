import { describe, expect, it } from "vitest";
import { leerLote } from "@/lib/stellar/estado-vivo";

describe("leerLote", () => {
  it("rechaza sin consultar la red un id que no es una huella de 64 caracteres hexadecimales", async () => {
    for (const malo of ["", "zz", "ec5dedf0", "G".repeat(64), "A".repeat(64), "a".repeat(63)]) {
      expect(await leerLote(malo)).toBeNull();
    }
  });
});
