# PDF Viewer UI – interactive demo (TypeScript + HTML + CSS)

A front-end-only recreation of the EmbedPDF viewer chrome. There is **no PDF engine**: pages are generated,
searchable placeholder text, but every control around them behaves like the real thing.

## Run it

`dist/app.js` is pre-built, so just open `index.html`.

```bash
npm install
npm run build      # src/main.ts -> dist/app.js (esbuild bundle)
npm run watch
npm run typecheck
```

## What works

- **Tabs**: switch, close, open (file picker adds a tab named after the file), empty state
- **Menus**: document, page settings, zoom, mode overflow, annotation overflow; click outside / Esc closes them
- **Tools**: Pointer, Pan (drag to scroll), Marquee zoom, zoom in/out/presets/fit page/fit width, Ctrl+wheel zoom
- **Layout**: single / two-page spreads, vertical / horizontal scroll, rotation
- **Sidebars**: thumbnails + outline (left); search, comments, annotation styles, redactions (right)
- **Search**: live results, case / whole-word toggles, next / previous, highlighted matches on the pages
- **Comments**: add with the comment tool, edit, delete, jump to page
- **Annotate / Shapes / Form / Insert / Redact**: drag to draw highlights, underlines, ink, shapes, arrows,
  form fields; click to place text, comments, stamps, signatures, images; select, move, delete (Del), undo / redo
- **Style panel**: colour, opacity, stroke width and blend mode for the selected annotation or the active tool
- **Dialogs**: print, security, signature
- **Responsive** (container-width) toolbar and light / dark theme (`index.html#theme=dark` to force)

Shortcuts: Ctrl+F search, Ctrl+P print, Ctrl+Z / Ctrl+Shift+Z undo / redo, Ctrl +/- zoom, Esc cancel, Del delete.

Export, screenshot and printing only show a toast, and nothing is saved anywhere.

## Layout

```
index.html
src/config.ts        feature switches + mobile options (edit DEFAULT_CONFIG)
src/features.ts      command categories (print, annotation, ...) and enable checks
src/enforce.ts       resets state that points at a disabled feature
css/theme.css        colour tokens
css/viewer.css       styles
src/state.ts         central state + history
src/commands.ts      command registry (execute / isActive / isDisabled)
src/actions.ts       click / input / keyboard handlers
src/interactions.ts  pointer drawing, pan, marquee, scroll tracking
src/annotations.ts   annotation model + SVG/HTML layer renderer
src/content.ts       generated page text, outline, search
src/components/      drawer (mobile sidebar drawer), menuSheet (mobile menu sheet), tabBar, toolbar, menus, sidebars, viewport, modals, toast, tooltip
src/icons.ts         SVG icons extracted from the original components
```

## Mobile UI (container width < 768px)

Mirrors EmbedPDF's native behaviour: instead of side panels and dropdowns, the viewer uses bottom sheets.

- **Sidebar drawer** (`components/drawer.ts`): thumbnails / outline, search, comments, annotation styles and redactions slide up
  from the bottom with a backdrop and a drag handle. Snap points: closed / half / full (velocity + position based).
- **Menu sheet** (`components/menuSheet.ts`): document, page, zoom and mode menus slide up, wrap their content (max 80%),
  show a back arrow + title for submenus and are dismissed by dragging down, tapping the backdrop, or Esc.

- **Toolbar overflow** (< 640px): Annotate keeps its core tools and moves the rest into a "⋯" menu; Shapes moves polygon / polyline and Forms moves select / listbox the same way (opens as a bottom sheet).
- **Dialogs** (print / protect / signature) are full-screen on mobile and a centered card on desktop.
- **Touch / notch:** `viewport-fit=cover` + safe-area padding; drawing, pan and marquee tools disable page scrolling while active; sheets don't scroll-chain into the page; Esc closes the drawer.

Both shells are created once and kept across `render()` calls, otherwise the slide transition could never run.

## Enabling / disabling features

Edit `DEFAULT_CONFIG` in `src/config.ts`, or set it from the page before the bundle loads:

```html
<script>
  window.PDF_VIEWER_CONFIG = {
    disabledCategories: ['print', 'security', 'open', 'close', 'annotation'],
    mobile: { menuSheet: true, sidebarDrawer: true, drawer: { initialSnap: 'half', resizable: true } },
  };
</script>
<script src="dist/app.js"></script>
```

Quick test without editing anything: `index.html#disable=print,security`.

Disabling a category removes every button, menu item, keyboard shortcut and panel that belongs to it (children included);
empty menus, section titles and stray dividers disappear with it.

| Category (alias) | What goes away |
| --- | --- |
| `document` | whole document menu · `document-open` (`open`) · `document-close` (`close`) · `document-print` (`print`) · `document-protect` / `security` · `document-export` (`export`) · `document-capture` (`screenshot`) · `document-fullscreen` |
| `mode-view` (`view`) | the View tab · `mode-annotate` · `mode-shapes` · `mode-insert` · `mode-form` · `mode-redact` |
| `annotation` | Annotate + Shapes modes and all markup / ink / text / shape tools · finer: `annotation-markup`, `annotation-ink`, `annotation-text`, `annotation-shape`, `annotation-comment` |
| `form` / `insert` / `redaction` | that mode and its tools (`insert-signature`, `insert-image`, `form-fill-mode`, ...) |
| `panel-sidebar` (`sidebar`) · `sidebar-thumbnails` · `sidebar-outline` | left sidebar and its tabs |
| `panel-search` (`search`) · `panel-comment` (`comments`) · `panel-annotation-style` · `panel-redaction` | right-hand panels (and Ctrl+F) |
| `comment-reply` (`replies`) · `comment-edit` · `comment-delete` | the "Add reply" field · entries in a comment's / reply's menu |
| `zoom` | zoom toolbar, zoom menu, Ctrl+wheel · finer: `zoom-in`, `zoom-out`, `zoom-level`, `zoom-fit-page`, `zoom-fit-width`, `zoom-marquee` |
| `page` | page menu · `spread`, `rotate`, `scroll`, `navigation` (the prev / next / page-number pill) |
| `tools` | pan + pointer · `history` (`undo`, `redo`) |
| `tab-bar` (`tabs`) | the document tab strip |

Mobile options: `mobile.breakpoint`, `mobile.sidebarDrawer` (false = inline sidebars), `mobile.menuSheet` (false = dropdowns),
`mobile.drawer.initialSnap` (`'half'` / `'full'`) and `mobile.drawer.resizable`.

### Document tab bar

`ui.tabBar` controls the strip of open documents: `'always'` (default), `'auto'` (only when two or more documents are open,
so single-book reading gets the full height) or `'never'`. Quick test: `index.html#tabs=auto`. `disabledCategories: ['tab-bar']`
is the same as `'never'`. With the strip hidden, documents are still opened / closed from the document menu.

### Comment replies

Every comment has a reply thread and an "Add reply" field (Enter or the send button). Replies have the same Edit / Delete menu as comments.
Unsent text survives re-renders. Selecting a comment focuses its reply field on desktop (not on touch devices, to avoid popping the keyboard).
