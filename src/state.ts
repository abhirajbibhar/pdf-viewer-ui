import { buildPages, hashStr, PageContent } from './content';

export type Mode = 'view' | 'annotate' | 'shapes' | 'insert' | 'form' | 'redact';
export type RightPanel = 'search' | 'comment' | 'style' | 'redaction' | null;

export interface Ann {
  id: string; page: number; type: string;
  x: number; y: number; w: number; h: number; pts?: number[][];
  color: string; opacity: number; width: number; blend: string;
  text?: string; kind?: string; src?: string; applied?: boolean; commentId?: string;
}
export interface Reply { id: string; author: string; date: string; text: string; color: string }
export interface Cmt { id: string; page: number; annId?: string; author: string; date: string; text: string; color: string; replies?: Reply[] }
export interface Doc {
  id: string; name: string; pages: number; content: PageContent[];
  anns: Ann[]; undo: string[]; redo: string[]; zoom: number; page: number; comments: Cmt[];
}
export interface Style { color: string; opacity: number; width: number; blend: string }

export const ZOOMS = [25, 50, 100, 125, 150, 200, 400, 800, 1600];
export const BASE_PAGE_W = 640;
export const PAGE_RATIO = 1.414;

export const S = {
  docs: [] as Doc[],
  active: null as string | null,
  mode: 'view' as Mode,
  tool: null as string | null,              // active annotation / form / insert tool (command id)
  pointerTool: 'pointer' as 'pointer' | 'pan' | 'marquee',
  leftOpen: false,
  leftTab: 'thumbnails' as 'thumbnails' | 'outline',
  right: null as RightPanel,
  menu: null as string | null,
  modal: null as null | 'print' | 'protect' | 'signature',
  spread: 'none' as 'none' | 'odd' | 'even',
  layout: 'vertical' as 'vertical' | 'horizontal',
  rotation: 0,
  search: { q: '', matchCase: false, wholeWord: false, active: 0 },
  selected: null as string | null,
  editingComment: null as string | null,
  commentMenu: null as string | null,
  replyDraft: {} as Record<string, string>,   // unsent reply text per comment id (survives re-renders)
  outlineOpen: {} as Record<string, boolean>,
  fillMode: false,
  sigText: '',
  stampIdx: 0,
  print: { range: 'all' as 'all' | 'current' | 'specify', spec: '', annotations: true, busy: false },
  protect: { openPw: true, perms: false },
  defaults: {} as Record<string, Style>,
  focusKey: null as string | null,
  scrollHit: false,
  pending: null as null | { page?: number; left?: number; top?: number; ratio?: boolean },
};

let renderFn: () => void = () => {};
export const setRenderer = (f: () => void): void => { renderFn = f; };
export function update(fn?: () => void): void { fn?.(); renderFn(); }

let counter = 0;
export const uid = (p = 'id'): string => `${p}${++counter}`;

export const doc = (): Doc | null => S.docs.find((d) => d.id === S.active) ?? null;

export function newDoc(name: string, pages?: number): Doc {
  const seed = hashStr(name);
  const n = pages ?? 8 + (seed % 7);
  return { id: uid('doc'), name, pages: n, content: buildPages(seed, n, name), anns: [], undo: [], redo: [], zoom: 100, page: 1, comments: [] };
}

export function today(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ───────── history (annotations only) ─────────
export function pushHistory(d: Doc): void {
  d.undo.push(JSON.stringify(d.anns));
  if (d.undo.length > 60) d.undo.shift();
  d.redo = [];
}
function syncComments(d: Doc): void {
  d.comments = d.comments.filter((c) => !c.annId || d.anns.some((a) => a.id === c.annId));
}
export function undo(d: Doc): void {
  const prev = d.undo.pop();
  if (prev === undefined) return;
  d.redo.push(JSON.stringify(d.anns));
  d.anns = JSON.parse(prev);
  syncComments(d);
  if (S.selected && !d.anns.some((a) => a.id === S.selected)) S.selected = null;
}
export function redo(d: Doc): void {
  const next = d.redo.pop();
  if (next === undefined) return;
  d.undo.push(JSON.stringify(d.anns));
  d.anns = JSON.parse(next);
  syncComments(d);
}
export function removeAnn(d: Doc, id: string): void {
  pushHistory(d);
  d.anns = d.anns.filter((a) => a.id !== id);
  syncComments(d);
  if (S.selected === id) S.selected = null;
}

export function initDocs(): void {
  const a = newDoc('ebook.pdf', 12);
  a.comments = [
    { id: uid('c'), page: 1, author: 'Alex', date: 'Oct 19, 2026', text: 'Can we rephrase this sentence?', color: 'bg-blue',
      replies: [{ id: uid('r'), author: 'Priya', date: 'Oct 19, 2026', text: 'Agreed – I will tighten it up.', color: 'bg-purple' }] },
    { id: uid('c'), page: 1, author: 'Priya', date: 'Oct 18, 2026', text: 'Looks good to me.', color: 'bg-purple' },
    { id: uid('c'), page: 3, author: 'Sam', date: 'Oct 17, 2026', text: 'Please double-check this figure.', color: 'bg-green' },
  ];
  S.docs = [a, newDoc('demo.pdf', 6)];
  S.active = a.id;
}
