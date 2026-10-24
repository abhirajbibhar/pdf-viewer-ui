/** Labels + icons for every toolbar / menu command (English strings from the original). */
export interface Command {
  label: string;
  icon?: string;
  /** Default annotation colours used by the original for tool icons */
  primaryColor?: string;
  secondaryColor?: string;
}

const RED = '#E44234';
const YELLOW = '#FFCD45';

export const COMMANDS: Record<string, Command> = {
  // zoom
  'zoom:in': { label: 'Zoom In', icon: 'zoomIn' },
  'zoom:out': { label: 'Zoom Out', icon: 'zoomOut' },
  'zoom:fit-page': { label: 'Fit to Page', icon: 'fitToPage' },
  'zoom:fit-width': { label: 'Fit to Width', icon: 'fitToWidth' },
  'zoom:marquee': { label: 'Marquee Zoom', icon: 'zoomInArea' },
  'zoom:toggle-menu': { label: 'Zoom Menu', icon: 'chevronDown' },
  'zoom:toggle-menu-mobile': { label: 'Zoom Menu', icon: 'zoomIn' },
  // tools
  'pan:toggle': { label: 'Toggle Pan Mode', icon: 'hand' },
  'pointer:toggle': { label: 'Toggle Pointer Mode', icon: 'pointer' },
  'left-action-menu:overflow-menu': { label: 'More Options', icon: 'dots' },
  // document
  'document:menu': { label: 'Document Menu', icon: 'menu' },
  'document:open': { label: 'Open', icon: 'fileImport' },
  'document:close': { label: 'Close', icon: 'x' },
  'document:print': { label: 'Print', icon: 'print' },
  'document:protect': { label: 'Security', icon: 'lock' },
  'document:export': { label: 'Export', icon: 'download' },
  'document:capture': { label: 'Screenshot', icon: 'screenshot' },
  'document:fullscreen': { label: 'Fullscreen', icon: 'fullscreen' },
  // panels
  'panel:toggle-sidebar': { label: 'Sidebar', icon: 'sidebar' },
  'panel:toggle-search': { label: 'Search', icon: 'search' },
  'panel:toggle-comment': { label: 'Comment', icon: 'comment' },
  'panel:toggle-redaction': { label: 'Redaction Sidebar', icon: 'redactionSidebar' },
  'panel:toggle-annotation-style': { label: 'Annotation Style', icon: 'palette' },
  // page
  'page:settings': { label: 'Page Settings', icon: 'viewSettings' },
  'spread:none': { label: 'Single Page', icon: 'singlePage' },
  'spread:odd': { label: 'Two Page (Odd)', icon: 'doublePage' },
  'spread:even': { label: 'Two Page (Even)', icon: 'book2' },
  'rotate:clockwise': { label: 'Rotate Clockwise', icon: 'rotateClockwise' },
  'rotate:counter-clockwise': { label: 'Rotate Counter-Clockwise', icon: 'rotateCounterClockwise' },
  'scroll:vertical': { label: 'Vertical', icon: 'vertical' },
  'scroll:horizontal': { label: 'Horizontal', icon: 'horizontal' },
  'scroll:next-page': { label: 'Next Page', icon: 'chevronRight' },
  'scroll:previous-page': { label: 'Previous Page', icon: 'chevronLeft' },
  // modes
  'mode:view': { label: 'View' },
  'mode:annotate': { label: 'Annotate' },
  'mode:shapes': { label: 'Shapes' },
  'mode:insert': { label: 'Insert' },
  'mode:form': { label: 'Form' },
  'mode:redact': { label: 'Redact' },
  'tabs:overflow-menu': { label: 'More', icon: 'dots' },
  // annotation tools
  'annotation:add-highlight': { label: 'Highlight', icon: 'highlight', primaryColor: YELLOW },
  'annotation:add-underline': { label: 'Underline', icon: 'underline', primaryColor: RED },
  'annotation:add-strikeout': { label: 'Strikethrough', icon: 'strikethrough', primaryColor: RED },
  'annotation:add-squiggly': { label: 'Squiggly', icon: 'squiggly', primaryColor: RED },
  'annotation:add-insert-text': { label: 'Insert Text', icon: 'insertText', primaryColor: RED },
  'annotation:add-replace-text': { label: 'Replace Text', icon: 'replaceText', primaryColor: RED },
  'annotation:add-ink': { label: 'Ink', icon: 'pencilMarker', primaryColor: RED },
  'annotation:add-ink-highlighter': { label: 'Ink Highlighter', icon: 'inkHighlighter', primaryColor: YELLOW },
  'annotation:add-text': { label: 'Text', icon: 'freeText', primaryColor: RED },
  'annotation:add-callout': { label: 'Callout', icon: 'callout', primaryColor: RED, secondaryColor: 'transparent' },
  'annotation:add-comment': { label: 'Comment', icon: 'message', primaryColor: YELLOW },
  'annotation:add-rectangle': { label: 'Rectangle', icon: 'square', primaryColor: RED, secondaryColor: 'transparent' },
  'annotation:add-circle': { label: 'Circle', icon: 'circle', primaryColor: RED, secondaryColor: 'transparent' },
  'annotation:add-line': { label: 'Line', icon: 'line', primaryColor: RED },
  'annotation:add-arrow': { label: 'Arrow', icon: 'lineArrow', primaryColor: RED },
  'annotation:add-polygon': { label: 'Polygon', icon: 'polygon', primaryColor: RED, secondaryColor: 'transparent' },
  'annotation:add-polyline': { label: 'Polyline', icon: 'zigzag', primaryColor: RED },
  'annotation:overflow-tools': { label: 'More Tools', icon: 'dots' },
  'annotation:overflow-shapes': { label: 'More Shapes', icon: 'dots' },
  'form:overflow-tools': { label: 'More Form Tools', icon: 'dots' },
  // forms
  'form:add-textfield': { label: 'Text Field', icon: 'formTextfield' },
  'form:add-checkbox': { label: 'Checkbox', icon: 'formCheckbox' },
  'form:add-radio': { label: 'Radio Button', icon: 'formRadio' },
  'form:add-select': { label: 'Dropdown', icon: 'formSelect' },
  'form:add-listbox': { label: 'List Box', icon: 'formListbox' },
  'form:toggle-fill-mode': { label: 'Toggle Fill Mode', icon: 'widgetEdit' },
  // insert
  'insert:add-rubber-stamp': { label: 'Rubber Stamp', icon: 'rubberStamp' },
  'insert:add-signature': { label: 'Signature', icon: 'signature' },
  'insert:add-attachment': { label: 'Attachment', icon: 'paperclip' },
  'insert:add-image': { label: 'Image', icon: 'photo' },
  // redaction
  'redaction:redact': { label: 'Redact', icon: 'redactArea' },
  // history
  'history:undo': { label: 'Undo', icon: 'arrowBackUp' },
  'history:redo': { label: 'Redo', icon: 'arrowForwardUp' },
};

export function cmd(id: string): Command {
  return COMMANDS[id] ?? { label: id };
}
