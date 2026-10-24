import { h } from '../dom';
import { Doc, S, update } from '../state';
import { config } from '../config';
import { leftSidebar, rightSidebar } from './sidebars';

/**
 * Mobile bottom drawer (port of EmbedPDF's <BottomDrawer>).
 *
 * Below MOBILE_BREAKPOINT the left sidebar and the right panels (search, comments,
 * annotation styles, redactions) are shown in a sheet that slides up from the bottom,
 * with a dimmed backdrop, a drag handle and closed / half / full snap points.
 *
 * render() rebuilds the whole DOM on every state change, so the drawer shell
 * (layer, backdrop, sheet, handle) is created ONCE here and kept alive across renders.
 * Only the panel inside it is rebuilt. That is what lets the CSS height transition run.
 */

type Snap = 'closed' | 'half' | 'full';
const PCT: Record<Snap, number> = { closed: 0, half: 50, full: 100 };

const ANIMATION_MS = 300;
const VELOCITY_THRESHOLD = 0.5; // px / ms
const SNAP_FULL_ABOVE = 75;     // % – slow drag above this snaps to full
const SNAP_CLOSE_BELOW = 25;    // % – slow drag below this closes
const TAP_SLOP = 5;             // px – movement below this is a tap, not a drag

const backdrop = h('div', { class: 'ep-drawer-backdrop' });
const body = h('div', { class: 'ep-drawer-body' });
const handle = h('div', { class: 'ep-drawer-handle', 'aria-hidden': 'true' }, h('div', { class: 'ep-drawer-grip' }));
const sheet = h('div', { class: 'ep-drawer', role: 'dialog', 'aria-modal': 'true' }, handle, body);

/** Persistent node – main.ts keeps it attached to the root across renders. */
export const drawerLayer = h('div', { class: 'ep-drawer-layer' }, backdrop, sheet);

let visible = false;
let snap: Snap = 'closed';
let hideTimer = 0;
let openToken = 0;

// ───────── which panel is open ─────────
let prevLeft = false;

/** On mobile only one panel fits at a time: the one opened most recently wins. */
export function normalizePanels(mobile: boolean): void {
  if (mobile && S.leftOpen && S.right) {
    if (!prevLeft) S.right = null;      // sidebar was just opened
    else S.leftOpen = false;            // a right panel was just opened / changed
  }
  prevLeft = S.leftOpen;
}

function closePanels(): void {
  update(() => { S.leftOpen = false; S.right = null; });
}

// ───────── visuals ─────────
function paint(pct: number): void {
  sheet.style.height = `${pct}%`;
  backdrop.style.opacity = String(Math.min(pct / PCT.half, 1) * 0.6);
  backdrop.style.pointerEvents = pct === 0 ? 'none' : 'auto';
}

function show(): void {
  window.clearTimeout(hideTimer);
  hideTimer = 0;
  if (visible) {
    // re-opened while the close animation was still running
    snap = snap === 'closed' ? config.mobile.drawer.initialSnap : snap;
    paint(PCT[snap]);
    return;
  }
  visible = true;
  snap = 'closed';
  drawerLayer.classList.add('is-visible');
  paint(0);
  void sheet.offsetHeight; // commit the closed state so the browser has something to animate from
  const token = ++openToken;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token !== openToken || !visible) return;
    snap = config.mobile.drawer.initialSnap;
    paint(PCT[snap]);
  }));
}

function hide(immediate = false): void {
  if (!visible) return;
  openToken++;
  snap = 'closed';
  const finish = () => {
    hideTimer = 0;
    visible = false;
    drawerLayer.classList.remove('is-visible');
    body.replaceChildren();
  };
  if (immediate) { window.clearTimeout(hideTimer); finish(); return; }
  paint(0);
  if (!hideTimer) hideTimer = window.setTimeout(finish, ANIMATION_MS);
}

/** Called from render() after the main DOM is rebuilt. */
export function syncDrawer(d: Doc | null, mobile: boolean): void {
  const panel = d && mobile ? (S.right ? 'right' : S.leftOpen ? 'left' : null) : null;
  if (!d || !panel) { hide(!mobile); return; }

  const el = panel === 'left' ? leftSidebar(d) : rightSidebar(d);
  el.classList.add('in-drawer');
  body.replaceChildren(el);
  sheet.setAttribute('data-panel', panel === 'left' ? 'left' : S.right!);
  show();
}

// ───────── interaction ─────────
backdrop.addEventListener('click', closePanels);
if (!config.mobile.drawer.resizable) handle.classList.add('is-static');

let drag: null | { id: number; startY: number; startPct: number; moved: boolean; samples: { y: number; t: number }[] } = null;

handle.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0 || !visible || !config.mobile.drawer.resizable) return;
  const total = drawerLayer.clientHeight || 1;
  drag = { id: e.pointerId, startY: e.clientY, startPct: (sheet.offsetHeight / total) * 100, moved: false, samples: [{ y: e.clientY, t: performance.now() }] };
  handle.setPointerCapture(e.pointerId);
  sheet.classList.add('is-dragging');
  backdrop.classList.add('is-dragging');
  e.preventDefault();
});

handle.addEventListener('pointermove', (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return;
  const total = drawerLayer.clientHeight || 1;
  if (Math.abs(e.clientY - drag.startY) >= TAP_SLOP) drag.moved = true;
  const pct = Math.max(0, Math.min(100, drag.startPct + ((drag.startY - e.clientY) / total) * 100));
  const now = performance.now();
  drag.samples.push({ y: e.clientY, t: now });
  while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
  paint(pct);
});

function endDrag(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  sheet.classList.remove('is-dragging');
  backdrop.classList.remove('is-dragging');
  if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);

  const total = drawerLayer.clientHeight || 1;
  const current = (sheet.offsetHeight / total) * 100;
  if (!d.moved) { paint(PCT[snap]); return; } // a tap on the handle does nothing

  // velocity in px/ms, positive = moving down
  const first = d.samples[0], last = d.samples[d.samples.length - 1];
  const dt = last.t - first.t;
  const velocity = dt > 0 ? (last.y - first.y) / dt : 0;

  let next: Snap;
  if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
    next = velocity > 0 ? (current > PCT.half ? 'half' : 'closed') : (current < PCT.half ? 'half' : 'full');
  } else if (current >= SNAP_FULL_ABOVE) next = 'full';
  else if (current <= SNAP_CLOSE_BELOW) next = 'closed';
  else next = 'half';

  if (next === 'closed') { closePanels(); return; } // render -> syncDrawer -> hide() animates from the current height
  snap = next;
  paint(PCT[next]);
}
handle.addEventListener('pointerup', endDrag);
handle.addEventListener('pointercancel', endDrag);
