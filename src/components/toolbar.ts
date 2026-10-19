import { h } from '../dom';
import { commandButton, tabButton, divider, spacer, anchor } from './buttons';
import { menuIf } from './menus';
import { S, doc } from '../state';

function zoomToolbar(): HTMLElement {
  const d = doc();
  return h('div', { class: 'ep-zoom hide-lt-768' },
    h('div', { class: 'ep-zoom-inner' },
      h('div', { class: 'ep-zoom-input-wrap' },
        h('input', { class: 'ep-zoom-input', name: 'zoom', type: 'text', inputmode: 'numeric', value: String(d?.zoom ?? 100), 'aria-label': 'Set zoom', 'data-in': 'zoom', 'data-focus': 'zoom' }),
        h('span', { class: 'ep-zoom-pct' }, '%')),
      anchor(commandButton('zoom:toggle-menu'), menuIf('zoom', 'zoom-levels')),
      commandButton('zoom:out'),
      commandButton('zoom:in')));
}

function modeSelect(): HTMLElement {
  const label = S.mode.charAt(0).toUpperCase() + S.mode.slice(1);
  const btn = commandButton('tabs:overflow-menu');
  btn.className = 'ep-btn ep-mode-select' + (S.menu === 'tabs' ? ' is-active' : '');
  btn.replaceChildren(h('span', { class: 'ep-mode-select-label' }, label));
  btn.insertAdjacentHTML('beforeend', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6l6 -6"/></svg>');
  return h('div', { class: 'ep-mode-select-wrap show-lt-640' }, anchor(btn, menuIf('tabs'), 'ep-anchor-block'));
}

export function mainToolbar(): HTMLElement {
  return h('div', { class: 'ep-toolbar ep-toolbar-main', role: 'toolbar' },
    h('div', { class: 'ep-group' },
      anchor(commandButton('document:menu'), menuIf('document')),
      divider(),
      commandButton('panel:toggle-sidebar'),
      anchor(commandButton('left-action-menu:overflow-menu', { className: 'show-lt-400' }), menuIf('left', 'left-page', 'left-zoom', 'left-zoom-levels'), 'show-lt-400'),
      anchor(commandButton('page:settings', { className: 'hide-lt-400' }), menuIf('page'), 'hide-lt-400')),
    divider('hide-lt-400'),
    h('div', { class: 'ep-group ep-group-center' },
      anchor(commandButton('zoom:toggle-menu-mobile'), menuIf('zoom', 'zoom-levels'), 'show-400-767'),
      zoomToolbar(),
      divider('hide-lt-500'),
      commandButton('pan:toggle', { className: 'hide-lt-500' }),
      commandButton('pointer:toggle', { className: 'hide-lt-500' })),
    spacer(),
    modeSelect(),
    h('div', { class: 'ep-tabs hide-lt-640', role: 'tablist' },
      tabButton('mode:view'), tabButton('mode:annotate'), tabButton('mode:shapes', 'hide-lt-768'),
      tabButton('mode:insert', 'hide-lt-1024'), tabButton('mode:form', 'hide-lt-1024'), tabButton('mode:redact', 'hide-lt-1024'),
      anchor(commandButton('tabs:overflow-menu', { className: 'hide-gte-1024' }), menuIf('tabs'), 'hide-gte-1024')),
    spacer(),
    h('div', { class: 'ep-group' }, commandButton('panel:toggle-search'), commandButton('panel:toggle-comment')));
}

const history = (): HTMLElement[] => [commandButton('history:undo'), commandButton('history:redo')];
const sec = (items: (Node | null)[]): HTMLElement =>
  h('div', { class: 'ep-toolbar ep-toolbar-secondary', role: 'toolbar' }, spacer(), h('div', { class: 'ep-group' }, items), spacer());

export function secondaryToolbar(): HTMLElement | null {
  const style = commandButton('panel:toggle-annotation-style');
  switch (S.mode) {
    case 'annotate':
      return sec([
        commandButton('annotation:add-highlight'), commandButton('annotation:add-strikeout'),
        commandButton('annotation:add-underline'), commandButton('annotation:add-squiggly'),
        ...['ink', 'ink-highlighter', 'text', 'insert-text', 'replace-text', 'comment', 'callout'].map((t) => commandButton(`annotation:add-${t}`, { className: 'hide-lt-640' })),
        anchor(commandButton('annotation:overflow-tools', { className: 'show-lt-640' }), menuIf('annot-more'), 'show-lt-640'),
        divider(), style, divider(), ...history(),
      ]);
    case 'shapes':
      return sec([
        ...['rectangle', 'circle', 'line', 'arrow', 'polygon', 'polyline'].map((t) => commandButton(`annotation:add-${t}`)),
        divider(), style, divider(), ...history(),
      ]);
    case 'form':
      return sec([
        ...['textfield', 'checkbox', 'radio', 'select', 'listbox'].map((t) => commandButton(`form:add-${t}`)),
        divider(), style, commandButton('form:toggle-fill-mode'), divider(), ...history(),
      ]);
    case 'insert':
      return sec([
        commandButton('insert:add-rubber-stamp'), commandButton('insert:add-signature'),
        commandButton('insert:add-attachment'), commandButton('insert:add-image'),
        divider(), style, divider(), ...history(),
      ]);
    case 'redact':
      return sec([commandButton('redaction:redact'), divider(), commandButton('panel:toggle-redaction'), style, divider(), ...history()]);
    default:
      return null;
  }
}
