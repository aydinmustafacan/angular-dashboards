# CLAUDE.md — angular-dashboards

Layout, requirements and commands are in `README.md`. This file holds the
conventions for code in `projects/ngx-dash-charts/`. New code there should look
like the code already there.

## Component conventions

- Standalone components, signal `input()`/`computed()`,
  `ChangeDetectionStrategy.OnPush`, and behaviour declared in the `host`
  metadata.
- Selectors and classes are prefixed `dash-`. Classes are BEM-style
  (`dash-x__part`), with `ViewEncapsulation.None` and a sibling `.css` file.
  Theme only through `--dash-*` custom properties, each with a fallback.
- Charts extend `DashChartBase` and provide themselves as `DASH_CHART`
  (`src/lib/core/chart-base.ts`). That is how `dash-chart-card` gets table view
  and export, so a compound shell that wraps a chart must still provide it.
- `height="fill"` adds `.dash-fill`, which tells you the host has a definite
  height. Only then is `container-type: size` safe.
- For container queries, follow the existing one in
  `src/lib/dashboard-grid/dashboard-grid.ts`.

## Shipping a new public piece

Export it from `src/public-api.ts`. Add stories next to the component. If the
catalogue changes, update `src/stories/Introduction.mdx`.

For designing reusable component APIs (compound components, slots, presets),
use the `angular-composable-components` skill.
