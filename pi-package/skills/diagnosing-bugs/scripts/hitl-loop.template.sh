#!/usr/bin/env bash
# Bucle de reproducción con una persona en medio.
# Copia este archivo, edita los pasos de abajo y ejecútalo.
# El agente lanza el script; el usuario sigue las indicaciones en su terminal.
#
# Uso:
#   bash hitl-loop.template.sh
#
# Dos ayudas:
#   step "<instrucción>"          → muestra la instrucción y espera Enter
#   capture VAR "<pregunta>"      → muestra la pregunta y guarda la respuesta en VAR
#
# Al final, lo capturado se imprime como CLAVE=VALOR para que el agente lo lea.
#
# `capture` devuelve su valor a la terminal, donde lo lee el agente: captura
# observaciones y deja el inicio de sesión al usuario como un `step`.

set -euo pipefail

step() {
  printf '\n>>> %s\n' "$1"
  read -r -p "    [Enter cuando termines] " _
}

capture() {
  local var="$1" question="$2" answer
  printf '\n>>> %s\n' "$question"
  read -r -p "    > " answer
  printf -v "$var" '%s' "$answer"
}

# --- edita debajo -------------------------------------------------------

step "Abre la app en http://localhost:3000 e inicia sesión."

capture ERRORED "Pulsa el botón 'Exportar'. ¿Dio un error? (s/n)"

capture ERROR_MSG "Pega el mensaje de error (o 'ninguno'):"

# --- edita encima -------------------------------------------------------

printf '\n--- Capturado ---\n'
printf 'ERRORED=%s\n' "$ERRORED"
printf 'ERROR_MSG=%s\n' "$ERROR_MSG"
