import { h } from '../dom';
import { icon } from '../icon';
import { cmd } from '../data';
import { isActive, isDisabled } from '../commands';
import { TOOLS, toolStyle } from '../annotations';

const MENU_TRIGGERS = new Set([
  'document:menu', 'page:settings', 'zoom:toggle-menu', 'zoom:toggle-menu-mobile',
  'left-action-menu:overflow-menu', 'tabs:overflow-menu', 'annotation:overflow-tools',
]);

export function commandButton(commandId: string, opts: { className?: string } = {}): HTMLButtonElement {
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

export function tabButton(commandId: string, className = ''): HTMLButtonElement {
  const active = isActive(commandId);
  return h('button', {
    type: 'button', role: 'tab', 'aria-selected': active, 'data-command': commandId,
    class: `ep-tab-btn${active ? ' is-active' : ''} ${className}`.trim(),
  }, cmd(commandId).label);
}

export const divider = (className = ''): HTMLElement =>
  h('div', { class: `ep-divider-wrap ${className}`.trim() }, h('div', { class: 'ep-divider', 'aria-hidden': true }));
export const spacer = (): HTMLElement => h('div', { class: 'ep-spacer', 'aria-hidden': true });
export const anchor = (child: Node, popup?: Node | null, className = ''): HTMLElement =>
  h('div', { class: `ep-anchor ${className}`.trim() }, child, popup);
