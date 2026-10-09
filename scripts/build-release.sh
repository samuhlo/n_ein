#!/usr/bin/env bash
set -euo pipefail
# Conserva el punto de entrada antiguo para hotfixes y automatizaciones existentes.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/build-preview.sh" "$@"
