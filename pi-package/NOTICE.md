# Avisos de terceros

## Skills derivadas de mattpocock/skills

`tdd`, `diagnose`, `review`, `design`, `glossary`, `research`, `prototype`, `pr`, `agent-docs`, `spec`, `tasks`, `retro` y `tell-again`, y la manera de entrevistar de `intent` y `vision`, son obras derivadas de [mattpocock/skills](https://github.com/mattpocock/skills) (revisión `d81f3a183412e71a5b1e84ca21bc1a35eea03a60`), reescritas para n_ein: sus roles, el documento de trabajo, CodeGraph y su flujo. El menú de vistas de `pr` procede a su vez de la skill `show-me` de Dex Horthy (Humanlayer). Licencia de origen:

```
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Medidores del plugin de Claude y skill `commit`

`claude-plugin/hooks/meter-core.ts` y sus hooks en `register.tsx` adaptan `sub-meter` y `token-meter` de [better-claude](https://github.com/midudev/better-claude) (revisión `96967abb0b26bd26e32947fcdf89ce154ef30fe0`), de Miguel Ángel Durán (midudev), con licencia MIT: el mismo texto de licencia de arriba, con `Copyright (c) 2026 Miguel Ángel Durán (midudev)`.

La skill `commit` toma la idea del comando `commit` del mismo repositorio (grupos lógicos, una sola pregunta, sin atribución); no reproduce su texto.

## Flujo de trabajo

El flujo de n_ein (`flow.md`) se inspira en el Organic Driven Development de [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) (licencia MIT); no reproduce su texto. La comparación frase a frase de `review` para los textos que obedece el agente se inspira en su verificación por tipo de cambio, también sin reproducir su texto. Los nombres y logos de Gentle Shell no se usan.

## Calidad de vida en Pi

La pista para volver a la sesión (`resume.ts`, `extensions/resume.ts`), la carpeta temporal de cada sesión de `bin/n-ein-dev`, las preguntas con opciones (`extensions/ask.ts`) y la carga de los avisos de Herdr desde una lista se inspiran en lo que ofrece [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) (licencia MIT): su pista para retomar, su carpeta temporal, sus preguntas y su informador para Herdr. El código y el texto son propios.

Las extensiones de Herdr y Moshi las instalan y actualizan esas herramientas en el hogar de Pi del usuario. n_ein no las copia, no las modifica ni las distribuye: solo las carga desde su ruta cuando el usuario las nombra en `~/.n_ein/<canal>/pi-extensions`.

## Guarda, medidores de Pi y puente de Claude

La guarda de comandos destructivos (`extensions/guard-core.ts`), la lectura de cuota por cabeceras (`extensions/usage-core.ts`) y la regla de preservar el comportamiento que comparte el código tocado toman ideas de [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) (revisión `2c06244`, licencia MIT); el código y el texto son propios.

`n-ein-install runtime` instala desde npm [pi-claude-bridge](https://github.com/elidickinson/pi-claude-bridge), en la versión que fija `runtime.json`, de Eli Dickinson, con licencia MIT (`Copyright (c) 2026 Eli Dickinson`), con el lockfile de `claude-bridge-runtime/`. n_ein no copia ni modifica su código; lo carga como extensión de Pi.
