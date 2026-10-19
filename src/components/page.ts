import { h } from '../dom';

const bar = (w: number, cls = ''): HTMLElement => h('div', { class: `ep-bar ${cls}`.trim(), style: `width:${w}%` });
const para = (ws: number[]): HTMLElement => h('div', { class: 'ep-para' }, ws.map((w) => bar(w)));

/** Grey-bar page used for thumbnails (sizes are in cqw so it scales). */
export function skeletonPage(n: number): HTMLElement {
  const page = h('div', { class: 'ep-page ep-skel', 'data-thumb-page': n });
  const inner = h('div', { class: 'ep-page-inner' });
  if (n === 1) inner.append(bar(55, 'ep-bar-title'), bar(35, 'ep-bar-sub'), h('div', { class: 'ep-fig' }), para([100, 96, 100, 92, 100, 60]), para([100, 98, 94, 100, 40]));
  else {
    inner.append(bar(30, 'ep-bar-h2'), para([100, 97, 100, 95, 100, 88, 100, 45]), para([100, 100, 93, 100, 72]));
    if (n % 2 === 0) inner.append(h('div', { class: 'ep-fig ep-fig-small' }));
    inner.append(para([100, 96, 100, 98, 100, 55]), para([100, 94, 100, 90]));
  }
  page.append(inner);
  return page;
}
