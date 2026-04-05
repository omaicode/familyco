export interface LayoutRegion {
  id: 'sidebar' | 'topbar' | 'main';
  behavior: 'fixed' | 'sticky' | 'scroll';
  notes: string;
}

export interface ResponsiveRule {
  maxWidth: number;
  sidebarMode: 'off-canvas' | 'expanded';
  topbarSticky: boolean;
}

export interface AppLayoutBlueprint {
  regions: LayoutRegion[];
  responsiveRules: ResponsiveRule[];
  defaultContainerClasses: {
    shell: string;
    contentWrap: string;
    mainContent: string;
  };
}

export const appLayoutBlueprint: AppLayoutBlueprint = {
  regions: [
    {
      id: 'sidebar',
      behavior: 'fixed',
      notes: 'Primary navigation with no nested scroll unless menu exceeds viewport.'
    },
    {
      id: 'topbar',
      behavior: 'sticky',
      notes: 'Contains breadcrumb, quick actions, and founder profile controls.'
    },
    {
      id: 'main',
      behavior: 'scroll',
      notes: 'Single scrollable region for page content and detail tables.'
    }
  ],
  responsiveRules: [
    {
      maxWidth: 767,
      sidebarMode: 'off-canvas',
      topbarSticky: true
    },
    {
      maxWidth: 10000,
      sidebarMode: 'expanded',
      topbarSticky: true
    }
  ],
  defaultContainerClasses: {
    shell: 'min-h-screen flex bg-[var(--fc-background)] text-[var(--fc-text-main)]',
    contentWrap: 'flex-1 flex flex-col min-w-0',
    mainContent: 'flex-1 overflow-y-auto px-6 py-4'
  }
};
