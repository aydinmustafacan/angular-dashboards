import { isDevMode } from '@angular/core';
import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  type Module,
  PinnedRowModule,
  RowStyleModule,
  ValidationModule,
  themeQuartz,
} from 'ag-grid-community';

/**
 * Only the AG Grid features the calendar grid uses, so the rest stays out of the bundle. They are
 * handed to the grid instance rather than registered globally: the package is `sideEffects: false`,
 * so a module-level registration could be dropped, and the app's own grids stay unaffected.
 */
export const calendarGridModules: Module[] = [
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  PinnedRowModule,
  CellStyleModule,
  RowStyleModule,
  // Explains misconfigurations in the console during development.
  ...(isDevMode() ? [ValidationModule] : []),
];

/**
 * Quartz, recoloured with the `--dash-*` tokens. The tokens change with the theme, so one grid
 * theme serves light and dark.
 */
export const calendarGridTheme = themeQuartz.withParams({
  backgroundColor: 'var(--dash-surface, #fbfcfc)',
  foregroundColor: 'var(--dash-ink, #15202b)',
  textColor: 'var(--dash-ink, #15202b)',
  accentColor: 'var(--dash-accent, #1d4f91)',
  borderColor: 'var(--dash-grid, #e3e7ea)',
  chromeBackgroundColor: 'var(--dash-surface, #fbfcfc)',
  headerBackgroundColor: 'var(--dash-surface, #fbfcfc)',
  headerTextColor: 'var(--dash-ink, #15202b)',
  headerFontWeight: 600,
  headerFontSize: 13,
  headerColumnBorder: false,
  headerRowBorder: true,
  headerCellHoverBackgroundColor: 'transparent',
  fontFamily: 'var(--dash-font, system-ui, sans-serif)',
  fontSize: 13,
  cellHorizontalPadding: 0,
  columnBorder: false,
  rowBorder: true,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  rowHoverColor: 'transparent',
  pinnedRowBorder: true,
  oddRowBackgroundColor: 'var(--dash-surface, #fbfcfc)',
  browserColorScheme: 'inherit',
  iconSize: 14,
  autoHeightMinBodyHeight: 120,
});
