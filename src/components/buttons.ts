import { h } from '../dom';
import { icon } from '../icon';
import { cmd } from '../data';
import { isActive, isDisabled } from '../commands';
import { isEnabled } from '../features';
import { menuAvailable } from './menus';
import { TOOLS, toolStyle } from '../annotations';

const MENU_TRIGGERS = new Set([
  'document:menu', 'page:settings', 'zoom:toggle-menu', 'zoom:toggle-menu-mobile',
  'left-action-menu:overflow-menu', 'tabs:overflow-menu', 'annotation:overflow-tools',
]);

/** Which menu(s) a trigger button opens – the button is hidden when everything in them is switched off. */
const TRIGGER_MENU: Record<string, string> = {
  'document:menu': 'document', 'page:settings': 'page', 'zoom:toggle-menu': 'zoom', 'zoom:toggle-menu-mobile': 'zoom',
  'left-action-menu:overflow-menu': 'left', 'tabs:overflow-menu': 'tabs', 'annotation:overflow-tools': 'annot-more',
  'annotation:overflow-shapes': 'shapes-more', 'form:overflow-tools': 'forms-more',
};

/** Returns null when the command's feature is switched off (see features.ts / config.ts). */
export function commandButton(commandId: string, opts: { className?: string } = {}): HTMLButtonElement | null {
  if (!isEnabled(commandId)) return null;
  if (TRIGGER_MENU[commandId] && !menuAvailable(TRIGGER_MENU[commandId])) return null;
  const c = cmd(commandId);
  const active = isActive(commandId);
  const disabled = isDisabled(commandId);
  const btn = h('button', {
    type: 'button',
    class: ['ep-btn', active ? 'is-active' : '', disabled ? 'is-disabled' : '', opts.className ?? ''].filter(Boolean).join(' '),
    'data-tip': c.label,
    'aria-label': c.label,
    'aria-pressed': active,
    'data-command': commandId,
    'data-menu-trigger': MENU_TRIGGERS.has(commandId) ? '1' : undefined,
    disabled,
  });
  let primary = c.primaryColor, secondary = c.secondaryColor;
  if (TOOLS[commandId]) {
    const st = toolStyle(commandId);
    if (primary) primary = st.color;
  }
  if (c.icon) btn.appendChild(icon(c.icon, { size: 20, primaryColor: primary, secondaryColor: secondary }));
  else btn.appendChild(h('span', { class: 'ep-btn-text' }, c.label));
  return btn;
}

export function tabButton(commandId: string, className = ''): HTMLButtonElement | null {
  if (!isEnabled(commandId)) return null;
  const active = isActive(commandId);
  return h('button', {
    type: 'button', role: 'tab', 'aria-selected': active, 'data-command': commandId,
    class: `ep-tab-btn${active ? ' is-active' : ''} ${className}`.trim(),
  }, cmd(commandId).label);
}

export const divider = (className = ''): HTMLElement =>
  h('div', { class: `ep-divider-wrap ${className}`.trim() }, h('div', { class: 'ep-divider', 'aria-hidden': true }));
export const spacer = (): HTMLElement => h('div', { class: 'ep-spacer', 'aria-hidden': true });
export const anchor = (child: Node | null, popup?: Node | null, className = ''): HTMLElement | null =>
  child ? h('div', { class: `ep-anchor ${className}`.trim() }, child, popup) : null;

/** Removes leading / trailing / doubled dividers (and empty groups) left behind when buttons are switched off. */
export function tidy(el: HTMLElement): HTMLElement {
  const isDiv = (n: Element) => n.classList.contains('ep-divider-wrap');
  el.querySelectorAll(':scope > .ep-group').forEach((g) => { tidy(g as HTMLElement); if (!g.children.length) g.remove(); });
  let prevDiv = true;
  for (const c of Array.from(el.children)) {
    if (isDiv(c)) { if (prevDiv) c.remove(); else prevDiv = true; }
    else if (!c.classList.contains('ep-spacer')) prevDiv = false;
  }
  while (el.lastElementChild && isDiv(el.lastElementChild)) el.lastElementChild.remove();
  return el;
}
