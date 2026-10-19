import { h } from './dom';
import { S, doc, initDocs, setRenderer } from './state';
import { TOOLS } from './annotations';
import { tabBar } from './components/tabBar';
import { mainToolbar, secondaryToolbar } from './components/toolbar';
import { leftSidebar, rightSidebar } from './components/sidebars';
import { viewport, emptyState } from './components/viewport';
import { printModal, protectModal, signatureModal } from './components/modals';
import { setupTooltips } from './components/tooltip';
import { onChange, onClick, onInput, onKeydown } from './actions';
import { flashControls, setupInteractions, syncPageUI } from './interactions';

const target = document.getElementById('pdf-viewer')!;
const root = h('div', { class: 'ep-root' });
target.appendChild(root);

function render(): void {
  // ── capture transient UI state ──
  const scrolls: Record<string, { l: number; t: number; w: number; h: number }> = {};
  root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => {
    scrolls[el.getAttribute('data-scroll')!] = { l: el.scrollLeft, t: el.scrollTop, w: el.scrollWidth, h: el.scrollHeight };
  });
  const ae = document.activeElement as HTMLInputElement | null;
  const focusKey = ae && root.contains(ae) ? ae.getAttribute?.('data-focus') : null;
  const sel = focusKey ? { s: ae!.selectionStart, e: ae!.selectionEnd } : null;

  // ── build ──
  const d = doc();
  const classes = ['ep-root'];
  if (S.pointerTool === 'pan') classes.push('tool-pan');
  if (S.pointerTool === 'marquee') classes.push('tool-marquee');
  if (S.tool && TOOLS[S.tool] && !S.fillMode) classes.push('tool-draw');
  root.className = classes.join(' ');

  const content = d
    ? h('div', { class: 'ep-content' }, S.leftOpen ? leftSidebar(d) : null, h('div', { class: 'ep-main' }, viewport()), S.right ? rightSidebar(d) : null)
    : h('div', { class: 'ep-content' }, h('div', { class: 'ep-main' }, emptyState()));

  const modal = S.modal === 'print' && d ? printModal() : S.modal === 'protect' ? protectModal() : S.modal === 'signature' ? signatureModal() : null;
  const parts: (Node | null)[] = [tabBar(), d ? mainToolbar() : null, d ? secondaryToolbar() : null, content, modal];
  root.replaceChildren(...parts.filter((n): n is Node => n !== null));

  // ── restore ──
  const pending = S.pending;
  S.pending = null;
  root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => {
    const key = el.getAttribute('data-scroll')!;
    const prev = scrolls[key];
    if (!prev) return;
    if (key === 'viewport' && pending?.ratio) {
      el.scrollLeft = (prev.l / prev.w) * el.scrollWidth + (el.clientWidth ? 0 : 0);
      el.scrollTop = (prev.t / prev.h) * el.scrollHeight;
    } else { el.scrollLeft = prev.l; el.scrollTop = prev.t; }
  });

  const vp = root.querySelector('.ep-viewport') as HTMLElement | null;
  if (vp && pending) {
    if (pending.page !== undefined) {
      const box = vp.querySelector(`[data-page-box="${pending.page}"]`) as HTMLElement | null;
      if (box) {
        const vr = vp.getBoundingClientRect(), br = box.getBoundingClientRect();
        if (S.layout === 'horizontal') vp.scrollLeft += br.left - vr.left - 24;
        else vp.scrollTop += br.top - vr.top - 16;
      }
      flashControls();
    }
    if (pending.left !== undefined) vp.scrollLeft = pending.left;
    if (pending.top !== undefined) vp.scrollTop = pending.top;
  }
  if (S.scrollHit) {
    S.scrollHit = false;
    (root.querySelector('.ep-mark.is-active') as HTMLElement | null)?.scrollIntoView({ block: 'center', inline: 'center' });
  }

  const wanted = S.focusKey ?? focusKey;
  if (wanted) {
    const el = root.querySelector(`[data-focus="${wanted}"]`) as HTMLInputElement | null;
    if (el) {
      el.focus();
      if (S.focusKey) el.select?.();
      else if (sel && sel.s !== null && sel.e !== null) el.setSelectionRange?.(sel.s, sel.e);
    }
    S.focusKey = null;
  }
  syncPageUI();
}

const theme = new URLSearchParams(location.hash.slice(1)).get('theme');
if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);

initDocs();
setRenderer(render);
root.addEventListener('click', onClick);
root.addEventListener('input', onInput);
root.addEventListener('change', onChange);
document.addEventListener('keydown', onKeydown);
setupTooltips(root);
setupInteractions(root);
render();
