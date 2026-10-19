import { h } from '../dom';
import { icon } from '../icon';
import { cmd } from '../data';
import { isActive, isDisabled } from '../commands';
import { S } from '../state';

type Entry =
  | { type: 'command'; id: string; label?: string }
  | { type: 'section'; label: string }
  | { type: 'divider' }
  | { type: 'sub'; to: string; label: string; icon: string }
  | { type: 'back'; to: string };

function renderEntry(e: Entry): HTMLElement {
  if (e.type === 'divider') return h('hr', { class: 'ep-menu-divider' });
  if (e.type === 'section') return h('div', { class: 'ep-menu-section' }, e.label);
  if (e.type === 'back')
    return h('button', { type: 'button', class: 'ep-menu-item', 'data-act': 'menu-go', 'data-arg': e.to },
      h('span', { class: 'ep-menu-icon' }, icon('chevronLeft', { size: 20 })), h('span', { class: 'ep-menu-label' }, 'Back'));
  if (e.type === 'sub')
    return h('button', { type: 'button', class: 'ep-menu-item', 'data-act': 'menu-go', 'data-arg': e.to },
      h('span', { class: 'ep-menu-icon' }, icon(e.icon, { size: 24 })), h('span', { class: 'ep-menu-label' }, e.label),
      h('span', { class: 'ep-menu-chevron' }, icon('chevronRight', { size: 16 })));
  const c = cmd(e.id);
  const active = isActive(e.id), disabled = isDisabled(e.id);
  return h('button', {
    type: 'button', role: 'menuitem', 'data-command': e.id,
    class: `ep-menu-item${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`,
  }, h('span', { class: 'ep-menu-icon' }, c.icon ? icon(c.icon, { size: 24 }) : null), h('span', { class: 'ep-menu-label' }, e.label ?? c.label));
}

const c = (id: string, label?: string): Entry => ({ type: 'command', id, label });
const div: Entry = { type: 'divider' };

const PAGE_ENTRIES: Entry[] = [
  { type: 'section', label: 'Spread Mode' }, c('spread:none'), c('spread:odd'), c('spread:even'), div,
  { type: 'section', label: 'Scroll Layout' }, c('scroll:vertical'), c('scroll:horizontal'), div,
  { type: 'section', label: 'Page Rotation' }, c('rotate:clockwise'), c('rotate:counter-clockwise'), div,
  c('document:fullscreen'),
];
const PRESETS: Entry[] = [25, 50, 100, 125, 150, 200, 400, 800, 1600].map((z) => c(`zoom:${z}`, `${z}%`));

/** Mirrors the original responsive rules: presets on wide screens, a "Zoom Level" submenu + in/out on narrow ones. */
function zoomEntries(levelsMenu: string): Entry[] {
  const w = document.querySelector('.ep-root')?.clientWidth ?? 1280;
  const sub: Entry = { type: 'sub', to: levelsMenu, label: 'Zoom Level', icon: 'zoomIn' };
  const tail: Entry[] = [div, c('zoom:fit-page'), c('zoom:fit-width'), div, c('zoom:marquee')];
  if (w >= 768) return [...PRESETS, ...tail];
  if (w <= 640) return [sub, div, c('zoom:in'), c('zoom:out'), ...tail];
  return [...PRESETS, sub, div, c('zoom:in'), c('zoom:out'), ...tail];
}

const MENUS: Record<string, () => Entry[]> = {
  document: () => [c('document:open'), c('document:close'), div, c('document:print'), c('document:protect'), c('document:capture'), c('document:export'), div, c('document:fullscreen')],
  page: () => PAGE_ENTRIES,
  zoom: () => zoomEntries('zoom-levels'),
  'zoom-levels': () => [{ type: 'back', to: 'zoom' }, div, ...PRESETS],
  'left-zoom-levels': () => [{ type: 'back', to: 'left-zoom' }, div, ...PRESETS],
  left: () => [
    { type: 'sub', to: 'left-page', label: 'View Controls', icon: 'viewSettings' },
    { type: 'sub', to: 'left-zoom', label: 'Zoom Controls', icon: 'zoomIn' },
    div, c('pan:toggle'), c('pointer:toggle'),
  ],
  'left-page': () => [{ type: 'back', to: 'left' }, div, ...PAGE_ENTRIES],
  'left-zoom': () => [{ type: 'back', to: 'left' }, div, ...zoomEntries('left-zoom-levels')],
  tabs: () => ['view', 'annotate', 'shapes', 'insert', 'form', 'redact'].map((m) => c(`mode:${m}`)),
  'annot-more': () => ['text', 'ink', 'ink-highlighter', 'insert-text', 'replace-text', 'comment', 'callout'].map((t) => c(`annotation:add-${t}`)),
};

/** Renders the popup for `ids` if it is the currently open menu, else null. */
export function menuIf(...ids: string[]): HTMLElement | null {
  const open = S.menu;
  if (!open || !ids.includes(open)) return null;
  return h('div', { class: 'ep-menu', role: 'menu', 'data-scroll': 'menu' }, MENUS[open]().map(renderEntry));
}
