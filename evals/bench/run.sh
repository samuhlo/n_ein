#!/usr/bin/env bash
# =============================================================================
# [BENCH] UNA EJECUCIÓN
# uso: run.sh <escenario> <variante> <repetición>
#   escenario: s1 | s2 | s3          variante: A | N1 | N2 | N3 | G | GE | M | C
# Cada ejecución tiene su copia del corpus, su origin bare y su HOME aislado:
# nada escribe en el ~ real, en los proyectos de Samu ni en los hogares de n_ein.
# Con STOP_AFTER_COMMIT=1 se corta al aparecer el primer commit (escenario S4a).
# =============================================================================
set -uo pipefail

bench="${N_EIN_BENCH:-/Users/samu/Documents/01_Proyectos/n_ein-bench}"
repo="${N_EIN_REPO:-/Users/samu/Documents/01_Proyectos/n_ein}"
scenario="$1"; arm="$2"; rep="$3"
run="${scenario}-${arm}-r${rep}${RUN_SUFFIX:-}"
copy="$bench/copies/$run"; home="$bench/homes/$run"; log="$bench/logs/$run"
model="${BENCH_MODEL:-gpt-6-sol}"; effort="${BENCH_EFFORT:-medium}"
pi_bin="$HOME/.n_ein/runtimes/pi/1.0.2/bin/pi"
# Credenciales propias del banco: un login aparte, para no rotar las de los hogares de trabajo.
auth_master="$bench/auth/pi-agent/auth.json"
codex_auth="$bench/auth/codex/auth.json"

case "$scenario" in
  s1) base=111489af; prompt='Los certificados sin enlace normativo válido, o cuyo enlace no pasa la allowlist del BOE, se rechazan con 422 antes de importar, pero su estado se queda en `not_imported` y el poblador los reintenta en cada pasada. Arréglalo: deben quedar en `failed`, sin tocar la red ni pasar por `importing`. Un certificado inexistente sigue dando 404 sin mutar nada.' ;;
  s2) base=4d66007; prompt='Haz que el Anexo III lea la planificación guardada del curso en el servidor en vez del cuerpo que manda el cliente, y que el cliente deje de mandarla cuando hay curso.' ;;
  s3) base=4d66007; prompt='Cierra las deudas de `docs/alpha-v1/estado-actual.md`: que al dar de alta un centro se rechace a quien ya tiene cursos propios o módulos asignados; que `tests/pages/anexo-iv-codigo.test.ts` monte el componente en vez de leerlo como texto; y corrige el documento, que todavía da en gris el botón «Crear un curso» del centro.' ;;
  s5) base=4d66007; prompt='Documenta en el README todos los scripts de base de datos y de semillas de `package.json` (los `db:*` y `seed:*`): qué hace cada uno y sobre qué entorno actúa. Es solo documentación: no cambies código.' ;;
  s6) base=4d66007; prompt='En el panel del centro, que el título «Los cursos del centro» muestre cuántos cursos hay, por ejemplo «Los cursos del centro (3)». Si no hay ninguno, el título se queda como está.' ;;
  *) printf '[ERR] :: BENCH_SCENARIO :: %s\n' "$scenario" >&2; exit 64 ;;
esac

if [[ -n "${RESUME_FROM:-}" ]]; then
  # S4a: la ejecución cortada queda tal cual; la reanudación trabaja sobre su copia y su hogar.
  copy="$bench/copies/$RESUME_FROM"; home="$bench/homes/$RESUME_FROM"
  prompt="${RESUME_PROMPT:-Continúa el trabajo pendiente.}"
fi

# --- copia del corpus -------------------------------------------------------
if [[ -z "${RESUME_FROM:-}" ]]; then
rm -rf "$copy" "$home" "$log" "$bench/remotes/$run.git"
mkdir -p "$home" "$log"
cp -c -R "$bench/bases/$base" "$copy"
git -C "$copy" config user.name samuhlo
git -C "$copy" config user.email samu13lop@gmail.com
if [[ "$arm" == M ]]; then
  # Lo que dejaría /setup-matt-pocock-skills: gestor de incidencias en Markdown local.
  tpl="$bench/products/matt/skills/engineering/setup-matt-pocock-skills"
  mkdir -p "$copy/docs/agents"
  cp "$tpl/issue-tracker-local.md" "$copy/docs/agents/issue-tracker.md"
  cp "$tpl/domain.md" "$copy/docs/agents/domain.md"
  printf '## Agent skills\n\n### Issue tracker\n\nIssues live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.\n\n### Domain docs\n\nSingle-context. See `docs/agents/domain.md`.\n' > "$copy/AGENTS.md"
  git -C "$copy" add -A && git -C "$copy" commit -qm "chore: configura las skills de ingeniería"
fi
git clone -q --bare "$copy" "$bench/remotes/$run.git"
git -C "$copy" remote add origin "$bench/remotes/$run.git"
git -C "$copy" fetch -q origin && git -C "$copy" branch -q -u origin/main main
base_rev="$(git -C "$copy" rev-parse HEAD)"
fi
if [[ -n "${RESUME_FROM:-}" ]]; then
  rm -rf "$log"; mkdir -p "$log"
  base_rev="$(bun -e 'console.log(JSON.parse(await Bun.file(process.argv[1]).text()).base_rev)' "$bench/logs/$RESUME_FROM/meta.json")"
fi

# --- hogar aislado ----------------------------------------------------------
mkdir -p "$home/pi-agent" "$home/.config"
if [[ -z "${RESUME_FROM:-}" ]]; then
printf '[user]\n\tname = samuhlo\n\temail = samu13lop@gmail.com\n' > "$home/.gitconfig"
cp "$auth_master" "$home/pi-agent/auth.json"
# Fase 2: cada variante N0 y AL trabaja entera en un modelo y esfuerzo.
case "$arm" in
  N0L|AL) model=gpt-6-luna; effort=medium ;;
  N0LH) model=gpt-6-luna; effort=high ;;
  N0S|N0SNC|N0SNR) model=gpt-6-sol; effort=medium ;;
  N0SH) model=gpt-6-sol; effort=high ;;
esac
uniform="{\"model\":\"openai-codex/$model\",\"thinking\":\"$effort\"}"
printf '{"schema":1,"agents":{"principal":%s,"scout":%s,"worker":%s,"reviewer":%s}}\n' "$uniform" "$uniform" "$uniform" "$uniform" > "$home/models.json"
if [[ "$arm" == NR ]]; then
  printf '{"schema":1,"agents":{"principal":{"model":"nein/auto","thinking":"medium"}}}\n' > "$home/models.json"
fi
if [[ "$arm" == N1L ]]; then
  # Bloque de delegación: el principal igual que el resto; los roles con los modelos por defecto de n_ein.
  printf '{"schema":1,"agents":{"principal":%s,"scout":{"model":"openai-codex/gpt-6-luna","thinking":"low"},"worker":{"model":"openai-codex/gpt-6-luna","thinking":"high"},"reviewer":{"model":"openai-codex/gpt-6-sol","thinking":"medium"}}}\n' "$uniform" > "$home/models.json"
fi
printf '{"chat":"es","artifacts":"proyecto"}\n' > "$home/lang.json"
fi

# PI_OFFLINE solo quita las operaciones de red del arranque: un arranque colgado ya paró una prueba.
export HOME="$home" DO_NOT_TRACK=1 PI_SKIP_VERSION_CHECK=1 NO_UPDATE_NOTIFIER=1 PI_OFFLINE=1
export BUN_INSTALL_CACHE_DIR="/Users/samu/.bun/install/cache"

launch() {
  case "$arm" in
    A|AL)
      PI_CODING_AGENT_DIR="$home/pi-agent" "$pi_bin" -p "$1" --mode json --no-extensions --no-skills \
        --model "openai-codex/$model" --thinking "$effort" ;;
    N0L|N0LH|N0S|N0SH|N0SNC|N0SNR|NR)
      local product="$bench/products/n0"; [[ "$arm" == N0SNR ]] && product="$bench/products/n0nr"; [[ "$arm" == NR ]] && product="$bench/products/nr"
      # Sin CodeGraph: un binario inexistente hace que el lanzador avise y siga, y la herramienta no se registra.
      local cg=(); [[ "$arm" == N0SNC ]] && cg=(N_EIN_CODEGRAPH_BIN=/nonexistent/codegraph)
      env ${cg[@]+"${cg[@]}"} N_EIN_HOME=/Users/samu/.n_ein N_EIN_AGENT_DIR="$home/pi-agent" N_EIN_MODELS_FILE="$home/models.json" \
        N_EIN_LANG_FILE="$home/lang.json" "$product/bin/n-ein-dev" -p "$1" --mode json ;;
    N1|N2|N3|N1L)
      local product="$bench/products/$(tr '[:upper:]' '[:lower:]' <<< "${arm%L}")"
      N_EIN_HOME=/Users/samu/.n_ein N_EIN_AGENT_DIR="$home/pi-agent" N_EIN_MODELS_FILE="$home/models.json" \
        N_EIN_LANG_FILE="$home/lang.json" "$product/bin/n-ein-dev" -p "$1" --mode json ;;
    G|GE)
      if [[ "$arm" == GE && ! -d "$home/gentle-agent" ]]; then
        # Hogar provisionado una vez con `gentle-shell setup` (gentle-engram y compañeros), copiado por ejecución.
        cp -c -R "$bench/homes/ge-setup/gentle-agent" "$home/gentle-agent"
        cp -c -R "$bench/homes/ge-setup/.gentle-ai" "$home/.gentle-ai" 2>/dev/null
      fi
      mkdir -p "$home/.pi/gentle-ai" "$home/gentle-agent"
      printf '{"mode":"neutral"}\n' > "$home/.pi/gentle-ai/persona.json"
      cp -n "$home/pi-agent/auth.json" "$home/gentle-agent/auth.json"
      printf '{"default_model":"openai-codex/%s","default_effort":"%s"}\n' "$model" "$effort" > "$home/gentle-agent/subagents.json"
      # BLINDAJE -> Engram con puerto y datos propios de la ejecución: ni comparte servidor con otra ni toca el de Samu.
      export ENGRAM_PORT="$((7500 + $(cksum <<< "$run" | cut -d' ' -f1) % 400))"
      GENTLE_SHELL_HOME="$home/gentle-agent" GENTLE_SHELL_CONFIG="$home/gentle-config.json" GENTLE_SHELL_NO_AUTO_SETUP=1 \
        node "$bench/products/gentle/node_modules/gentle-pi/bin/gentle-shell.mjs" -p "$1" --mode json \
        --model "openai-codex/$model" --thinking "$effort" ;;
    M)
      PI_CODING_AGENT_DIR="$home/pi-agent" "$pi_bin" -p "$1" --mode json --no-extensions --no-skills \
        --skill "$bench/products/matt/skills/engineering" --skill "$bench/products/matt/skills/productivity" \
        --model "openai-codex/$model" --thinking "$effort" ;;
    C)
      mkdir -p "$home/codex"
      cp "$codex_auth" "$home/codex/auth.json"
      printf 'model = "%s"\nmodel_reasoning_effort = "%s"\n' "$model" "$effort" > "$home/codex/config.toml"
      CODEX_HOME="$home/codex" codex exec --json --sandbox workspace-write --skip-git-repo-check "$1" < /dev/null ;;
    *) printf '[ERR] :: BENCH_ARM :: %s\n' "$arm" >&2; return 64 ;;
  esac
}

# El encargo de Matt en S2/S3 sigue su recorrido: spec, tickets e implementación,
# cada uno como un mensaje del usuario en la misma sesión.
messages=("$prompt")
if [[ "$arm" == M && "$scenario" != s1 && -z "${RESUME_FROM:-}" ]]; then
  messages=("/skill:to-spec $prompt" "/skill:to-tickets" "/skill:implement")
fi

# Mata el proceso y todos sus descendientes: un trabajador huérfano seguiría escribiendo en la copia.
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null
}

start=$(date +%s); status=0; turn=0
cd "$copy"
for message in "${messages[@]}"; do
  turn=$((turn + 1))
  extra=(); [[ $turn -gt 1 ]] && extra=(--continue)
  if [[ "$arm" == C ]]; then
    (launch "$message") > "$log/events-$turn.jsonl" 2> "$log/stderr-$turn.txt" &
  else
    (launch "$message" ${extra[@]+"${extra[@]}"}) < /dev/null > "$log/events-$turn.jsonl" 2> "$log/stderr-$turn.txt" &
  fi
  pid=$!
  if [[ -n "${STOP_AFTER_SECONDS:-}" ]]; then
    waited=0
    while kill -0 "$pid" 2>/dev/null; do
      if [[ $waited -ge $STOP_AFTER_SECONDS ]]; then
        kill_tree "$pid"; echo stopped > "$log/stopped"; break
      fi
      sleep 5; waited=$((waited + 5))
    done
  fi
  if [[ "${STOP_AFTER_COMMIT:-0}" == 1 ]]; then
    while kill -0 "$pid" 2>/dev/null; do
      if [[ "$(git -C "$copy" rev-list --all --count)" -gt "$(git -C "$copy" rev-list --count "$base_rev")" ]]; then
        sleep 2; kill_tree "$pid"; echo stopped > "$log/stopped"; break
      fi
      sleep 3
    done
  fi
  wait "$pid"; status=$?
done
end=$(date +%s)
# Un servidor de Engram arrancado por la ejecución no debe sobrevivirla.
[[ -n "${ENGRAM_PORT:-}" ]] && pkill -f "engram.*serve.*${ENGRAM_PORT}" 2>/dev/null
printf '{"run":"%s","scenario":"%s","arm":"%s","rep":%s,"base":"%s","base_rev":"%s","exit":%s,"wall_s":%s,"turns":%s,"model":"%s","effort":"%s"}\n' \
  "$run" "$scenario" "$arm" "$rep" "$base" "$base_rev" "$status" "$((end - start))" "$turn" "$model" "$effort" > "$log/meta.json"
printf '%s exit=%s wall=%ss\n' "$run" "$status" "$((end - start))"
