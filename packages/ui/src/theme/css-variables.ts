import type { FamilyCoUITheme } from './familyco-theme.js';

export const buildFamilyCoCssVariables = (theme: FamilyCoUITheme): Record<string, string> => ({
  '--fc-background': theme.colors.background,
  '--fc-surface': theme.colors.surface,
  '--fc-surface-muted': theme.colors.surfaceMuted,
  '--fc-text-main': theme.colors.textMain,
  '--fc-text-muted': theme.colors.textMuted,
  '--fc-text-faint': theme.colors.textFaint,
  '--fc-border-subtle': theme.colors.borderSubtle,
  '--fc-primary': theme.colors.primary,
  '--fc-primary-hover': theme.colors.primaryHover,
  '--fc-primary-foreground': theme.colors.primaryForeground,
  '--fc-success': theme.colors.success,
  '--fc-warning': theme.colors.warning,
  '--fc-error': theme.colors.error,
  '--fc-info': theme.colors.info,
  '--fc-font-family': theme.typography.fontFamily,
  '--fc-page-title-size': theme.typography.pageTitleSize,
  '--fc-section-title-size': theme.typography.sectionTitleSize,
  '--fc-body-size': theme.typography.bodySize,
  '--fc-caption-size': theme.typography.captionSize,
  '--fc-page-x': theme.spacing.pageX,
  '--fc-page-y': theme.spacing.pageY,
  '--fc-section-gap': theme.spacing.sectionGap,
  '--fc-card-padding': theme.spacing.cardPadding,
  '--fc-card-radius': theme.radius.card,
  '--fc-control-radius': theme.radius.control
});

export const buildFamilyCoRootCssBlock = (theme: FamilyCoUITheme): string => {
  const cssVariables = buildFamilyCoCssVariables(theme);
  const lines = Object.entries(cssVariables).map(([token, value]) => `  ${token}: ${value};`);

  return [':root {', ...lines, '}'].join('\n');
};
