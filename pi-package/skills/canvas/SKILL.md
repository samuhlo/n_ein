---
name: canvas
description: Present design variants, read and apply comments on elements, preserve a chosen direction, and compare it with an implemented local application.
---

# Design and visual acceptance

Keep the project's stack and design tokens. `vision` settles scope; `prototype` explores one question. This view connects their files and feedback to implementation, without creating a second task board.

Create self-contained HTML directions under `docs/design/<slug>/`, one file per variant. Inline styles/scripts and embedded data images; no external fonts, scripts or network. Use real content, accessible markup and the project's tokens. Preserve existing directions and comments when iterating; change only the referenced files.

Register `design.json` after the HTML exists:

```json
{
  "schema": 1,
  "title": "Settings",
  "brief": "The question these variants answer",
  "artboards": [
    {"file":"01-simple.html","title":"Simple","tradeoff":"Less detail visible"},
    {"file":"02-detail.html","title":"Detailed","tradeoff":"More information to scan"}
  ]
}
```

`"$N_EIN_ROOT/bin/n-ein-work" open` returns the local view. Pi also has `/nein:disenos`; Claude has `/nein-disenos`. A user can point at an element, add a comment or screenshot, select a direction, and copy the next request to the conversation. A chosen design alone does not authorize code.

Use `design show --slug <slug>` to read its manifest and comments. Before applying feedback, inspect the comment's file, selector, excerpt and screenshot when present. Resolve only feedback actually applied:

```sh
"$N_EIN_ROOT/bin/n-ein-work" design resolve --slug settings --file 01-simple.html --data '{"id":"comment-id"}'
```

After the user authorizes implementation, keep WORK.md's existing scope and record progress with `design implement --slug ... --file ... --data '{"status":"in_progress","note":"..."}'`. On completion use `status: "implemented"` and the application's real loopback `preview` URL. The view compares the selected HTML and the application; an external application that refuses framing can be opened in a separate tab.

Visual acceptance is separate. Exercise the requested sizes and states (normal, empty, loading, error and recovery when applicable), using browser evidence or the user's actual observation. Record only what was observed with `design accept --slug ... --file ... --data '{"note":"states actually exercised"}'`. Optional `screenshot` is `{ "type":"image/png", "data":"base64" }` (PNG/JPEG, below 2 MB). Never mark acceptance merely because code compiled or the agent says implementation is done. If browser access is unavailable, leave visual acceptance pending and explain the exact gap.

The acceptance record binds source code and artboard bytes. It becomes historical after either changes; it does not certify external services or an application deployed from other bytes. All records stay in the project's design folder and remain readable without n_ein.
