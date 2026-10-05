#!/usr/bin/env bash
# =============================================================================
# [BENCH] S4a · CORTAR Y RETOMAR
# uso: s4.sh <variante> <segundos de corte>
# Lanza S3 y lo mata al llegar al corte; guarda las métricas del tramo cortado
# y retoma con «Continúa el trabajo pendiente.» en una sesión nueva sobre la
# misma copia y el mismo hogar. La corrección final se hace sobre la copia.
# =============================================================================
set -uo pipefail
bench="${N_EIN_BENCH:-/Users/samu/Documents/01_Proyectos/n_ein-bench}"
scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
arm="$1"; cut="$2"; cutrun="s3-$arm-r1-cut"
RUN_SUFFIX=-cut STOP_AFTER_SECONDS="$cut" "$scripts/run4.sh" s3 "$arm" 1
bun "$scripts/analyze.ts" "$cutrun" > /dev/null && cp "$bench/logs/$cutrun/metrics.json" "$bench/logs/$cutrun/metrics-cut.json"
git -C "$bench/copies/$cutrun" log --all --oneline > "$bench/logs/$cutrun/git-at-cut.txt"
git -C "$bench/copies/$cutrun" status --porcelain > "$bench/logs/$cutrun/status-at-cut.txt"
RUN_SUFFIX=-resume RESUME_FROM="$cutrun" "$scripts/run4.sh" s3 "$arm" 1
# Tras la reanudación, el hogar acumula los dos tramos: el total menos el corte da la reanudación.
bun "$scripts/analyze.ts" "$cutrun" > /dev/null
