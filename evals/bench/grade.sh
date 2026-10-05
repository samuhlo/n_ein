#!/usr/bin/env bash
# =============================================================================
# [BENCH] CORRECCIÓN DE UNA EJECUCIÓN
# uso: grade.sh <run>   → escribe logs/<run>/grade.json
# Trabaja sobre una copia del resultado, nunca sobre la del agente. La
# aceptación oculta vive en evals/reserved/ y el agente no la vio.
# =============================================================================
set -uo pipefail

bench="${N_EIN_BENCH:-/Users/samu/Documents/01_Proyectos/n_ein-bench}"
repo="${N_EIN_REPO:-/Users/samu/Documents/01_Proyectos/n_ein}"
run="$1"; log="$bench/logs/$run"; src="$bench/copies/$run"; g="$bench/copies/$run-grade"
scenario="$(bun -e 'console.log(JSON.parse(await Bun.file(process.argv[1]).text()).scenario)' "$log/meta.json")"
base_rev="$(bun -e 'console.log(JSON.parse(await Bun.file(process.argv[1]).text()).base_rev)' "$log/meta.json")"
rm -rf "$g"; cp -c -R "$src" "$g"; cd "$g"

# vitest con reporter JSON: devuelve "pasados total" de los archivos pedidos.
vt() {
  local out; out="$(mktemp)"
  bunx vitest run "$@" --reporter=json --outputFile="$out" >/dev/null 2>&1
  bun -e 'try { const r=JSON.parse(await Bun.file(process.argv[1]).text()); console.log(r.numPassedTests, r.numTotalTests, r.numFailedTestSuites, r.numFailedTests) } catch { console.log("0 0 1 -1") }' "$out"
  rm -f "$out"
}

# --- suite y typecheck del resultado, sin la aceptación oculta ---------------
read -r suite_pass suite_total suite_bad_files suite_failed <<< "$(vt)"
if bun run typecheck >/dev/null 2>&1; then typecheck=true; else typecheck=false; fi

hidden_pass=0; hidden_total=0; extra='{}'
case "$scenario" in
  s1)
    git checkout -q "$base_rev" -- tests/api/anexo4-import.test.ts
    git apply "$repo/evals/reserved/planificador-anexo4.patch"
    read -r hidden_pass hidden_total _ <<< "$(vt tests/api/anexo4-import.test.ts)" ;;
  s2)
    cp -R "$repo/evals/reserved/s2-anexo3/tests/." tests/
    read -r hidden_pass hidden_total _ <<< "$(vt tests/api/export/zz-oculto-anexo3-guardado.test.ts tests/components/zz-oculto-panel-anexo3.test.ts)" ;;
  s3)
    cp -R "$repo/evals/reserved/s3-deudas/tests/." tests/
    read -r hidden_pass hidden_total _ <<< "$(vt tests/api/zz-oculto-alta-centro.test.ts)"
    # S3b: el test del Anexo IV debe montar la página y caer ante dos mutantes.
    t=tests/pages/anexo-iv-codigo.test.ts; page='app/pages/anexo-iv/[codigo].vue'
    reads_text=false; grep -q "readFileSync" "$t" && reads_text=true
    mounts=false; grep -Eq "mount(Suspended)?\(" "$t" && mounts=true
    read -r own_pass own_total own_bad _ <<< "$(vt "$t")"
    killed=0
    cp "$page" /tmp/bench-page.vue
    perl -0pi -e 's/<AutosaveStatus\b[^>]*\/>//g; s/<AutosaveStatus\b.*?<\/AutosaveStatus>//gs' "$page"
    read -r p1 t1 b1 _ <<< "$(vt "$t")"; [[ "$p1" != "$t1" || "$b1" != 0 ]] && killed=$((killed + 1))
    cp /tmp/bench-page.vue "$page"
    perl -0pi -e "s/navigateTo\\(\\s*['\"]\\/['\"]\\s*,\\s*\\{\\s*replace:\\s*true\\s*\\}\\s*\\)/undefined/g" "$page"
    read -r p2 t2 b2 _ <<< "$(vt "$t")"; [[ "$p2" != "$t2" || "$b2" != 0 ]] && killed=$((killed + 1))
    cp /tmp/bench-page.vue "$page"
    # S3c: el documento ya no da en gris el botón del centro.
    doc_fixed=true
    # Corregido = no queda ninguna de las tres frases de 4d66007 que daban el botón por gris.
    for stale in "«Crear un curso» del panel del centro sigue en gris" "«Crear un curso» del centro, que sigue en gris" "sigue en gris a propósito es el botón «Crear un curso»"; do
      grep -Fq "$stale" docs/alpha-v1/estado-actual.md && doc_fixed=false
    done
    extra="{\"mount\":{\"readsText\":$reads_text,\"mounts\":$mounts,\"pass\":\"$own_pass/$own_total\",\"mutantsKilled\":$killed},\"docFixed\":$doc_fixed}" ;;
  s5)
    # Cobertura: cada script db:* y seed:* de package.json nombrado en el README; y solo documentación tocada.
    scripts="$(bun -e 'const p=JSON.parse(await Bun.file("package.json").text()); console.log(Object.keys(p.scripts).filter(k=>/^(db|seed):/.test(k)).join(" "))')"
    for k in $(printf '%s' "$scripts"); do hidden_total=$((hidden_total + 1)); grep -Fq "$k" README.md && hidden_pass=$((hidden_pass + 1)); done
    code_touched="$(git diff --name-only "$base_rev" -- . ':(exclude)*.md' | grep -cv '^$')"
    extra="{\"codeFilesTouched\":$code_touched}" ;;
  s6)
    cp -R "$repo/evals/reserved/s6-titulo/tests/." tests/
    read -r hidden_pass hidden_total _ <<< "$(vt tests/components/zz-oculto-titulo-centro.test.ts)" ;;
esac

printf '{"run":"%s","hidden":"%s/%s","hiddenPass":%s,"hiddenTotal":%s,"suite":"%s/%s","suiteBadFiles":%s,"suiteFailed":%s,"typecheck":%s,"extra":%s}\n' \
  "$run" "$hidden_pass" "$hidden_total" "$hidden_pass" "$hidden_total" "$suite_pass" "$suite_total" "$suite_bad_files" "$suite_failed" "$typecheck" "$extra" | tee "$log/grade.json"
