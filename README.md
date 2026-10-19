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
css/theme.css        colour tokens
css/viewer.css       styles
src/state.ts         central state + history
src/commands.ts      command registry (execute / isActive / isDisabled)
src/actions.ts       click / input / keyboard handlers
src/interactions.ts  pointer drawing, pan, marquee, scroll tracking
src/annotations.ts   annotation model + SVG/HTML layer renderer
src/content.ts       generated page text, outline, search
src/components/      tabBar, toolbar, menus, sidebars, viewport, modals, toast, tooltip
src/icons.ts         SVG icons extracted from the original components
```
