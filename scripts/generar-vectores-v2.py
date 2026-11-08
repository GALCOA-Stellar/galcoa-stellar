# Implementación INDEPENDIENTE (Python) de la codificación v2. Genera docs/vectores/comprobante-v2.json.
# Sirve para comprobar que la app (TypeScript) y el paquete (JavaScript) dan exactamente los mismos bytes.
import hashlib, json, struct, unicodedata

CAMPOS = [("remito","t",0),("producto","t",0),("unidad","t",0),("cantidadPedida","i",0),("cantidadRecibida","i",0),
          ("fechaEntrega","t",0),("fechaRegistro","t",0),("cargadoPor","t",0),("confirmadoPor","t",0),
          ("evidenciaHash","h",1),("observacion","t",1)]
def txt(s):
    b = unicodedata.normalize("NFC", s).encode("utf-8")
    return b"\x01" + struct.pack(">I", len(b)) + b
def doc(d):
    assert set(d) <= {c[0] for c in CAMPOS}
    out = b""
    for n, t, op in CAMPOS:
        v = d.get(n)
        if v is None:
            assert op; out += b"\x00"; continue
        if t == "t": out += txt(v)
        elif t == "i": out += b"\x02" + struct.pack(">Q", v)
        else: out += b"\x03" + struct.pack(">I", 32) + bytes.fromhex(v)
    return out
def manif(m):
    body = txt(m["reglasVersion"]) + b"\x04" + struct.pack(">I", len(m["reglasIds"])) + b"".join(txt(x) for x in m["reglasIds"]) + txt(m["veredicto"]) + doc(m["documento"])
    return hashlib.sha256(b"galcoa:manifiesto:v2" + b"\x02" + body).hexdigest()
def hoja(h): return hashlib.sha256(b"\x00" + h).digest()
def nodo(l, r): return hashlib.sha256(b"\x01" + l + r).digest()
def raiz(hs):
    nivel = [hoja(bytes.fromhex(h)) for h in hs]
    while len(nivel) > 1:
        sig = []
        for i in range(0, len(nivel), 2):
            sig.append(nodo(nivel[i], nivel[i+1]) if i+1 < len(nivel) else nivel[i])
        nivel = sig
    return nivel[0].hex()
def memo(r, n): return hashlib.sha256(b"galcoa:lote:v2" + b"\x02" + struct.pack(">I", n) + bytes.fromhex(r)).hexdigest()

base = {"remito":"R-0001","producto":"Yerba mate 1 kg","unidad":"caja","cantidadPedida":10,"cantidadRecibida":10,
        "fechaEntrega":"2026-11-02","fechaRegistro":"2026-11-03","cargadoPor":"op-01","confirmadoPor":"sup-02"}
casos = {
  "completo": {**base, "evidenciaHash":"ab"*32, "observacion":"Sin novedades"},
  "sin_opcionales": dict(base),
  "observacion_vacia_no_es_ausente": {**base, "observacion":""},
  "nfc_precompuesto": {**base, "producto":"Café molido"},
  "nfc_descompuesto": {**base, "producto":"Café molido"},
  "unicode_fuera_del_plano_basico": {**base, "observacion":"Entrega \U0001F4E6 ok"},
}
mans = {k: {"documento": d, "reglasVersion": "reglas-demo-0.2", "reglasIds": ["ALC-COM-01","ALC-LEG-01"], "veredicto": "verde"} for k, d in casos.items()}
hashes = {k: manif(m) for k, m in mans.items()}
orden = ["completo","sin_opcionales","observacion_vacia_no_es_ausente"]
r = raiz([hashes[k] for k in orden])
salida = {
  "esquema": "galcoa.stellar.comprobante.v2",
  "nota": "Generado por scripts/generar-vectores-v2.py (implementación independiente en Python).",
  "manifiestos": [{"nombre": k, "manifiesto": mans[k], "manifestHash": hashes[k]} for k in mans],
  "lote": {"orden": orden, "raiz": r, "cantidadHojas": len(orden), "memo": memo(r, len(orden))},
}
assert hashes["nfc_precompuesto"] == hashes["nfc_descompuesto"]
assert hashes["sin_opcionales"] != hashes["observacion_vacia_no_es_ausente"]
open("docs/vectores/comprobante-v2.json", "w", encoding="utf-8").write(json.dumps(salida, indent=2, ensure_ascii=True) + "\n")
print(json.dumps({"hashes": hashes, "raiz": r, "memo": salida["lote"]["memo"]}, indent=1))
