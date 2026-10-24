import { h } from '../dom';
import { S, update } from '../state';
import { sheetMenu } from './menus';

/**
 * Mobile menu bottom sheet (port of EmbedPDF's <MobileMenu> in schema-menu.tsx).
 * Wraps its content (max 80% of the viewer), slides up with a backdrop, and can be
 * dragged down to dismiss (>30% of its height or a fast flick).
 *
 * Like the sidebar drawer, the shell is created once and survives render() so the
 * slide transition can actually run; only the menu inside it is rebuilt.
 */
const ANIMATION_MS = 300;
const VELOCITY_THRESHOLD = 0.5; // px / ms
const MIN_DRAG_DISTANCE = 5;    // px
const CLOSE_THRESHOLD = 30;     // % of sheet height

const backdrop = h('div', { class: 'ep-sheet-backdrop' });
const content = h('div', { class: 'ep-sheet-content' });
const handle = h('div', { class: 'ep-sheet-handle', 'aria-hidden': 'true' }, h('div', { class: 'ep-drawer-grip' }));
const sheet = h('div', { class: 'ep-menu-sheet', role: 'dialog', 'aria-modal': 'true' }, handle, content);

/** Persistent node – main.ts keeps it attached to the root across renders. */
export const menuSheetLayer = h('div', { class: 'ep-sheet-layer' }, backdrop, sheet);

let visible = false;
let hideTimer = 0;
let token = 0;

function paint(open: boolean): void {
  sheet.style.transform = open ? 'translateY(0)' : 'translateY(100%)';
  backdrop.style.opacity = open ? '1' : '0';
}

function show(): void {
  if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = 0; paint(true); return; } // re-opened mid-close
  if (visible) return;
  visible = true;
  menuSheetLayer.classList.add('is-visible');
  paint(false);
  void sheet.offsetHeight; // commit the off-screen state so there is something to animate from
  const t = ++token;
  requestAnimationFrame(() => requestAnimationFrame(() => { if (t === token && visible) paint(true); }));
}

function hide(immediate: boolean): void {
  if (!visible) return;
  token++;
  const finish = () => {
    hideTimer = 0; visible = false;
    menuSheetLayer.classList.remove('is-visible');
    content.replaceChildren();
  };
  if (immediate) { window.clearTimeout(hideTimer); finish(); return; }
  paint(false);
  if (!hideTimer) hideTimer = window.setTimeout(finish, ANIMATION_MS);
}

/** Called from render(). `active` = the sheet layout is in use (mobile + menuSheet enabled). */
export function syncMenuSheet(active: boolean): void {
  const menu = active && S.menu ? sheetMenu() : null;
  if (!menu) { hide(!active); return; }
  content.replaceChildren(menu);
  show();
}

// ───────── interaction ─────────
const close = (): void => update(() => { S.menu = null; });
backdrop.addEventListener('click', close);

let drag: null | { id: number; startY: number; startT: number; height: number; offset: number; moved: boolean } = null;

handle.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0 || !visible) return;
  drag = { id: e.pointerId, startY: e.clientY, startT: performance.now(), height: sheet.offsetHeight || 1, offset: 0, moved: false };
  handle.setPointerCapture(e.pointerId);
  sheet.classList.add('is-dragging');
  e.preventDefault();
});

handle.addEventListener('pointermove', (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dy = e.clientY - drag.startY;
  if (Math.abs(dy) >= MIN_DRAG_DISTANCE) drag.moved = true;
  drag.offset = Math.max(0, dy); // only downwards
  sheet.style.transform = `translateY(${drag.offset}px)`;
});

function endDrag(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  sheet.classList.remove('is-dragging');
  if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  if (!d.moved) { paint(true); return; }
  const percent = (d.offset / d.height) * 100;
  const dt = performance.now() - d.startT;
  const velocity = dt > 0 ? d.offset / dt : 0;
  if (percent > CLOSE_THRESHOLD || velocity > VELOCITY_THRESHOLD) close(); // render -> hide() animates from the dragged position
  else paint(true);
}
handle.addEventListener('pointerup', endDrag);
handle.addEventListener('pointercancel', endDrag);
