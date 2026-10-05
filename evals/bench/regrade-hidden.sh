#!/usr/bin/env bash
# Repite solo la aceptación oculta de S2 sobre la copia corregida de cada ejecución (tras ajustar un test oculto).
set -uo pipefail
bench="${N_EIN_BENCH:-/Users/samu/Documents/01_Proyectos/n_ein-bench}"; repo="${N_EIN_REPO:-/Users/samu/Documents/01_Proyectos/n_ein}"
for run in "$@"; do
  g="$bench/copies/$run-grade"; cp -R "$repo/evals/reserved/s2-anexo3/tests/." "$g/tests/"; out="$(mktemp)"
  (cd "$g" && bunx vitest run tests/api/export/zz-oculto-anexo3-guardado.test.ts tests/components/zz-oculto-panel-anexo3.test.ts --reporter=json --outputFile="$out" >/dev/null 2>&1)
  bun -e 'const [f,gf]=process.argv.slice(1); const r=JSON.parse(await Bun.file(f).text()); const g=JSON.parse(await Bun.file(gf).text()); g.hiddenPass=r.numPassedTests; g.hiddenTotal=r.numTotalTests; g.hidden=`${r.numPassedTests}/${r.numTotalTests}`; await Bun.write(gf, JSON.stringify(g)); console.log(g.run, g.hidden)' "$out" "$bench/logs/$run/grade.json"
done
