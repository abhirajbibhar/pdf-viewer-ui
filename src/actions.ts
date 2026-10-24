import { S, doc, update, pushHistory, removeAnn, Doc, Cmt, uid, today } from './state';
import { closeDoc, execute, goToPage, openDocFromPicker, setZoom, activateTool } from './commands';
import { hitsFor } from './components/viewport';
import { styleTarget } from './components/sidebars';
import { repaintLayer } from './annotations';
import { toast } from './components/toast';
import { categoryEnabled, isEnabled } from './features';
import { useDrawerMode } from './config';

function showHit(d: Doc, i: number): void {
  const hits = hitsFor(d);
  if (!hits.length) return;
  S.search.active = (i + hits.length) % hits.length;
  S.scrollHit = true;
  goToPage(hits[S.search.active].page);
}

function applyStyle(patch: Partial<{ color: string; opacity: number; width: number; blend: string }>, live = false): void {
  const d = doc();
  if (!d) return;
  const t = styleTarget(d);
  if (!t) return;
  if (t.ann) {
    if (!live) pushHistory(d);
    Object.assign(t.ann, patch);
    repaintLayer(t.ann.page);
  } else {
    S.defaults[t.type] = { ...t.style, ...patch };
  }
}

export function onClick(e: MouseEvent): void {
  const t = e.target as HTMLElement;
  const el = t.closest('[data-act],[data-command]') as HTMLElement | null;
  if (!el) return;
  const cmdId = el.getAttribute('data-command');
  if (cmdId) { execute(cmdId); return; }
  const act = el.getAttribute('data-act')!;
  const arg = el.getAttribute('data-arg') ?? '';
  const d = doc();

  switch (act) {
    case 'tab-select': update(() => { S.active = arg; S.selected = null; S.pending = { page: doc()?.page ?? 1 }; }); break;
    case 'tab-close': if (isEnabled('document:close')) update(() => closeDoc(arg)); break;
    case 'tab-add': if (isEnabled('document:open')) openDocFromPicker(); break;
    case 'left-tab': update(() => { S.leftTab = arg as typeof S.leftTab; }); break;
    case 'thumb': case 'outline-go': update(() => goToPage(Number(arg))); break;
    case 'outline-toggle': update(() => { S.outlineOpen[arg] = el.getAttribute('data-open') !== 'true'; }); break;
    case 'menu-go': update(() => { S.menu = arg; }); break;
    case 'search-clear': update(() => { S.search.q = ''; S.search.active = 0; S.focusKey = 'search'; }); break;
    case 'search-next': if (d) update(() => showHit(d, S.search.active + 1)); break;
    case 'search-prev': if (d) update(() => showHit(d, S.search.active - 1)); break;
    case 'hit-go': if (d) update(() => showHit(d, Number(arg))); break;
    case 'comment-go': {
      const c = d?.comments.find((x) => x.id === arg);
      if (c) update(() => {
        const wasSelected = !!c.annId && S.selected === c.annId;
        goToPage(c.page); S.selected = c.annId ?? null;
        if (!wasSelected && categoryEnabled('comment-reply') && matchMedia('(pointer: fine)').matches) S.focusKey = `reply-${c.id}`;
      });
      break;
    }
    case 'comment-menu': update(() => { S.commentMenu = S.commentMenu === arg ? null : arg; }); break;
    case 'comment-edit': if (!categoryEnabled('comment-edit')) break; update(() => { S.editingComment = arg; S.commentMenu = null; S.focusKey = 'comment-edit'; }); break;
    case 'comment-cancel': update(() => { S.editingComment = null; }); break;
    case 'comment-save': {
      const ta = document.querySelector('textarea[data-in="comment-text"]') as HTMLTextAreaElement | null;
      const found = findEntry(d, arg);
      update(() => { if (found && ta && ta.value.trim()) found.item.text = ta.value.trim(); S.editingComment = null; });
      break;
    }
    case 'noop': break; // clicks inside the reply form must not select the card
    case 'reply-send': sendReply(arg); break;
    case 'comment-delete': {
      if (!categoryEnabled('comment-delete')) break;
      const found = findEntry(d, arg);
      update(() => {
        if (!d || !found) return;
        if (found.parent) found.parent.replies = (found.parent.replies ?? []).filter((x) => x.id !== arg); // a reply
        else {
          const c = found.item as Cmt;
          if (c.annId) removeAnn(d, c.annId);
          else d.comments = d.comments.filter((x) => x.id !== arg);
        }
        S.commentMenu = null;
      });
      break;
    }
    case 'style-color': update(() => applyStyle({ color: arg })); break;
    case 'ann-delete': if (d) update(() => removeAnn(d, arg)); break;
    case 'redact-apply': if (d) update(() => { pushHistory(d); const a = d.anns.find((x) => x.id === arg); if (a) a.applied = true; }); break;
    case 'redact-apply-all': if (d) update(() => { pushHistory(d); d.anns.forEach((a) => { if (a.type === 'redact') a.applied = true; }); }); toast('Redactions applied'); break;
    case 'redact-clear': if (d) update(() => { pushHistory(d); d.anns = d.anns.filter((a) => !(a.type === 'redact' && !a.applied)); }); break;
    case 'modal-backdrop': if (t === el) update(() => { S.modal = null; }); break;
    case 'modal-close': update(() => { S.modal = null; }); break;
    case 'print-do':
      update(() => { S.print.busy = true; });
      window.setTimeout(() => { update(() => { S.modal = null; S.print.busy = false; }); toast('Sent to printer (demo only)'); }, 900);
      break;
    case 'protect-do': update(() => { S.modal = null; }); toast('Security settings applied (demo)'); break;
    case 'sig-do': update(() => { S.sigText = S.sigText.trim() || 'Signature'; S.modal = null; activateTool('insert:add-signature'); }); break;
  }
}

/** Find a comment, or a reply (returning its parent thread). */
function findEntry(d: Doc | null, id: string): { item: { text: string }; parent: Cmt | null } | null {
  if (!d) return null;
  for (const c of d.comments) {
    if (c.id === id) return { item: c, parent: null };
    const r = c.replies?.find((x) => x.id === id);
    if (r) return { item: r, parent: c };
  }
  return null;
}

function sendReply(id: string): void {
  const d = doc();
  const c = d?.comments.find((x) => x.id === id);
  if (!d || !c || !categoryEnabled('comment-reply')) return;
  const input = document.querySelector(`input[data-in="reply-text"][data-arg="${id}"]`) as HTMLInputElement | null;
  const text = (input?.value ?? S.replyDraft[id] ?? '').trim();
  if (!text) return;
  update(() => {
    (c.replies ??= []).push({ id: uid('r'), author: 'You', date: today(), text, color: 'bg-blue' });
    delete S.replyDraft[id];
    S.focusKey = `reply-${id}`;
  });
}

export function onInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  const key = el.getAttribute?.('data-in');
  if (!key) return;
  const d = doc();
  const live = (id: string, text: string) => { const n = document.getElementById(id); if (n) n.textContent = text; };
  switch (key) {
    case 'reply-text': {
      const id = el.getAttribute('data-arg')!;
      S.replyDraft[id] = el.value;
      const btn = el.parentElement?.querySelector('.ep-reply-send') as HTMLButtonElement | null;
      if (btn) btn.disabled = !el.value.trim(); // no re-render: the field keeps focus
      return;
    }
    case 'search-q':
      S.search.q = el.value; S.search.active = 0; S.focusKey = 'search';
      update(() => { if (d) { const hs = hitsFor(d); if (hs.length) { S.scrollHit = true; goToPage(hs[0].page); } } });
      break;
    case 'style-opacity': applyStyle({ opacity: Number(el.value) / 100 }, true); live('style-opacity-v', `${el.value}%`); break;
    case 'style-width': applyStyle({ width: Number(el.value) }, true); live('style-width-v', `${el.value}px`); break;
    case 'style-blend': applyStyle({ blend: el.value }); break;
    case 'print-spec': S.print.spec = el.value; break;
    case 'sig-text': S.sigText = el.value; live('sig-preview', el.value || 'Signature'); break;
  }
}

export function onChange(e: Event): void {
  const el = e.target as HTMLInputElement;
  const key = el.getAttribute?.('data-in');
  if (!key) return;
  const d = doc();
  switch (key) {
    case 'search-case': update(() => { S.search.matchCase = el.checked; S.search.active = 0; }); break;
    case 'search-word': update(() => { S.search.wholeWord = el.checked; S.search.active = 0; }); break;
    case 'print-range': update(() => { S.print.range = el.value as typeof S.print.range; }); break;
    case 'print-ann': S.print.annotations = el.checked; break;
    case 'protect-open': update(() => { S.protect.openPw = el.checked; }); break;
    case 'protect-perms': update(() => { S.protect.perms = el.checked; }); break;
    case 'zoom': { const n = parseInt(el.value, 10); update(() => { if (!isNaN(n)) setZoom(n); }); break; }
    case 'page': { const n = parseInt(el.value, 10); update(() => { if (d && !isNaN(n)) goToPage(n); }); break; }
  }
}

const typing = (t: HTMLElement): boolean => /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;

export function onKeydown(e: KeyboardEvent): void {
  const t = e.target as HTMLElement;
  const d = doc();
  if (e.key === 'Escape') {
    if (t.isContentEditable) t.blur();
    update(() => {
      if (S.modal) S.modal = null;
      else if (S.menu || S.commentMenu) { S.menu = null; S.commentMenu = null; }
      else if (S.editingComment) S.editingComment = null;
      else if (useDrawerMode() && (S.leftOpen || S.right)) { S.leftOpen = false; S.right = null; }
      else if (S.selected) S.selected = null;
      else if (S.tool || S.pointerTool !== 'pointer') { S.tool = null; S.pointerTool = 'pointer'; }
    });
    return;
  }
  if (typing(t)) {
    const key = t.getAttribute('data-in');
    if (e.key === 'Enter' && (key === 'zoom' || key === 'page')) { e.preventDefault(); onChange(e); }
    else if (e.key === 'Enter' && key === 'reply-text') { e.preventDefault(); sendReply(t.getAttribute('data-arg')!); }
    else if (e.key === 'Enter' && key === 'search-q' && d) { e.preventDefault(); update(() => showHit(d, S.search.active + (e.shiftKey ? -1 : 1))); S.focusKey = 'search'; }
    else if (e.key === 'Enter' && t.hasAttribute('data-editable') === false && t.isContentEditable) { e.preventDefault(); t.blur(); }
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); if (isEnabled('panel:toggle-search')) update(() => { S.right = 'search'; S.focusKey = 'search'; }); }
  else if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); execute('document:print'); }
  else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); execute(e.shiftKey ? 'history:redo' : 'history:undo'); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); execute('history:redo'); }
  else if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); execute('zoom:in'); }
  else if (mod && e.key === '-') { e.preventDefault(); execute('zoom:out'); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected && d) { e.preventDefault(); update(() => removeAnn(d, S.selected!)); }
}
