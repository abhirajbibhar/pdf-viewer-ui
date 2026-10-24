import { h } from '../dom';
import { icon } from '../icon';
import { cmd } from '../data';
import { isActive, isDisabled } from '../commands';
import { isEnabled } from '../features';
import { useSheetMode } from '../config';
import { S } from '../state';

type Entry =
  | { type: 'command'; id: string; label?: string }
  | { type: 'section'; label: string }
  | { type: 'divider' }
  | { type: 'sub'; to: string; label: string; icon: string }
  | { type: 'back'; to: string };

/** `parent` / `title` describe submenus: desktop shows a "Back" row, the mobile sheet a header with a back arrow. */
interface MenuDef { entries: () => Entry[]; parent?: string; title?: string }

// ───────── rendering ─────────
function renderEntry(e: Entry, mobile: boolean): HTMLElement {
  if (e.type === 'divider') return h('hr', { class: 'ep-menu-divider' });
  if (e.type === 'section') return h('div', { class: 'ep-menu-section' }, e.label);
  const size = mobile ? 20 : 24;
  if (e.type === 'back')
    return h('button', { type: 'button', class: 'ep-menu-item', 'data-act': 'menu-go', 'data-arg': e.to },
      h('span', { class: 'ep-menu-icon' }, icon('chevronLeft', { size: 20 })), h('span', { class: 'ep-menu-label' }, 'Back'));
  if (e.type === 'sub')
    return h('button', { type: 'button', role: 'menuitem', class: 'ep-menu-item', 'data-act': 'menu-go', 'data-arg': e.to },
      mobile ? null : h('span', { class: 'ep-menu-icon' }, icon(e.icon, { size })), h('span', { class: 'ep-menu-label' }, e.label),
      h('span', { class: 'ep-menu-chevron' }, icon('chevronRight', { size: mobile ? 16 : 16 })));
  const c = cmd(e.id);
  const active = isActive(e.id), disabled = isDisabled(e.id);
  return h('button', {
    type: 'button', role: 'menuitem', 'data-command': e.id,
    class: `ep-menu-item${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`,
  }, h('span', { class: 'ep-menu-icon' }, c.icon ? icon(c.icon, { size }) : null), h('span', { class: 'ep-menu-label' }, e.label ?? c.label));
}

// ───────── definitions ─────────
const c = (id: string, label?: string): Entry => ({ type: 'command', id, label });
const div: Entry = { type: 'divider' };

const PAGE_ENTRIES = (): Entry[] => [
  { type: 'section', label: 'Spread Mode' }, c('spread:none'), c('spread:odd'), c('spread:even'), div,
  { type: 'section', label: 'Scroll Layout' }, c('scroll:vertical'), c('scroll:horizontal'), div,
  { type: 'section', label: 'Page Rotation' }, c('rotate:clockwise'), c('rotate:counter-clockwise'), div,
  c('document:fullscreen'),
];
const PRESETS = (): Entry[] => [25, 50, 100, 125, 150, 200, 400, 800, 1600].map((z) => c(`zoom:${z}`, `${z}%`));

/** Mirrors the original responsive rules: presets on wide screens, a "Zoom Level" submenu + in/out on narrow ones. */
function zoomEntries(levelsMenu: string): Entry[] {
  const w = document.querySelector('.ep-root')?.clientWidth ?? 1280;
  const sub: Entry = { type: 'sub', to: levelsMenu, label: 'Zoom Level', icon: 'zoomIn' };
  const tail: Entry[] = [div, c('zoom:fit-page'), c('zoom:fit-width'), div, c('zoom:marquee')];
  if (w >= 768) return [...PRESETS(), ...tail];
  if (w <= 640) return [sub, div, c('zoom:in'), c('zoom:out'), ...tail];
  return [...PRESETS(), sub, div, c('zoom:in'), c('zoom:out'), ...tail];
}

const MENUS: Record<string, MenuDef> = {
  document: { entries: () => [c('document:open'), c('document:close'), div, c('document:print'), c('document:protect'), c('document:capture'), c('document:export'), div, c('document:fullscreen')] },
  page: { entries: PAGE_ENTRIES },
  zoom: { entries: () => zoomEntries('zoom-levels') },
  'zoom-levels': { parent: 'zoom', title: 'Zoom Level', entries: PRESETS },
  left: {
    entries: () => [
      { type: 'sub', to: 'left-page', label: 'View Controls', icon: 'viewSettings' },
      { type: 'sub', to: 'left-zoom', label: 'Zoom Controls', icon: 'zoomIn' },
      div, c('pan:toggle'), c('pointer:toggle'),
    ],
  },
  'left-page': { parent: 'left', title: 'View Controls', entries: PAGE_ENTRIES },
  'left-zoom': { parent: 'left', title: 'Zoom Controls', entries: () => zoomEntries('left-zoom-levels') },
  'left-zoom-levels': { parent: 'left-zoom', title: 'Zoom Level', entries: PRESETS },
  tabs: { entries: () => ['view', 'annotate', 'shapes', 'insert', 'form', 'redact'].map((m) => c(`mode:${m}`)) },
  'shapes-more': { entries: () => ['polygon', 'polyline'].map((t) => c(`annotation:add-${t}`)) },
  'forms-more': { entries: () => ['select', 'listbox'].map((t) => c(`form:add-${t}`)) },
  'annot-more': { entries: () => ['text', 'ink', 'ink-highlighter', 'insert-text', 'replace-text', 'comment', 'callout'].map((t) => c(`annotation:add-${t}`)) },
};

// ───────── feature filtering ─────────
const hasContent = (list: Entry[]): boolean => list.some((e) => e.type === 'command' || e.type === 'sub');

/** Drops switched-off commands, submenus that became empty, orphaned section titles and stray dividers. */
function visible(entries: Entry[]): Entry[] {
  let out = entries.filter((e) => (e.type === 'command' ? isEnabled(e.id) : e.type === 'sub' ? menuAvailable(e.to) : true));
  const before = out;
  out = out.filter((e, i) => {
    if (e.type !== 'section') return true;
    for (let j = i + 1; j < before.length; j++) {
      const n = before[j];
      if (n.type === 'command' || n.type === 'sub') return true;
      if (n.type === 'section' || n.type === 'divider') return false;
    }
    return false;
  });
  const res: Entry[] = [];
  for (const e of out) {
    if (e.type === 'divider') { const prev = res[res.length - 1]; if (!prev || prev.type === 'divider') continue; }
    res.push(e);
  }
  while (res.length && res[res.length - 1].type === 'divider') res.pop();
  return res;
}

function entriesFor(id: string, mobile: boolean): Entry[] {
  const def = MENUS[id];
  if (!def) return [];
  const base = def.entries();
  const full: Entry[] = def.parent && !mobile ? [{ type: 'back', to: def.parent }, div, ...base] : base;
  return visible(full);
}

/** Does this menu have anything left to show once disabled features are removed? */
export function menuAvailable(id: string): boolean {
  return hasContent(entriesFor(id, false));
}

// ───────── desktop dropdown ─────────
/** Renders the popup for `ids` if it is the currently open menu, else null. (Mobile uses the bottom sheet instead.) */
export function menuIf(...ids: string[]): HTMLElement | null {
  const open = S.menu;
  if (!open || !ids.includes(open) || useSheetMode()) return null;
  const entries = entriesFor(open, false);
  if (!hasContent(entries)) return null;
  return h('div', { class: 'ep-menu', role: 'menu', 'data-scroll': 'menu' }, entries.map((e) => renderEntry(e, false)));
}

// ───────── mobile bottom sheet ─────────
/** Content for the bottom sheet: optional header (back arrow + title for submenus) and the items. */
export function sheetMenu(): HTMLElement | null {
  const id = S.menu;
  if (!id || !MENUS[id]) return null;
  const entries = entriesFor(id, true);
  if (!hasContent(entries)) return null;
  const def = MENUS[id];
  return h('div', { class: 'ep-sheet-menu', 'data-menu-id': id },
    def.parent
      ? h('div', { class: 'ep-sheet-header' },
          h('button', { type: 'button', class: 'ep-sheet-back', 'aria-label': 'Back', 'data-act': 'menu-go', 'data-arg': def.parent }, icon('chevronLeft', { size: 20 })),
          h('h3', {}, def.title ?? 'Menu'))
      : null,
    h('div', { class: 'ep-sheet-items', role: 'menu', 'data-scroll': 'menu' }, entries.map((e) => renderEntry(e, true))));
}
