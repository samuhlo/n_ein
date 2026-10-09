---
name: readme
description: "n_ein README style: centered ./NAME.sh header, yellow-on-black badges, // 00_ SECTION headings, tables and a signed footer. Use when creating, rewriting or restyling a project README."
---

# READMEs with house style

A README answers four questions fast: what this is, why it exists, how to start, where the detail lives. It is a front page, not the manual: when it grows past one screen per section, move the detail to `docs/` and link it. Never drop information while restyling; relocate it.

Before writing, read the current README, the package manifest, the remote and any existing README by the same owner. The user's other repositories are the strongest style reference: match them over the template. Write in the project's documentation language.

## Steps

1. Collect facts: name, one-sentence promise, real stack and versions from manifests, install or start commands that exist, scripts, layout, status, license file. Unknown facts stay out; never invent badges, URLs, endpoints or claims.
2. Pick the sections that fit the project from [TEMPLATE.md](TEMPLATE.md): an app leads with the friction and what it does; a tool or CLI leads with a quick start. Number them in order from `00`.
3. Write each section short: one paragraph or one table or one code block, plus a link for the rest.
4. Keep anything machine-read untouched: HTML comment metadata blocks, badges wired to CI, anchors other docs link to.
5. Check every relative link and command against the tree before finishing.

## Grammar

- Header centered: `<h1><code>./PROJECT-NAME.sh</code></h1>`, then a bold one-sentence promise, then badges, then an optional link row joined by ` · `.
- Badges: shields.io `for-the-badge`, a `STATUS-<STATE>` chip in `FFCA40`, one row per layer with color `0C0011`, `labelColor=000000` and `logoColor=FFCA40`. Use a simple-icons logo only when it exists; otherwise a text badge.
- Sections: `## // 00_ UPPER_SNAKE_TITLE`, separated by `---`.
- Tables with uppercase headers and left alignment (`| :--- |`); bold first column for named things.
- Asides as `> _note: lowercase sentence._`. Flows and layouts in ` ```text ` blocks with `→` or a tree; commands in ` ```bash ` with a short `# comment` per line.
- Plain, direct sentences; no emojis, no marketing filler, no "simply" or "just".
- Footer centered: `<code>DESIGNED & CODED BY <a href="https://github.com/<owner>"><owner></a></code>`, with the owner taken from the remote. Add a `<small>` location line only when the owner's other READMEs or preferences give one.

Explicit project conventions win over this style; a README that already follows another house style is restyled only on request.
