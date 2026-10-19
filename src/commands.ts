import { S, ZOOMS, doc, update, undo, redo, pushHistory, uid, newDoc, Mode, RightPanel } from './state';
import { TOOLS } from './annotations';
import { toast } from './components/toast';

export const MODE_DEFAULT_TOOL: Record<Mode, string | null> = {
  view: null, annotate: 'annotation:add-highlight', shapes: 'annotation:add-rectangle',
  insert: null, form: 'form:add-textfield', redact: 'redaction:redact',
};

export function setZoom(z: number): void {
  const d = doc();
  if (!d) return;
  d.zoom = Math.max(25, Math.min(1600, Math.round(z)));
  S.pending = { ratio: true };
}

export function viewportSize(): { w: number; h: number } {
  const vp = document.querySelector('.ep-viewport') as HTMLElement | null;
  return { w: vp?.clientWidth ?? 800, h: vp?.clientHeight ?? 600 };
}

export function goToPage(n: number): void {
  const d = doc();
  if (!d) return;
  d.page = Math.max(1, Math.min(d.pages, n));
  S.pending = { page: d.page };
}

export function toggleRight(p: Exclude<RightPanel, null>): void {
  S.right = S.right === p ? null : p;
  if (S.right === 'search') S.focusKey = 'search';
}

export function pickFile(accept: string, cb: (files: FileList) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => { if (input.files && input.files.length) cb(input.files); };
  input.click();
}

export function openDocFromPicker(): void {
  pickFile('application/pdf,.pdf', (files) => {
    update(() => {
      for (const f of Array.from(files)) {
        const d = newDoc(f.name);
        S.docs.push(d);
        S.active = d.id;
      }
      S.pending = { page: 1 };
    });
  });
}

export function activateTool(id: string | null): void {
  S.tool = id;
  if (id) S.fillMode = false;
  S.pointerTool = 'pointer';
  S.selected = null;
}

export function isActive(id: string): boolean {
  const d = doc();
  switch (id) {
    case 'panel:toggle-sidebar': return S.leftOpen;
    case 'panel:toggle-search': return S.right === 'search';
    case 'panel:toggle-comment': return S.right === 'comment';
    case 'panel:toggle-annotation-style': return S.right === 'style';
    case 'panel:toggle-redaction': return S.right === 'redaction';
    case 'pan:toggle': return S.pointerTool === 'pan';
    case 'pointer:toggle': return S.pointerTool === 'pointer' && !S.tool;
    case 'zoom:marquee': return S.pointerTool === 'marquee';
    case 'document:menu': return S.menu === 'document';
    case 'page:settings': return S.menu === 'page';
    case 'zoom:toggle-menu':
    case 'zoom:toggle-menu-mobile': return !!S.menu && S.menu.startsWith('zoom');
    case 'left-action-menu:overflow-menu': return !!S.menu && S.menu.startsWith('left');
    case 'tabs:overflow-menu': return S.menu === 'tabs';
    case 'annotation:overflow-tools': return S.menu === 'annot-more';
    case 'form:toggle-fill-mode': return S.fillMode;
    case 'spread:none': case 'spread:odd': case 'spread:even': return S.spread === id.split(':')[1];
    case 'scroll:vertical': return S.layout === 'vertical';
    case 'scroll:horizontal': return S.layout === 'horizontal';
  }
  if (id.startsWith('mode:')) return S.mode === id.slice(5);
  if (/^zoom:\d+$/.test(id)) return !!d && d.zoom === Number(id.slice(5));
  return S.tool === id;
}

export function isDisabled(id: string): boolean {
  const d = doc();
  if (!d) return true;
  switch (id) {
    case 'history:undo': return d.undo.length === 0;
    case 'history:redo': return d.redo.length === 0;
    case 'scroll:previous-page': return d.page <= 1;
    case 'scroll:next-page': return d.page >= d.pages;
    case 'zoom:in': return d.zoom >= 1600;
    case 'zoom:out': return d.zoom <= 25;
  }
  return false;
}

const MENU_TOGGLES: Record<string, string> = {
  'document:menu': 'document', 'page:settings': 'page', 'zoom:toggle-menu': 'zoom', 'zoom:toggle-menu-mobile': 'zoom',
  'left-action-menu:overflow-menu': 'left', 'tabs:overflow-menu': 'tabs', 'annotation:overflow-tools': 'annot-more',
};

export function execute(id: string): void {
  const d = doc();
  if (isDisabled(id)) return;

  if (MENU_TOGGLES[id]) { update(() => { const m = S.menu, t = MENU_TOGGLES[id]; S.menu = m === t || (t === 'left' && !!m?.startsWith('left')) || (t === 'zoom' && !!m?.startsWith('zoom')) ? null : t; }); return; }

  update(() => {
    S.menu = null;
    if (id.startsWith('mode:')) {
      S.mode = id.slice(5) as Mode;
      S.fillMode = false;
      activateTool(MODE_DEFAULT_TOOL[S.mode]);
      if (S.mode === 'redact') S.right = S.right ?? 'redaction';
      return;
    }
    if (TOOLS[id]) {
      if (id === 'insert:add-signature') { S.modal = 'signature'; return; }
      if (id === 'insert:add-image') {
        activateTool(S.tool === id ? null : id);
        return;
      }
      activateTool(S.tool === id ? null : id);
      return;
    }
    if (/^zoom:\d+$/.test(id)) { setZoom(Number(id.slice(5))); return; }
    switch (id) {
      case 'panel:toggle-sidebar': S.leftOpen = !S.leftOpen; break;
      case 'panel:toggle-search': toggleRight('search'); break;
      case 'panel:toggle-comment': toggleRight('comment'); break;
      case 'panel:toggle-annotation-style': toggleRight('style'); break;
      case 'panel:toggle-redaction': toggleRight('redaction'); break;
      case 'pan:toggle': S.pointerTool = S.pointerTool === 'pan' ? 'pointer' : 'pan'; S.tool = null; break;
      case 'pointer:toggle': S.pointerTool = 'pointer'; S.tool = null; break;
      case 'zoom:marquee': S.pointerTool = S.pointerTool === 'marquee' ? 'pointer' : 'marquee'; S.tool = null; break;
      case 'zoom:in': if (d) setZoom(ZOOMS.find((z) => z > d.zoom) ?? 1600); break;
      case 'zoom:out': if (d) setZoom([...ZOOMS].reverse().find((z) => z < d.zoom) ?? 25); break;
      case 'zoom:fit-width': {
        const { w } = viewportSize();
        setZoom(((w - 48) / 640) * 100 / (S.spread === 'none' ? 1 : 2) * (S.rotation % 180 ? 1 / 1.414 : 1));
        break;
      }
      case 'zoom:fit-page': {
        const { w, h } = viewportSize();
        const pw = S.rotation % 180 ? 640 * 1.414 : 640, ph = S.rotation % 180 ? 640 : 640 * 1.414;
        setZoom(Math.min((w - 48) / pw, (h - 48) / ph) * 100 / (S.spread === 'none' ? 1 : 1));
        break;
      }
      case 'spread:none': case 'spread:odd': case 'spread:even': S.spread = id.split(':')[1] as typeof S.spread; S.pending = { page: d?.page }; break;
      case 'scroll:vertical': S.layout = 'vertical'; S.pending = { page: d?.page }; break;
      case 'scroll:horizontal': S.layout = 'horizontal'; S.pending = { page: d?.page }; break;
      case 'rotate:clockwise': S.rotation = (S.rotation + 90) % 360; S.pending = { page: d?.page }; break;
      case 'rotate:counter-clockwise': S.rotation = (S.rotation + 270) % 360; S.pending = { page: d?.page }; break;
      case 'scroll:next-page': if (d) goToPage(d.page + 1); break;
      case 'scroll:previous-page': if (d) goToPage(d.page - 1); break;
      case 'history:undo': if (d) undo(d); break;
      case 'history:redo': if (d) redo(d); break;
      case 'form:toggle-fill-mode': S.fillMode = !S.fillMode; if (S.fillMode) S.tool = null; break;
      case 'document:open': openDocFromPicker(); break;
      case 'document:close': closeDoc(S.active); break;
      case 'document:print': S.modal = 'print'; S.print = { range: 'all', spec: '', annotations: true, busy: false }; break;
      case 'document:protect': S.modal = 'protect'; break;
      case 'document:export': toast('Exporting document\u2026 (demo only, nothing is downloaded)'); break;
      case 'document:capture': toast('Screenshot captured (demo)'); break;
      case 'document:fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
        break;
    }
  });
}

export function closeDoc(id: string | null): void {
  const i = S.docs.findIndex((x) => x.id === id);
  if (i < 0) return;
  S.docs.splice(i, 1);
  if (S.active === id) {
    S.active = S.docs[Math.min(i, S.docs.length - 1)]?.id ?? null;
    S.pending = { page: doc()?.page ?? 1 };
  }
  S.selected = null;
}

export { pushHistory, uid };
