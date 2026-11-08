import { describe, expect, it } from "vitest";
import { cabeceraClave } from "../src/lib/datos/almacen-remoto";

describe("cabeceraClave", () => {
  it("clave nueva (no JWT): solo apikey", () => {
    expect(cabeceraClave("sb_secret_abc")).toEqual({ apikey: "sb_secret_abc" });
  });
  it("clave vieja (JWT): apikey y authorization", () => {
    expect(cabeceraClave("eyJabc")).toEqual({ apikey: "eyJabc", authorization: "Bearer eyJabc" });
  });
});
