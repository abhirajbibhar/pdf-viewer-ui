import { Ann, BASE_PAGE_W, PAGE_RATIO, S, doc, pushHistory, uid, update, today, ZOOMS } from './state';
import { TOOLS, STAMPS, ToolDef, bboxOf, defaultFor, repaintLayer } from './annotations';
import { pickFile, setZoom } from './commands';

type Drag =
  | { kind: 'pan'; x: number; y: number; sl: number; st: number; vp: HTMLElement }
  | { kind: 'marquee'; x0: number; y0: number; el: HTMLElement; wrap: HTMLElement }
  | { kind: 'draw'; def: ToolDef; page: number; start: { x: number; y: number }; ann: Ann }
  | { kind: 'move'; id: string; page: number; last: { x: number; y: number }; moved: boolean };

let drag: Drag | null = null;
let hideTimer: number | undefined;

const pageEl = (n: number): HTMLElement | null => document.querySelector(`.ep-page[data-page="${n}"]`);

/** Pointer position -> 0..1 page coordinates (accounts for rotation). */
function toPage(e: PointerEvent, el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const W = el.offsetWidth, H = el.offsetHeight;
  const a = (-S.rotation * Math.PI) / 180;
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: Math.max(0, Math.min(1, (x + W / 2) / W)), y: Math.max(0, Math.min(1, (y + H / 2) / H)) };
}

export function flashControls(): void {
  const el = document.querySelector('.ep-overlay');
  if (!el) return;
  el.classList.add('is-visible');
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => el.classList.remove('is-visible'), 2500);
}

export function syncPageUI(): void {
  const d = doc();
  if (!d) return;
  const input = document.querySelector('.ep-page-input') as HTMLInputElement | null;
  if (input && document.activeElement !== input) input.value = String(d.page);
  document.querySelectorAll('.ep-thumb-frame').forEach((f) => f.classList.toggle('is-current', Number(f.getAttribute('data-thumb')) === d.page));
  const prev = document.querySelector('[data-command="scroll:previous-page"]') as HTMLButtonElement | null;
  const next = document.querySelector('[data-command="scroll:next-page"]') as HTMLButtonElement | null;
  prev?.classList.toggle('is-disabled', d.page <= 1); if (prev) prev.disabled = d.page <= 1;
  next?.classList.toggle('is-disabled', d.page >= d.pages); if (next) next.disabled = d.page >= d.pages;
}

function onScroll(e: Event): void {
  const vp = e.target as HTMLElement;
  if (!vp.classList?.contains('ep-viewport')) return;
  const d = doc();
  if (!d) return;
  const vr = vp.getBoundingClientRect();
  let best = d.page, bestArea = -1;
  vp.querySelectorAll('.ep-page-box').forEach((b) => {
    const r = b.getBoundingClientRect();
    const w = Math.min(r.right, vr.right) - Math.max(r.left, vr.left);
    const h = Math.min(r.bottom, vr.bottom) - Math.max(r.top, vr.top);
    const area = Math.max(0, w) * Math.max(0, h);
    if (area > bestArea) { bestArea = area; best = Number(b.getAttribute('data-page-box')); }
  });
  if (best !== d.page) { d.page = best; syncPageUI(); }
  flashControls();
}

function startEdit(id: string): void {
  {
    const el = document.querySelector(`[data-editable="${id}"]`) as HTMLElement | null;
    if (!el) return;
    el.contentEditable = 'true';
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges(); sel?.addRange(range);
  }
}

function create(page: number, def: ToolDef, p: { x: number; y: number }): Ann {
  const st = defaultFor(def.type);
  return { id: uid('a'), page, type: def.type, kind: def.kind, x: p.x, y: p.y, w: 0, h: 0, ...st };
}

function placeClickTool(toolId: string, def: ToolDef, page: number, p: { x: number; y: number }): void {
  const d = doc()!;
  const a = create(page, def, p);
  switch (def.type) {
    case 'text': Object.assign(a, { w: 0.28, h: 0.04, text: 'Text' }); break;
    case 'insertText': Object.assign(a, { w: 0.28, h: 0.04, text: 'Inserted text' }); break;
    case 'callout': Object.assign(a, { x: Math.min(0.7, p.x + 0.06), y: Math.max(0.02, p.y - 0.09), w: 0.26, h: 0.05, text: 'Callout', pts: [[p.x, p.y]] }); break;
    case 'comment': a.commentId = uid('c'); break;
    case 'stamp': a.text = STAMPS[S.stampIdx++ % STAMPS.length]; break;
    case 'signature': a.text = S.sigText || 'Signature'; break;
    case 'field': Object.assign(a, { w: 0.032, h: 0.023 }); break;
    case 'image': return placeImage(page, p);
  }
  pushHistory(d);
  d.anns.push(a);
  if (def.type === 'comment') {
    d.comments.push({ id: a.commentId!, page, annId: a.id, author: 'You', date: today(), text: 'New comment', color: 'bg-blue' });
  }
  update(() => {
    if (def.type === 'comment') { S.right = 'comment'; S.editingComment = a.commentId!; S.focusKey = 'comment-edit'; S.tool = null; }
    if (['text', 'insertText', 'callout'].includes(def.type)) S.selected = a.id;
  });
  if (['text', 'insertText', 'callout'].includes(def.type)) startEdit(a.id);
}

function placeImage(page: number, p: { x: number; y: number }): void {
  pickFile('image/*', (files) => {
    const url = URL.createObjectURL(files[0]);
    const img = new Image();
    img.onload = () => {
      const w = 0.3, h = (w / PAGE_RATIO) * (img.naturalHeight / img.naturalWidth);
      const d = doc()!;
      const a = { ...create(page, TOOLS['insert:add-image'], p), w, h, src: url } as Ann;
      a.x = Math.min(p.x, 1 - w); a.y = Math.min(p.y, 1 - h);
      pushHistory(d); d.anns.push(a);
      update(() => { S.selected = a.id; S.tool = null; });
    };
    img.src = url;
  });
}

function onDown(e: PointerEvent): void {
  const t = e.target as HTMLElement;
  // commit an in-progress text edit before the DOM is rebuilt
  const ae = document.activeElement as HTMLElement | null;
  if (ae?.isContentEditable && !t.closest('[contenteditable="true"]')) ae.blur();

  // close popups when pressing elsewhere
  if ((S.menu || S.commentMenu) && !t.closest('.ep-menu') && !t.closest('[data-menu-trigger]')) {
    S.menu = null; S.commentMenu = null; update();
  }
  if (e.button !== 0) return;
  const vp = t.closest('.ep-viewport') as HTMLElement | null;
  if (!vp) return;
  const d = doc();
  if (!d) return;
  const el = t.closest('.ep-page') as HTMLElement | null;

  if (S.pointerTool === 'pan') {
    drag = { kind: 'pan', x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop, vp };
    document.querySelector('.ep-root')?.classList.add('panning');
    e.preventDefault();
    return;
  }
  if (S.pointerTool === 'marquee') {
    const wrap = vp.parentElement as HTMLElement;
    const box = document.createElement('div');
    box.className = 'ep-marquee';
    wrap.appendChild(box);
    drag = { kind: 'marquee', x0: e.clientX, y0: e.clientY, el: box, wrap };
    e.preventDefault();
    return;
  }
  if (S.tool && TOOLS[S.tool] && !S.fillMode && el) {
    const def = TOOLS[S.tool];
    const page = Number(el.getAttribute('data-page'));
    const p = toPage(e, el);
    e.preventDefault();
    if (t.closest('[data-editable][contenteditable="true"]')) return;
    if (def.drag) {
      const ann = create(page, def, p);
      if (def.type === 'ink' || def.type === 'inkhl') ann.pts = [[p.x, p.y]];
      drag = { kind: 'draw', def, page, start: p, ann };
    } else placeClickTool(S.tool, def, page, p);
    return;
  }

  // pointer mode: select / move annotations
  if (t.closest('.ep-a-field.is-fill') || t.closest('[contenteditable="true"]')) return;
  const annEl = t.closest('[data-ann]') as HTMLElement | null;
  if (annEl && el) {
    const id = annEl.getAttribute('data-ann')!;
    const page = Number(el.getAttribute('data-page'));
    drag = { kind: 'move', id, page, last: toPage(e, el), moved: false };
    if (S.selected !== id) update(() => { S.selected = id; });
    return;
  }
  if (S.selected) update(() => { S.selected = null; });
}

function onMove(e: PointerEvent): void {
  if (!drag) return;
  if (drag.kind === 'pan') {
    drag.vp.scrollLeft = drag.sl - (e.clientX - drag.x);
    drag.vp.scrollTop = drag.st - (e.clientY - drag.y);
  } else if (drag.kind === 'marquee') {
    const r = drag.wrap.getBoundingClientRect();
    const x = Math.min(e.clientX, drag.x0) - r.left, y = Math.min(e.clientY, drag.y0) - r.top;
    Object.assign(drag.el.style, { left: `${x}px`, top: `${y}px`, width: `${Math.abs(e.clientX - drag.x0)}px`, height: `${Math.abs(e.clientY - drag.y0)}px` });
  } else if (drag.kind === 'draw') {
    const el = pageEl(drag.page);
    if (!el) return;
    const p = toPage(e, el);
    const a = drag.ann, s = drag.start;
    if (a.type === 'ink' || a.type === 'inkhl') { a.pts!.push([p.x, p.y]); Object.assign(a, bboxOf(a.pts!)); }
    else if (a.type === 'line' || a.type === 'arrow') { a.pts = [[s.x, s.y], [p.x, p.y]]; Object.assign(a, bboxOf(a.pts)); }
    else Object.assign(a, { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
    repaintLayer(drag.page, a);
  } else if (drag.kind === 'move') {
    const d = doc(), el = pageEl(drag.page);
    const moveId = drag.id;
    const a = d?.anns.find((x) => x.id === moveId);
    if (!d || !el || !a) return;
    const p = toPage(e, el);
    const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
    if (!drag.moved) { if (Math.abs(dx) + Math.abs(dy) < 0.002) return; pushHistory(d); drag.moved = true; }
    a.x += dx; a.y += dy;
    a.pts?.forEach((q) => { q[0] += dx; q[1] += dy; });
    drag.last = p;
    repaintLayer(drag.page);
  }
}

function onUp(e: PointerEvent): void {
  if (!drag) return;
  const dr = drag;
  drag = null;
  document.querySelector('.ep-root')?.classList.remove('panning');
  if (dr.kind === 'marquee') {
    const rect = dr.el.getBoundingClientRect();
    dr.el.remove();
    const d = doc();
    const vp = document.querySelector('.ep-viewport') as HTMLElement | null;
    update(() => {
      S.pointerTool = 'pointer';
      if (d && vp && rect.width > 8 && rect.height > 8) {
        const vr = vp.getBoundingClientRect();
        const factor = Math.min(vp.clientWidth / rect.width, vp.clientHeight / rect.height);
        const old = d.zoom;
        setZoom(old * factor);
        const k = d.zoom / old;
        S.pending = { left: (vp.scrollLeft + rect.left - vr.left) * k, top: (vp.scrollTop + rect.top - vr.top) * k };
      }
    });
  } else if (dr.kind === 'draw') {
    const d = doc()!;
    const a = dr.ann;
    const tiny = a.w < 0.008 && a.h < 0.008;
    const markup = ['highlight', 'underline', 'strikeout', 'squiggly', 'replaceText', 'ink', 'inkhl', 'line', 'arrow'].includes(a.type);
    if (tiny && markup) { repaintLayer(dr.page); return; }
    if (tiny) {
      if (a.type === 'field') Object.assign(a, { w: a.kind === 'select' || a.kind === 'textfield' ? 0.3 : 0.2, h: a.kind === 'listbox' ? 0.07 : 0.03 });
      else Object.assign(a, { w: 0.14, h: 0.09 });
      a.x = Math.min(a.x, 1 - a.w); a.y = Math.min(a.y, 1 - a.h);
    }
    if (a.type === 'field' && a.w < 0.05) Object.assign(a, { w: 0.2 });
    pushHistory(d);
    d.anns.push(a);
    update(() => { if (a.type === 'redact') S.right = 'redaction'; });
  } else if (dr.kind === 'move') {
    if (dr.moved) update();
  }
  void e;
}

export function setupInteractions(root: HTMLElement): void {
  root.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  root.addEventListener('scroll', onScroll, true);

  root.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const vp = (e.target as HTMLElement).closest('.ep-viewport');
    const d = doc();
    if (!vp || !d) return;
    e.preventDefault();
    update(() => setZoom(e.deltaY < 0 ? ZOOMS.find((z) => z > d.zoom) ?? 1600 : [...ZOOMS].reverse().find((z) => z < d.zoom) ?? 25));
  }, { passive: false });

  root.addEventListener('dblclick', (e) => {
    const el = (e.target as HTMLElement).closest('[data-editable]');
    if (el && !S.tool) startEdit(el.getAttribute('data-editable')!);
  });
  root.addEventListener('focusout', (e) => {
    const el = e.target as HTMLElement;
    const id = el.getAttribute?.('data-editable');
    if (!id) return;
    const a = doc()?.anns.find((x) => x.id === id);
    const text = (el.textContent ?? '').replace(/^\u2038 /, '');
    if (a && a.text !== text) { pushHistory(doc()!); a.text = text; }
    el.contentEditable = 'false';
  });
  void BASE_PAGE_W;
}
