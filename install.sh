#!/usr/bin/env bash
set -euo pipefail
# [FLOW] ENTRADA PÚBLICA
# Solo descarga un instalador fijado; Go resuelve el canal y verifica el paquete.
bootstrap_tag="v0.2.0-alpha.1"
channel=""
version=""
dry=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --channel) [[ $# -ge 2 ]] || { echo 'falta canal' >&2; exit 64; }; channel="$2"; shift 2 ;;
    --version) [[ $# -ge 2 ]] || { echo 'falta versión' >&2; exit 64; }; version="$2"; shift 2 ;;
    --dry-run) dry=1; shift ;;
    --help|-h) echo 'n_ein: install.sh [--channel preview|stable] [--version 0.2.0-alpha.1] [--dry-run]'; exit 0 ;;
    *) echo "opción desconocida: $1" >&2; exit 64 ;;
  esac
done
case "$channel" in ''|preview|stable) ;; *) echo 'canal inválido' >&2; exit 64 ;; esac
if [[ -n "$version" && ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then echo 'versión inválida' >&2; exit 64; fi
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin-arm64 ;;
  Linux-x86_64) platform=linux-amd64 ;;
  *) echo 'plataforma no soportada: macOS arm64 o Linux x86_64' >&2; exit 69 ;;
esac
command -v curl >/dev/null || { echo 'falta curl' >&2; exit 69; }
if command -v sha256sum >/dev/null; then hash=(sha256sum)
elif command -v shasum >/dev/null; then hash=(shasum -a 256)
else echo 'falta sha256sum o shasum' >&2; exit 69; fi
# El override permite probar estos mismos bytes contra un servidor de fixtures local.
base="${N_EIN_BOOTSTRAP_BASE_URL:-https://github.com/samuhlo/n_ein/releases/download/$bootstrap_tag}"
case "$base" in https://*|http://127.0.0.1:*|http://localhost:*) ;; *) echo 'se requiere HTTPS' >&2; exit 64 ;; esac
area="$(mktemp -d)"
trap 'rm -rf "$area"' EXIT
asset="n-ein-install-${bootstrap_tag#v}-$platform"
curl --fail --silent --show-error --location --retry 2 --connect-timeout 15 --max-time 180 "$base/$asset" -o "$area/$asset"
curl --fail --silent --show-error --location --retry 2 --connect-timeout 15 --max-time 30 "$base/$asset.sha256" -o "$area/checksum"
read -r expected filename extra < "$area/checksum"
if [[ ! "$expected" =~ ^[0-9a-f]{64}$ || "$filename" != "$asset" || -n "${extra:-}" ]]; then echo 'checksum inválido' >&2; exit 65; fi
actual="$("${hash[@]}" "$area/$asset")"
if [[ "${actual%% *}" != "$expected" ]]; then echo 'SHA-256 incorrecto; no se ejecuta el instalador' >&2; exit 65; fi
chmod 700 "$area/$asset"
args=(fetch)
[[ -z "$channel" ]] || args+=(--channel "$channel")
[[ -z "$version" ]] || args+=(--version "$version")
[[ "$dry" == 0 ]] || args+=(--dry-run)
"$area/$asset" "${args[@]}"
