import { config } from './config';

/**
 * Feature switchboard. Every command carries hierarchical categories (same scheme as EmbedPDF's
 * command registry): 'document' > 'document-print', 'annotation' > 'annotation-ink', ...
 * A command is enabled only if NONE of its categories is disabled.
 */

/** Friendly names accepted in config.disabledCategories / #disable=... */
export const ALIASES: Record<string, string> = {
  open: 'document-open', close: 'document-close', print: 'document-print', export: 'document-export',
  download: 'document-export', screenshot: 'document-capture', fullscreen: 'document-fullscreen',
  view: 'mode-view', annotate: 'mode-annotate', shapes: 'mode-shapes',
  search: 'panel-search', comments: 'panel-comment', sidebar: 'panel-sidebar', thumbnails: 'sidebar-thumbnails', outline: 'sidebar-outline',
  replies: 'comment-reply', reply: 'comment-reply',
  undo: 'history-undo', redo: 'history-redo', tabs: 'tab-bar', forms: 'form', stamps: 'insert-rubber-stamp',
};

const MARKUP = ['highlight', 'underline', 'strikeout', 'squiggly', 'insert-text', 'replace-text'];
const INK = ['ink', 'ink-highlighter'];
const TEXT = ['text', 'callout'];
const SHAPE = ['rectangle', 'circle', 'line', 'arrow', 'polygon', 'polyline'];
const MODE_EXTRA: Record<string, string[]> = {
  annotate: ['annotation'], shapes: ['annotation', 'annotation-shape'], insert: ['insert'], form: ['form'], redact: ['redaction'],
};

export function categoriesOf(id: string): string[] {
  const [ns, name = ''] = id.split(':');
  switch (ns) {
    case 'document': return name === 'protect' ? ['document', 'document-protect', 'security'] : ['document', `document-${name}`];
    case 'zoom':
      if (/^\d+$/.test(name)) return ['zoom', 'zoom-level', `zoom-level-${name}`];
      if (name.startsWith('toggle-menu')) return ['zoom', 'zoom-menu'];
      return ['zoom', `zoom-${name}`];
    case 'pan': return ['tools', 'pan'];
    case 'pointer': return ['tools', 'pointer'];
    case 'left-action-menu': return ['ui', 'ui-menu'];
    case 'panel': {
      const p = name.replace('toggle-', '');
      return p === 'redaction' ? ['panel', 'panel-redaction', 'redaction'] : ['panel', `panel-${p}`];
    }
    case 'page': return ['page', `page-${name}`];
    case 'spread': return ['page', 'spread', `spread-${name}`];
    case 'rotate': return ['page', 'rotate', `rotate-${name}`];
    case 'scroll':
      return name === 'next-page' || name === 'previous-page'
        ? ['page', 'navigation', name === 'next-page' ? 'navigation-next' : 'navigation-previous']
        : ['page', 'scroll', `scroll-${name}`];
    case 'mode': return ['mode', `mode-${name}`, ...(MODE_EXTRA[name] ?? [])];
    case 'tabs': return ['mode', 'mode-menu'];
    case 'annotation': {
      if (name === 'overflow-tools') return ['annotation', 'ui-menu'];
      if (name === 'overflow-shapes') return ['annotation', 'annotation-shape', 'ui-menu'];
      const t = name.replace('add-', '');
      const group = MARKUP.includes(t) ? 'annotation-markup' : INK.includes(t) ? 'annotation-ink' : TEXT.includes(t) ? 'annotation-text' : SHAPE.includes(t) ? 'annotation-shape' : t === 'comment' ? 'annotation-comment' : '';
      return ['annotation', ...(group ? [group] : []), `annotation-${t}`];
    }
    case 'form': if (name === 'overflow-tools') return ['form', 'ui-menu'];
      return ['form', `form-${name.replace('add-', '').replace('toggle-', '')}`];
    case 'insert': return ['insert', `insert-${name.replace('add-', '')}`];
    case 'redaction': return ['redaction', 'redaction-area'];
    case 'history': return ['history', `history-${name}`];
    default: return [];
  }
}

const disabled = new Set(
  config.disabledCategories.map((c) => c.trim().toLowerCase()).filter(Boolean).map((c) => ALIASES[c] ?? c),
);

export const disabledCategories = (): string[] => [...disabled];

/** Is this category (or alias) switched on? */
export function categoryEnabled(cat: string): boolean {
  const c = cat.toLowerCase();
  return !disabled.has(ALIASES[c] ?? c);
}

/** Is this command switched on? */
export function isEnabled(id: string): boolean {
  if (id === 'panel:toggle-sidebar' && !categoryEnabled('sidebar-thumbnails') && !categoryEnabled('sidebar-outline')) return false;
  return categoriesOf(id).every(categoryEnabled);
}
