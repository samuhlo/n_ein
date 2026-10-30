# Sketches

Low-fidelity HTML so the user **sees** the structure before anyone builds it. A sketch answers "is this what you mean?", not "is this pretty?".

## The file

1. **Start from the skeleton.** Copy [skeleton.html](skeleton.html) from this skill's directory to `docs/design/<topic>.html` with a shell copy, then replace its two example sheets. Never retype the stylesheet: it is already there.
2. **Open it once** with `open` on macOS or `xdg-open` on Linux. After later edits, tell the user which sheet changed and to reload; the hash keeps their place.
3. **Edit, never rewrite.** Each round changes only the sheets it touches, with targeted edits. Do not paste the HTML into the conversation; refer to sheets by number and to marks by their pin.

The file stays self-contained: no external scripts, fonts, images or network requests, so it opens offline from disk and survives in the repository.

## Sheets

Each `<section class="sheet">` is one tab: an `id`, a `data-tab` label (`3 · Settings`) and an `<h2>` with the same title. Under it, one line on what the sheet is for, the drawing, and a `notes` list. Number sheets in the order the user meets them.

- **Screens.** A `frame` (add `phone` when mobile matters) built from `nav`, `row`, `col`, `card`, `box`, `img`, `line`, `input` and `btn`. Mark the **primary action** with `btn primary`, the only colour on the sheet. Use real labels for navigation and actions, `line` bars for body text. Link buttons to the sheet they lead to (`href="#s4"`) so the flow can be clicked through.
- **Flows.** A `flow` of `node`s and `arrow`s; `node alt` for optional or error paths. Branching flows that do not read in a line can use a small inline SVG in grey.
- **Data.** `entities` with one `entity` each: name, then fields with a short type or `→ Other` for a relation.
- **States.** A `flow` from state to state, the event on each arrow's side in `muted` text.
- **Pins and notes.** A `pin` in the drawing ties a spot to the numbered note below; notes say what to notice or the question being asked.

## Variants

When the open decision is between layouts, show two or three as sibling sheets (`2A`, `2B`, `2C`) that disagree on **structure**: layout, hierarchy, primary action. Not colour or wording. If two come out alike, redo one. Once the user chooses, mark the winner as sheet `2`. Preserve the other directions as alternatives when using the `canvas` skill, so the user can compare them; do not silently delete their feedback.

## Fidelity

Structure, hierarchy, flow and data only. No brand colours, fonts, icons, polished copy or animation. Those are later decisions for the real page or a `prototype`. A sketch that looks finished invites feedback on the wrong things.

For variants, pinned element comments, screenshots or comparison with implementation, use the `canvas` skill. Register one self-contained HTML file per direction under `docs/design/<slug>/`; the brief and WORK.md link it. Choosing a direction still does not authorize implementation.
