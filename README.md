# Angular dashboards

Reusable, domain-agnostic dashboard charts for **Angular 22** and **Angular Material 3**, built on
**Apache ECharts 6** (through `ngx-echarts`), with a **Storybook 10** catalogue and a showcase app.

```
projects/
  ngx-dash-charts/          publishable library (ng-packagr)
    src/lib/                components, each with its *.stories.ts
    src/stories/            Introduction.mdx, story helpers, full-dashboard story
    styles/dash-theme.css   design tokens (light + dark), shipped with the package
    testing/                secondary entry point: demo data + demo dashboard
    .storybook/             Storybook config (Material theme, theme toolbar)
  showcase/                 demo app: a freight network's weekly operations
```

## Requirements

Node **24 LTS** (Angular 22 needs ≥ 22.22.3). The version is pinned with Volta in `package.json`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Showcase app on http://localhost:4200 |
| `npm run storybook` | Storybook on http://localhost:6006 |
| `npm run build:lib` | Build the library into `dist/ngx-dash-charts` |
| `npm run build` | Build the library and the showcase |
| `npm run build-storybook` | Static Storybook in `dist/storybook` |

## Components

| Selector | Purpose |
| --- | --- |
| `dash-trend-chart` | Lines and areas over weeks, days, months or categories |
| `dash-combo-chart` | Columns and lines on one shared value axis |
| `dash-bar-chart` | Grouped or stacked bars, vertical or horizontal |
| `dash-pie-chart` | Donut or pie: selection, live centre label, "Other" folding |
| `dash-kpi-tile` | Headline number, change and sparkline |
| `dash-chart-card` | Material card frame with table view and PNG / CSV export |
| `dash-grid` + `dashSpan` | 12-column dashboard layout driven by container queries |
| `dash-stat-list`, `dash-data-table` | Building blocks for drill-down panels and table views |

Every chart has:

- **Rich tooltips.** Every series at the hovered period, its change vs. the previous period, the
  stack total, shares and reference lines. Replace the tooltip with any `ng-template` through `tooltipTemplate`.
- **Click to drill down.** `pointClick` emits a typed context. If you set a `drilldownTemplate`, it opens
  in a Material side sheet (or a dialog) with the same context.
- **Keyboard access and screen-reader announcements.** Arrow keys move between points, Enter drills
  down and Escape clears.
- **Legend toggling, zoom, synced crosshairs** (`syncGroup`), loading and empty states, and optional
  hatched patterns.
- **Live theming** from `--dash-*` CSS custom properties. Charts follow the OS scheme and
  `data-theme` on `<html>`.

See the **Introduction** page in Storybook for usage.
