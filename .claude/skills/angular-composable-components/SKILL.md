---
name: angular-composable-components
description: Design and build reusable Angular components that compose instead of piling up inputs — compound components (a shell plus parts sharing state through DI), content-projected slots, a convenience preset, and container-query density. Use this whenever the user wants to create, refactor, or review a reusable Angular/UI-library component (cards, tiles, KPI widgets, list items, headers, form fields, toolbars, panels), asks "how do I make this reusable / flexible / composable", wants to hide, swap or rearrange parts of a component, complains a component has too many inputs or boolean flags, or is designing a component API for a library like ngx-dash-charts — even if they don't say "compound component".
---

# Composable Angular components

A component is reusable when someone can get the common case in one line *and* the uncommon case without editing the component. Inputs alone can't do both: each new variation adds a flag (`showSpark`, `visual`, `captionHtml`…), the flags interact, and eventually the template is a maze of `@if`. Composition solves the second half; a preset keeps the first half.

The worked example throughout is a KPI tile (label, status, big value, delta, a small visual, a caption). The same reasoning applies to any "card with several regions".

## Workflow

Follow these steps in order. Steps 1–2 are thinking, not code — share their result with the user briefly before building, because the API is the hard-to-change part.

### 1. Inventory the anatomy

List the regions of the component and, for each, answer:

- **Optional?** Will some uses omit it?
- **Swappable?** Will some uses want a different thing in that spot (line vs bars vs progress)?
- **Rich content?** Will people want markup, not just a string (links, `<strong>`, icons)?
- **Derived?** Is its data computed from shared inputs (delta from trend), or independent?

Also identify the **behaviour** (click, keyboard, drill-down, tooltips, aria) and the **shared state** (data several regions read).

### 2. Choose the shape

Pick the lightest shape that covers the answers — composition has real costs (more files, more docs, parts that only work inside a parent).

| Situation | Shape |
|---|---|
| Regions fixed, only text/data varies | Plain component with signal inputs. Stop here. |
| One or two regions optional or rich | Plain component + named `ng-content` slots for those regions |
| Several regions optional/swappable/reorderable, sharing derived state | **Compound component**: shell + parts + context via DI, plus a **preset** for the common case |
| Same behaviour across *unrelated* components (theming, export, drill-down) | Shared base class or `hostDirectives` — orthogonal to the above |

Red flags that you've outgrown inputs: boolean `show*` flags, an enum input that selects which sub-template renders, string inputs that people try to put HTML into, or one input that both feeds data *and* toggles a region (e.g. passing `trend` both computes the delta and forces a sparkline to appear).

### 3. Write the usage first

Before any implementation, write the templates a consumer would write for 3–4 real scenarios: the default, a minimal one, one with a swapped part, one with rich content. If a scenario looks awkward, fix the API now. Example:

```html
<!-- common case: preset -->
<dash-kpi-tile label="Shipments" [trend]="weekly" />

<!-- composed: swap the visual, rich caption, no status -->
<dash-kpi label="On-time delivery" [trend]="data" [valueFormat]="pct">
  <dash-kpi-value />
  <dash-kpi-delta label="vs. previous week" />
  <dash-kpi-spark-bars dashKpiVisual />
  <dash-kpi-caption>Target <strong>95%</strong></dash-kpi-caption>
</dash-kpi>

<!-- no visual at all: just leave it out -->
<dash-kpi label="Claims" [value]="12" [delta]="-0.08" [upIsGood]="false">
  <dash-kpi-value /><dash-kpi-delta />
</dash-kpi>
```

### 4. Build the layers

Read `references/patterns.md` for the code templates; this is the summary.

1. **Context** — an `InjectionToken` + an interface describing shared, *derived* state as signals (`value`, `delta`, `deltaGood`, `formattedValue`, `trend`). Compute everything once in the shell, so parts never disagree.
2. **Shell** — owns inputs for shared data, behaviour (click/keyboard/role/aria/drill-down), and layout. Provides itself under the token with `providers` (not `viewProviders` — projected content can't see view providers). Its template is mostly `<ng-content select="…">` slots.
3. **Parts** — small components that `inject()` the context and render one region. They take inputs only for things local to them (`label` on the delta). Each should throw a clear error when used outside the shell (inject with `{ optional: true }` and check), rather than failing with a cryptic DI error.
4. **Slots** — mark interchangeable parts with an attribute directive (`dashKpiVisual`) and project with `<ng-content select="[dashKpiVisual]">`. Use `contentChild()` on the shell when layout must react to whether a slot is filled.
5. **Preset** — the old one-liner component rebuilt *from the parts*, forwarding inputs and exposing a small enum (`visual: 'line' | 'bars' | 'progress' | 'none'`). This keeps existing call sites working and makes the preset the proof that the parts are sufficient. If the preset needs private access to anything, the parts are missing an API.
6. **Density** — make the component respond to *its own* size with container queries, so the same tile works in a 1×1 cell and a wide row. Hide decorative regions first (visual, caption), shrink the value second, never hide the value or label.

### 5. Accessibility and behaviour stay in the shell

Parts change, but the accessible name, role, focus ring and keyboard handling should not depend on which parts are present. Build the aria label in the shell from context signals. Status/good-bad must pair colour with a glyph or word.

### 6. Prove it with stories and tests

- A Storybook story per scenario from step 3, plus a "density" story rendering the same component in small/medium/large containers.
- Unit-test the context's derivations (pure computed logic) — that's where the bugs are.
- Test that a part outside its shell throws the helpful error.

### 7. Migrate without breaking

If you're refactoring an existing component, keep its selector and inputs as the preset. Callers shouldn't need to change. Note any behaviour that moved (e.g. sparkline no longer appears just because `trend` is set — it now depends on `visual`).

## Anti-patterns to avoid

- **Config objects as an escape hatch** (`[config]="{ showSpark: false, … }"`) — same problem as flags, less type-safe.
- **`ng-content` without a shell context** — parts end up re-receiving the same inputs, and derived values drift apart.
- **Inheritance for structure** — a base class is fine for shared *behaviour* across siblings (theming, export); using it to vary layout recreates the flag problem in subclasses.
- **Querying parts to drive them imperatively** (`contentChildren` then calling methods) — let parts read signals from context instead; data flows one way.
- **Hiding by viewport media queries** — a tile's width depends on the grid, not the screen.

## When working in ngx-dash-charts

Follow the repo's existing conventions so the new code reads like the old:

- Standalone components, signal `input()`/`computed()`, `ChangeDetectionStrategy.OnPush`, behaviour declared in the `host` metadata.
- Selectors and classes prefixed `dash-`; BEM-style `dash-x__part` classes with `ViewEncapsulation.None` and a sibling `.css` file, theming only via `--dash-*` custom properties with fallbacks.
- Charts extend `DashChartBase` and provide themselves as `DASH_CHART` (`core/chart-base.ts`) so `dash-chart-card` gets table view and export — a compound shell that wraps a chart should keep doing that.
- `height="fill"` adds `.dash-fill`; that's the signal the host has a definite height, which is when `container-type: size` is safe.
- Container-query precedent: `dashboard-grid/dashboard-grid.ts`.
- Export new public pieces from `src/public-api.ts`, add stories next to the component, and update `src/stories/Introduction.mdx` if the catalogue changes.
