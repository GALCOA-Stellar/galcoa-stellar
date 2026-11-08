#!/usr/bin/env bash
# Compila y prueba los contratos de Soroban dentro de Docker (no hace falta instalar Rust ni el compilador de Windows).
# Uso:  bash scripts/contratos-docker.sh test  registro-lotes
#       bash scripts/contratos-docker.sh test  escrow-entrega
#       bash scripts/contratos-docker.sh build escrow-entrega   (deja el .wasm en contracts/<nombre>/target-docker/)
# Necesita Docker Desktop abierto. La primera vez baja unos 1,5 GB; después usa caché.
set -euo pipefail
accion="${1:?uso: contratos-docker.sh test|build <contrato>}"
contrato="${2:?falta el nombre del contrato (registro-lotes o escrow-entrega)}"
raiz="$(pwd -W 2>/dev/null || pwd)"
export MSYS_NO_PATHCONV=1
CLI=30.0.1
docker run --rm \
  -v "${raiz}:/work" \
  -v galcoa-cargo:/usr/local/cargo/registry \
  -v galcoa-target:/cache \
  -e CARGO_TARGET_DIR=/cache/"${contrato}" \
  -w "/work/contracts/${contrato}" \
  rust:1 bash -c "
    set -e
    rustup target add wasm32v1-none >/dev/null 2>&1
    case '${accion}' in
      test)  cargo test ;;
      build) curl -sSfL https://github.com/stellar/stellar-cli/releases/download/v${CLI}/stellar-cli-${CLI}-x86_64-unknown-linux-gnu.tar.gz | tar -xz -C /usr/local/bin stellar
             stellar contract build --manifest-path Cargo.toml
             mkdir -p target-docker && cp /cache/${contrato}/wasm32v1-none/release/*.wasm target-docker/ && sha256sum target-docker/*.wasm ;;
      *) echo 'acción desconocida'; exit 2 ;;
    esac"
