import { h } from '../dom';
import { icon } from '../icon';
import { S } from '../state';

export function tabBar(): HTMLElement {
  return h('div', { class: 'ep-tabbar' },
    h('div', { class: 'ep-tabbar-scroll' },
      S.docs.map((t) => {
        const active = t.id === S.active;
        return h('div', { class: `ep-doc-tab${active ? ' is-active' : ''}`, role: 'tab', tabindex: 0, 'aria-selected': active, 'data-act': 'tab-select', 'data-arg': t.id },
          h('span', { class: 'ep-doc-tab-name' }, t.name),
          h('button', { type: 'button', class: 'ep-doc-tab-close', 'aria-label': `Close ${t.name}`, 'data-act': 'tab-close', 'data-arg': t.id }, icon('x', { size: 14 })));
      }),
      h('button', { type: 'button', class: 'ep-tab-add', 'data-tip': 'Open File', 'aria-label': 'Open File', 'data-act': 'tab-add' }, icon('plus', { size: 14 }))));
}
