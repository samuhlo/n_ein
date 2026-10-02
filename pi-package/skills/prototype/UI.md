# UI prototype

Several **radically different UI variants** on one route, switched from a floating bar at the bottom. The user flips through them, picks one or steals bits from each, and the rest goes. For logic or state questions, use [LOGIC.md](LOGIC.md).

Right shape when: "what should this page look like?", "show me a few options for this dashboard", "try another layout for settings".

## Where the variants live

**Prefer an existing page.** A UI is judged far better against the real header, sidebar, data and density; an empty route makes every variant look fine. Render the variants **on the existing route**, chosen with a `?variant=` param, keeping its data loading, params and auth; only the rendering changes. Something that has no page yet but would live inside one (a new section, a new card, a new step) still goes inside its host page.

**A new route only as a last resort**, for a surface that truly has no home: follow the project's routing convention, put `prototype` in the path or file name, same `?variant=` pattern.

## Steps

1. **State the plan** in one line where the prototype lives: "Three variants of the settings page, switched with `?variant=`, on the existing `/settings` route." Default to **3** variants; past 5 they stop being radically different.
2. **Draft variants that disagree on structure**: layout, information hierarchy, primary action; not colours or copy. Each one respects the page's purpose and data and the project's component system, and exports a clear name (`VariantA`, `VariantB`…). If two come out alike, redo one with an explicit "no card grid" style constraint.
3. **Wire one switcher** on the route, keeping data loading above it:

   ```tsx
   const variant = searchParams.get("variant") ?? "A";
   return (
     <>
       {variant === "A" && <VariantA {...data} />}
       {variant === "B" && <VariantB {...data} />}
       {variant === "C" && <VariantC {...data} />}
       <PrototypeSwitcher variants={["A", "B", "C"]} current={variant} />
     </>
   );
   ```

4. **Build the floating bar**, a small fixed pill at the bottom centre: ← previous, the variant key and name (`B (sidebar layout)`), → next, both wrapping around. Arrows update the URL param through the framework's router so the variant survives reloads and can be shared; the ← and → keys work too, except while an input, textarea or contenteditable has focus. It looks clearly apart from the design, lives in one shared component, and is hidden in production builds.
5. **Hand it over** with the URL and the variant keys. The useful answer is usually "B's header with C's sidebar".
6. **Keep the answer**: record the winner and why in `WORK.md`, fold it properly into the real code (prototype code was written without tests or error handling), and move the losing variants and the switcher to the throwaway branch, out of the main one.

## Anti-patterns

Variants that differ only in colour or copy · a shared `<Layout>` between variants (a shared header is fine) · wiring variants to real mutations · promoting prototype code straight to production.
