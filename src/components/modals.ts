import { h } from '../dom';
import { icon } from '../icon';
import { S, doc } from '../state';

function frame(title: string, body: Node, footer: Node): HTMLElement {
  return h('div', { class: 'ep-modal-backdrop', 'data-act': 'modal-backdrop' },
    h('div', { class: 'ep-dialog', role: 'dialog', 'aria-modal': true },
      h('div', { class: 'ep-dialog-header' }, h('h2', {}, title),
        h('button', { type: 'button', class: 'ep-btn', 'aria-label': 'Close', 'data-act': 'modal-close' }, icon('x', { size: 20 }))),
      h('div', { class: 'ep-dialog-content' }, body, footer)));
}

const footer = (primary: string, act: string, busy = false): HTMLElement =>
  h('div', { class: 'ep-dialog-footer' },
    h('button', { type: 'button', class: 'ep-secondary-btn', 'data-act': 'modal-close' }, 'Cancel'),
    h('button', { type: 'button', class: 'ep-primary-btn', 'data-act': act, disabled: busy }, busy ? 'Preparing\u2026' : primary));

function radio(label: string, value: string, extra?: Node): HTMLElement {
  return h('label', { class: 'ep-radio' },
    h('input', { type: 'radio', name: 'pageRange', checked: S.print.range === value, 'data-in': 'print-range', value }),
    h('div', { class: 'ep-radio-body' }, h('span', {}, label), extra));
}

export function printModal(): HTMLElement {
  const d = doc()!;
  const body = h('div', { class: 'ep-form' },
    h('div', {}, h('label', { class: 'ep-form-label' }, 'Pages to print'),
      h('div', { class: 'ep-form-stack' },
        radio('All pages', 'all'), radio(`Current page (${d.page})`, 'current'),
        radio('Specify pages', 'specify', S.print.range === 'specify'
          ? h('input', { class: 'ep-text-input', type: 'text', placeholder: 'e.g., 1-3, 5, 8-10', value: S.print.spec, 'data-in': 'print-spec', 'data-focus': 'print-spec' }) : undefined)),
      h('p', { class: 'ep-form-hint' }, `Total pages in document: ${d.pages}`)),
    h('label', { class: 'ep-check-line' }, h('input', { type: 'checkbox', checked: S.print.annotations, 'data-in': 'print-ann' }), h('span', {}, 'Include annotations')));
  return frame('Print Settings', body, footer('Print', 'print-do', S.print.busy));
}

export function protectModal(): HTMLElement {
  const body = h('div', { class: 'ep-form' },
    h('label', { class: 'ep-check-line' }, h('input', { type: 'checkbox', checked: S.protect.openPw, 'data-in': 'protect-open' }), h('span', {}, 'Require a password to open')),
    S.protect.openPw ? h('input', { class: 'ep-text-input', type: 'password', placeholder: 'Password' }) : null,
    h('label', { class: 'ep-check-line' }, h('input', { type: 'checkbox', checked: S.protect.perms, 'data-in': 'protect-perms' }), h('span', {}, 'Restrict permissions')),
    S.protect.perms ? h('div', { class: 'ep-form-stack ep-indent' },
      ...['Printing', 'Copying text', 'Editing', 'Annotating'].map((p) => h('label', { class: 'ep-check-line' }, h('input', { type: 'checkbox', checked: true }), h('span', {}, `Allow ${p.toLowerCase()}`)))) : null);
  return frame('Document Security', body, footer('Apply', 'protect-do'));
}

export function signatureModal(): HTMLElement {
  const body = h('div', { class: 'ep-form' },
    h('div', {}, h('label', { class: 'ep-form-label' }, 'Type your name'),
      h('input', { class: 'ep-text-input', type: 'text', placeholder: 'Your name', value: S.sigText, 'data-in': 'sig-text', 'data-focus': 'sig' })),
    h('div', { class: 'ep-sig-preview', id: 'sig-preview' }, S.sigText || 'Signature'));
  return frame('Add Signature', body, footer('Create', 'sig-do'));
}
