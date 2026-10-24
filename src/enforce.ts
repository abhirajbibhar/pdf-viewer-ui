import { S } from './state';
import { isEnabled, categoryEnabled } from './features';
import { menuAvailable } from './components/menus';

const MODES = ['view', 'annotate', 'shapes', 'insert', 'form', 'redact'] as const;
const PANEL_CMD = { search: 'panel:toggle-search', comment: 'panel:toggle-comment', style: 'panel:toggle-annotation-style', redaction: 'panel:toggle-redaction' } as const;

/** Called before every render: drop any state that points at a feature that is switched off. */
export function enforceFeatures(): void {
  if (!isEnabled(`mode:${S.mode}`)) {
    const next = MODES.find((m) => isEnabled(`mode:${m}`));
    if (next) S.mode = next;
    S.tool = null;
  }
  if (S.tool && !isEnabled(S.tool)) S.tool = null;
  if (S.right && !isEnabled(PANEL_CMD[S.right])) S.right = null;
  if (S.leftOpen && !isEnabled('panel:toggle-sidebar')) S.leftOpen = false;
  if (S.leftTab === 'thumbnails' && !categoryEnabled('sidebar-thumbnails')) S.leftTab = 'outline';
  if (S.leftTab === 'outline' && !categoryEnabled('sidebar-outline')) S.leftTab = 'thumbnails';
  if (S.menu && !menuAvailable(S.menu)) S.menu = null;
  if (S.modal === 'print' && !isEnabled('document:print')) S.modal = null;
  if (S.modal === 'protect' && !isEnabled('document:protect')) S.modal = null;
  if (S.modal === 'signature' && !isEnabled('insert:add-signature')) S.modal = null;
}
