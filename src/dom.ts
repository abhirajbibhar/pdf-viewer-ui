export type Child = Node | string | null | undefined | false | Child[];

export interface Attrs {
  class?: string;
  [key: string]: string | number | boolean | undefined | null;
}

/** Tiny hyperscript helper: h('div', { class: 'x' }, child1, child2) */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

/** Parse an HTML/SVG string into a single element. */
export function fromHTML(markup: string): Element {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild as Element;
}
