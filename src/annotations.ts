import { h } from './dom';
import { icon } from './icon';
import { Ann, S, Style, doc } from './state';

export interface ToolDef { type: string; drag: boolean; style: Style; kind?: string }
const RED = '#E44234', YEL = '#FFCD45';
const st = (color: string, opacity = 1, width = 2, blend = 'normal'): Style => ({ color, opacity, width, blend });

export const TOOLS: Record<string, ToolDef> = {
  'annotation:add-highlight': { type: 'highlight', drag: true, style: st(YEL, 0.5, 2, 'multiply') },
  'annotation:add-underline': { type: 'underline', drag: true, style: st(RED) },
  'annotation:add-strikeout': { type: 'strikeout', drag: true, style: st(RED) },
  'annotation:add-squiggly': { type: 'squiggly', drag: true, style: st(RED) },
  'annotation:add-replace-text': { type: 'replaceText', drag: true, style: st(RED) },
  'annotation:add-ink': { type: 'ink', drag: true, style: st(RED, 1, 3) },
  'annotation:add-ink-highlighter': { type: 'inkhl', drag: true, style: st(YEL, 0.45, 14, 'multiply') },
  'annotation:add-text': { type: 'text', drag: false, style: st(RED) },
  'annotation:add-insert-text': { type: 'insertText', drag: false, style: st(RED) },
  'annotation:add-comment': { type: 'comment', drag: false, style: st(YEL) },
  'annotation:add-callout': { type: 'callout', drag: false, style: st(RED, 1, 2) },
  'annotation:add-rectangle': { type: 'rect', drag: true, style: st(RED) },
  'annotation:add-circle': { type: 'circle', drag: true, style: st(RED) },
  'annotation:add-line': { type: 'line', drag: true, style: st(RED) },
  'annotation:add-arrow': { type: 'arrow', drag: true, style: st(RED) },
  'annotation:add-polygon': { type: 'polygon', drag: true, style: st(RED) },
  'annotation:add-polyline': { type: 'polyline', drag: true, style: st(RED) },
  'form:add-textfield': { type: 'field', kind: 'textfield', drag: true, style: st('#3B82F6') },
  'form:add-checkbox': { type: 'field', kind: 'checkbox', drag: false, style: st('#3B82F6') },
  'form:add-radio': { type: 'field', kind: 'radio', drag: false, style: st('#3B82F6') },
  'form:add-select': { type: 'field', kind: 'select', drag: true, style: st('#3B82F6') },
  'form:add-listbox': { type: 'field', kind: 'listbox', drag: true, style: st('#3B82F6') },
  'insert:add-rubber-stamp': { type: 'stamp', drag: false, style: st(RED) },
  'insert:add-signature': { type: 'signature', drag: false, style: st('#1D4ED8') },
  'insert:add-attachment': { type: 'attachment', drag: false, style: st('#6B7280') },
  'insert:add-image': { type: 'image', drag: false, style: st('#6B7280') },
  'redaction:redact': { type: 'redact', drag: true, style: st(RED) },
};

export const STAMPS = ['APPROVED', 'DRAFT', 'CONFIDENTIAL', 'REVIEWED'];
export const TYPE_LABEL: Record<string, string> = {
  highlight: 'Highlight', underline: 'Underline', strikeout: 'Strikethrough', squiggly: 'Squiggly', replaceText: 'Replace Text',
  ink: 'Ink', inkhl: 'Ink Highlighter', text: 'Text', insertText: 'Insert Text', comment: 'Comment', callout: 'Callout',
  rect: 'Rectangle', circle: 'Circle', line: 'Line', arrow: 'Arrow', polygon: 'Polygon', polyline: 'Polyline',
  field: 'Form Field', stamp: 'Stamp', signature: 'Signature', attachment: 'Attachment', image: 'Image', redact: 'Redaction',
};

export function toolStyle(id: string): Style {
  const t = TOOLS[id];
  return S.defaults[t.type] ?? t.style;
}
export function defaultFor(type: string): Style {
  const t = Object.values(TOOLS).find((x) => x.type === type);
  return S.defaults[type] ?? t?.style ?? st(RED);
}
export const isDrawTool = (id: string | null): boolean => !!id && !!TOOLS[id];

// ───────── geometry ─────────
export function bboxOf(pts: number[][]): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const NS = 'http://www.w3.org/2000/svg';
const VW = 1000, VH = 1414;
function s(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el as SVGElement;
}
const stroke = (a: Ann, extra: Record<string, string | number> = {}) => ({
  fill: 'none', stroke: a.color, 'stroke-width': a.width, 'stroke-opacity': a.opacity,
  'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke', ...extra,
});

function zigzag(x: number, y: number, w: number, amp: number, step: number): string {
  let d = `M${x},${y}`;
  let up = true;
  for (let px = x + step; px < x + w + step; px += step) {
    d += ` L${Math.min(px, x + w)},${y + (up ? -amp : amp)}`;
    up = !up;
  }
  return d;
}

function svgShape(a: Ann): SVGElement[] {
  const X = a.x * VW, Y = a.y * VH, W = a.w * VW, H = a.h * VH;
  const P = (p: number[]) => `${p[0] * VW},${p[1] * VH}`;
  switch (a.type) {
    case 'highlight':
      return [s('rect', { x: X, y: Y, width: W, height: H, fill: a.color, 'fill-opacity': a.opacity, style: `mix-blend-mode:${a.blend}` })];
    case 'underline':
      return [s('line', { x1: X, y1: Y + H, x2: X + W, y2: Y + H, ...stroke(a) })];
    case 'strikeout':
      return [s('line', { x1: X, y1: Y + H / 2, x2: X + W, y2: Y + H / 2, ...stroke(a) })];
    case 'replaceText':
      return [s('line', { x1: X, y1: Y + H / 2, x2: X + W, y2: Y + H / 2, ...stroke(a) }), s('path', { d: `M${X + W - 6},${Y - 8} l6,-8 l6,8`, ...stroke(a) })];
    case 'squiggly':
      return [s('path', { d: zigzag(X, Y + H, W, 3, 5), ...stroke(a) })];
    case 'rect':
      return [s('rect', { x: X, y: Y, width: W, height: H, ...stroke(a) })];
    case 'circle':
      return [s('ellipse', { cx: X + W / 2, cy: Y + H / 2, rx: W / 2, ry: H / 2, ...stroke(a) })];
    case 'line':
      return [s('line', { x1: a.pts![0][0] * VW, y1: a.pts![0][1] * VH, x2: a.pts![1][0] * VW, y2: a.pts![1][1] * VH, ...stroke(a) })];
    case 'arrow': {
      const [p, q] = a.pts!;
      const x1 = p[0] * VW, y1 = p[1] * VH, x2 = q[0] * VW, y2 = q[1] * VH;
      const ang = Math.atan2(y2 - y1, x2 - x1), L = 20;
      const hx = (t: number) => x2 - L * Math.cos(ang + t), hy = (t: number) => y2 - L * Math.sin(ang + t);
      return [
        s('line', { x1, y1, x2, y2, ...stroke(a) }),
        s('path', { d: `M${hx(0.5)},${hy(0.5)} L${x2},${y2} L${hx(-0.5)},${hy(-0.5)}`, ...stroke(a) }),
      ];
    }
    case 'polygon': {
      const cx = X + W / 2, cy = Y + H / 2;
      const pts = [0, 1, 2, 3, 4].map((i) => {
        const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return `${cx + (W / 2) * Math.cos(t)},${cy + (H / 2) * Math.sin(t)}`;
      });
      return [s('polygon', { points: pts.join(' '), ...stroke(a) })];
    }
    case 'polyline':
      return [s('polyline', { points: [[0, 1], [0.3, 0], [0.6, 1], [1, 0]].map(([u, v]) => `${X + u * W},${Y + v * H}`).join(' '), ...stroke(a) })];
    case 'ink':
    case 'inkhl':
      return [s('polyline', { points: a.pts!.map(P).join(' '), ...stroke(a, a.type === 'inkhl' ? { style: `mix-blend-mode:${a.blend}` } : {}) })];
    case 'redact':
      return [
        a.applied
          ? s('rect', { x: X, y: Y, width: W, height: H, fill: '#000' })
          : s('rect', { x: X, y: Y, width: W, height: H, fill: 'rgba(228,66,52,.15)', stroke: a.color, 'stroke-width': 2, 'stroke-dasharray': '6 4', 'vector-effect': 'non-scaling-stroke' }),
      ];
    case 'callout': {
      const anchor = a.pts![0];
      return [s('line', { x1: (a.x + 0.01) * VW, y1: (a.y + a.h) * VH, x2: anchor[0] * VW, y2: anchor[1] * VH, ...stroke(a) })];
    }
    default:
      return [];
  }
}

const pos = (a: Ann): string => `left:${a.x * 100}%;top:${a.y * 100}%;width:${a.w * 100}%;height:${a.h * 100}%;`;

function htmlItem(a: Ann): HTMLElement | null {
  const common = { 'data-ann': a.id };
  switch (a.type) {
    case 'text':
    case 'insertText':
    case 'callout':
      return h('div', {
        ...common, class: `ep-a-text${a.type === 'callout' ? ' is-callout' : ''}`, contenteditable: 'false', 'data-editable': a.id,
        style: `${pos(a)}color:${a.color}`,
      }, (a.type === 'insertText' ? '\u2038 ' : '') + (a.text ?? ''));
    case 'comment':
      return h('div', { ...common, class: 'ep-a-pin', style: `left:${a.x * 100}%;top:${a.y * 100}%;background:${a.color}` }, icon('message', { size: 16 }));
    case 'attachment':
      return h('div', { ...common, class: 'ep-a-pin ep-a-attach', style: `left:${a.x * 100}%;top:${a.y * 100}%` }, icon('paperclip', { size: 16 }));
    case 'stamp':
      return h('div', { ...common, class: 'ep-a-stamp', style: `left:${a.x * 100}%;top:${a.y * 100}%;color:${a.color};border-color:${a.color}` }, a.text ?? 'APPROVED');
    case 'signature':
      return h('div', { ...common, class: 'ep-a-signature', style: `left:${a.x * 100}%;top:${a.y * 100}%;color:${a.color}` }, a.text ?? 'Signature');
    case 'image':
      return h('img', { ...common, class: 'ep-a-image', src: a.src ?? '', style: pos(a), draggable: false });
    case 'field': {
      const fill = S.fillMode ? ' is-fill' : '';
      let control: HTMLElement;
      if (a.kind === 'checkbox') control = h('input', { type: 'checkbox' });
      else if (a.kind === 'radio') control = h('input', { type: 'radio', name: 'r' + a.id });
      else if (a.kind === 'select') control = h('select', {}, h('option', {}, 'Option 1'), h('option', {}, 'Option 2'), h('option', {}, 'Option 3'));
      else if (a.kind === 'listbox') control = h('select', { multiple: true, size: 3 }, h('option', {}, 'Item 1'), h('option', {}, 'Item 2'), h('option', {}, 'Item 3'));
      else control = h('input', { type: 'text', placeholder: 'Text field' });
      return h('div', { ...common, class: `ep-a-field${fill}`, style: pos(a) }, control);
    }
    default:
      return null;
  }
}

/** Builds the annotation layer for one page. `preview` is the shape being drawn right now. */
export function buildLayer(page: number, preview?: Ann | null): HTMLElement {
  const d = doc();
  const layer = h('div', { class: 'ep-layer', 'data-layer': page });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'ep-ann-svg');
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const list = [...(d?.anns.filter((a) => a.page === page) ?? []), ...(preview && preview.page === page ? [preview] : [])];
  for (const a of list) {
    const g = s('g', { 'data-ann': a.id, class: 'ep-ann' });
    for (const el of svgShape(a)) g.appendChild(el);
    if (!['text', 'insertText', 'comment', 'attachment', 'stamp', 'signature', 'image', 'field'].includes(a.type)) {
      const pad = a.type === 'ink' || a.type === 'inkhl' || a.type === 'line' || a.type === 'arrow' ? 8 : 0;
      g.appendChild(s('rect', { class: 'ep-hit', x: a.x * VW - pad, y: a.y * VH - pad, width: a.w * VW + pad * 2, height: a.h * VH + pad * 2, fill: 'transparent' }));
    }
    svg.appendChild(g);
    if (S.selected === a.id && !['text', 'insertText', 'comment', 'attachment', 'stamp', 'signature', 'image', 'field', 'callout'].includes(a.type)) {
      svg.appendChild(s('rect', { class: 'ep-sel', x: a.x * VW - 4, y: a.y * VH - 4, width: a.w * VW + 8, height: a.h * VH + 8, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
    }
  }
  layer.appendChild(svg);
  for (const a of list) {
    const el = htmlItem(a);
    if (!el) continue;
    if (S.selected === a.id) el.classList.add('is-selected');
    layer.appendChild(el);
  }
  return layer;
}

export function repaintLayer(page: number, preview?: Ann | null): void {
  const old = document.querySelector(`.ep-layer[data-layer="${page}"]`);
  if (old) old.replaceWith(buildLayer(page, preview));
}
