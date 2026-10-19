/** Fake but searchable document content (deterministic per document). */
export interface PageContent { heading: string; sub?: string; paras: string[]; fig: 0 | 1 | 2 }
export interface OutlineNode { title: string; page: number; children?: OutlineNode[] }
export interface Hit { page: number; para: number; start: number; len: number; before: string; match: string; after: string }

const SENTENCES = [
  'This document describes the main features of the viewer and how to get the most out of them.',
  'Use the toolbar above the page to switch between viewing, annotating and filling in forms.',
  'Each page is rendered on demand, so even a large document opens quickly.',
  'Zoom in to read fine print, or fit the page to the width of your window.',
  'Highlights, underlines and comments are stored as annotations on the page.',
  'Open the sidebar to browse thumbnails or jump to a chapter from the outline.',
  'The search panel lists every match and lets you step through the results one by one.',
  'Several documents can be open at once, each in its own tab.',
  'Shapes such as rectangles, circles and arrows help you call attention to important areas.',
  'Form fields can be added to a page and then filled in by anyone who opens the document.',
  'Sensitive text can be marked for redaction and removed permanently when you are ready.',
  'Pan mode lets you drag the page around, while pointer mode lets you select text.',
  'Changes can be undone and redone at any time while you are working on the document.',
  'Print the whole document or just a range of pages, with or without annotations.',
  'Protect a document with a password and choose which actions other readers may perform.',
  'A clear structure makes a long document easier to scan, search and navigate.',
  'Reading comments from colleagues is simple because they are grouped by page.',
  'Every part of the interface follows the theme, so light and dark modes both look right.',
];

const CHAPTERS = [
  'Getting Started', 'Navigation', 'Zoom and Layout', 'Annotations', 'Shapes and Drawing', 'Forms',
  'Signatures and Stamps', 'Redaction', 'Printing and Security', 'Tips and Shortcuts', 'Appendix',
];

export function hashStr(s: string): number {
  let x = 7;
  for (let i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) >>> 0;
  return x;
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export function prettyTitle(name: string): string {
  const base = name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Untitled';
}

export function buildPages(seed: number, n: number, name: string): PageContent[] {
  const r = rng(seed);
  const pages: PageContent[] = [];
  for (let i = 0; i < n; i++) {
    const count = i === 0 ? 2 : 3 + Math.floor(r() * 3);
    const paras: string[] = [];
    for (let p = 0; p < count; p++) {
      const k = 3 + Math.floor(r() * 2);
      const used = new Set<number>();
      const parts: string[] = [];
      while (parts.length < k) {
        const idx = Math.floor(r() * SENTENCES.length);
        if (!used.has(idx)) { used.add(idx); parts.push(SENTENCES[idx]); }
      }
      paras.push(parts.join(' '));
    }
    pages.push({
      heading: i === 0 ? prettyTitle(name) : `${i}. ${CHAPTERS[(i - 1) % CHAPTERS.length]}`,
      sub: i === 0 ? 'Version 1.0 \u00b7 October 2026' : undefined,
      paras,
      fig: i === 0 ? 1 : r() < 0.35 ? 2 : 0,
    });
  }
  return pages;
}

export function buildOutline(pages: PageContent[]): OutlineNode[] {
  const out: OutlineNode[] = [{ title: 'Cover', page: 1 }];
  let parent: OutlineNode | null = null;
  for (let i = 1; i < pages.length; i++) {
    const node: OutlineNode = { title: pages[i].heading, page: i + 1 };
    if ((i - 1) % 3 === 0) { parent = node; out.push(node); }
    else if (parent) (parent.children ??= []).push(node);
  }
  return out;
}

export function findHits(pages: PageContent[], q: string, matchCase: boolean, wholeWord: boolean): Hit[] {
  if (!q.trim()) return [];
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(wholeWord ? `\\b${esc}\\b` : esc, matchCase ? 'g' : 'gi');
  const hits: Hit[] = [];
  pages.forEach((pg, pi) =>
    pg.paras.forEach((text, ki) => {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (!m[0].length) { re.lastIndex++; continue; }
        hits.push({
          page: pi + 1, para: ki, start: m.index, len: m[0].length,
          before: text.slice(Math.max(0, m.index - 28), m.index),
          match: m[0],
          after: text.slice(m.index + m[0].length, m.index + m[0].length + 32),
        });
      }
    }),
  );
  return hits;
}
