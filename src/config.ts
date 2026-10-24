/**
 * Viewer configuration – the one place to switch features and mobile behaviours on / off.
 *
 * Three ways to set it (later ones win):
 *   1. edit DEFAULT_CONFIG below
 *   2. define  window.PDF_VIEWER_CONFIG = { ... }  in index.html *before* dist/app.js
 *   3. add  #disable=print,security  and/or  #tabs=auto  to the page URL (handy for quick tests)
 *
 * See README.md ("Enabling / disabling features") for the full list of categories.
 */
export interface DrawerConfig {
  /** Height the sidebar / panel drawer opens at. */
  initialSnap: 'half' | 'full';
  /** false = no drag-to-resize (only open / close). */
  resizable: boolean;
}

export interface MobileConfig {
  /** Container width (px) below which the mobile UI is used. EmbedPDF uses 768. */
  breakpoint: number;
  /** Sidebar, search, comments, style and redaction panels slide up as a bottom drawer. false = inline sidebars. */
  sidebarDrawer: boolean;
  /** Document / page / zoom / mode menus open as a bottom sheet. false = desktop dropdowns. */
  menuSheet: boolean;
  drawer: DrawerConfig;
}

export interface UiConfig {
  /**
   * Document tab strip.
   *   'always' – always shown (default)
   *   'auto'   – only when 2+ documents are open (single-book reading gets the full height)
   *   'never'  – never shown (open / switch documents from the document menu)
   */
  tabBar: 'always' | 'auto' | 'never';
}

export interface ViewerConfig {
  /**
   * Categories to switch off. Disabling a category removes every button, menu item,
   * shortcut and panel that belongs to it (children included). Examples:
   *   'document-open' | 'document-close' | 'document-print' | 'security' | 'document-export'
   *   'mode-view' | 'annotation' | 'form' | 'insert' | 'redaction' | 'panel-search' | ...
   * Friendly aliases also work: 'open', 'close', 'print', 'view', 'search', 'comments', ...
   */
  disabledCategories: string[];
  ui: UiConfig;
  mobile: MobileConfig;
}

export const DEFAULT_CONFIG: ViewerConfig = {
  disabledCategories: [],
  ui: { tabBar: 'always' },
  mobile: {
    breakpoint: 768,
    sidebarDrawer: true,
    menuSheet: true,
    drawer: { initialSnap: 'half', resizable: true },
  },
};

export type ConfigOverrides = {
  disabledCategories?: string[];
  ui?: Partial<UiConfig>;
  mobile?: Partial<Omit<MobileConfig, 'drawer'>> & { drawer?: Partial<DrawerConfig> };
};

declare global {
  interface Window { PDF_VIEWER_CONFIG?: ConfigOverrides }
}

function resolve(): ViewerConfig {
  const o = (typeof window !== 'undefined' && window.PDF_VIEWER_CONFIG) || {};
  const cfg: ViewerConfig = {
    disabledCategories: [...(o.disabledCategories ?? DEFAULT_CONFIG.disabledCategories)],
    ui: { ...DEFAULT_CONFIG.ui, ...o.ui },
    mobile: { ...DEFAULT_CONFIG.mobile, ...o.mobile, drawer: { ...DEFAULT_CONFIG.mobile.drawer, ...o.mobile?.drawer } },
  };
  const fromUrl = new URLSearchParams(location.hash.slice(1)).get('disable');
  if (fromUrl) cfg.disabledCategories.push(...fromUrl.split(',').map((s) => s.trim()).filter(Boolean));
  const tabs = new URLSearchParams(location.hash.slice(1)).get('tabs');
  if (tabs === 'always' || tabs === 'auto' || tabs === 'never') cfg.ui.tabBar = tabs;
  return cfg;
}

export const config: ViewerConfig = resolve();

/** True when the viewer container is narrower than the mobile breakpoint. */
export function isMobileWidth(): boolean {
  const root = document.querySelector('.ep-root');
  return !!root && root.clientWidth > 0 && root.clientWidth < config.mobile.breakpoint;
}
/** Sidebars / panels render as the bottom drawer. */
export const useDrawerMode = (): boolean => config.mobile.sidebarDrawer && isMobileWidth();
/** Menus render as a bottom sheet. */
export const useSheetMode = (): boolean => config.mobile.menuSheet && isMobileWidth();
