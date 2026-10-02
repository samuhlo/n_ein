# Skill mechanics

The skill-specific part of [agent-docs](SKILL.md): frontmatter, invocation and routers.

## Invocation

- **Model-invoked** (no `disable-model-invocation`): the description stays loaded so the agent, and other skills, can reach it; the user can still call it by name. Its description is a pointer in permanent context: write it for the model, with the trigger branches. A model-invoked skill that is all reference is also the home for reference several skills share.
- **User-invoked** (`disable-model-invocation: true`): only the person typing its name can run it. Zero context load, but the user must remember it exists; the description becomes a one-line summary for humans.

Choose model invocation only when the agent, or another skill, must reach the skill on its own. Reference shared by two user-invoked skills cannot live in either: put it in a plain file both point to.

## Splitting by invocation

Split off a model-invoked skill when a distinct leading word should trigger it on its own (a word you actually use in prompts) or another skill must reach it; its always-loaded description has to be worth it.

## Routers

When user-invoked skills outgrow memory, one user-invoked **router** skill can list them and when to use each. It can only suggest, never fire them.

## In n_ein

One catalog, `pi-package/skills`, shared by Pi (`/skill:<name>`) and Claude (`/<name>`). Names are short verbs or nouns with no prefix; the `nein-` prefix belongs to the roles. Frontmatter must be valid YAML (quote a description that contains `: `): `tests/skills.ts` checks every skill, because Pi silently drops a broken one.
