"use strict";
(() => {
  // src/dom.ts
  function h(tag, attrs = null, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === void 0 || value === null || value === false) continue;
        el.setAttribute(key, value === true ? "" : String(value));
      }
    }
    append(el, children);
    return el;
  }
  function append(parent, children) {
    for (const child of children) {
      if (child === null || child === void 0 || child === false) continue;
      if (Array.isArray(child)) append(parent, child);
      else parent.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
  }
  function fromHTML(markup) {
    const tpl = document.createElement("template");
    tpl.innerHTML = markup.trim();
    return tpl.content.firstElementChild;
  }

  // src/content.ts
  var SENTENCES = [
    "This document describes the main features of the viewer and how to get the most out of them.",
    "Use the toolbar above the page to switch between viewing, annotating and filling in forms.",
    "Each page is rendered on demand, so even a large document opens quickly.",
    "Zoom in to read fine print, or fit the page to the width of your window.",
    "Highlights, underlines and comments are stored as annotations on the page.",
    "Open the sidebar to browse thumbnails or jump to a chapter from the outline.",
    "The search panel lists every match and lets you step through the results one by one.",
    "Several documents can be open at once, each in its own tab.",
    "Shapes such as rectangles, circles and arrows help you call attention to important areas.",
    "Form fields can be added to a page and then filled in by anyone who opens the document.",
    "Sensitive text can be marked for redaction and removed permanently when you are ready.",
    "Pan mode lets you drag the page around, while pointer mode lets you select text.",
    "Changes can be undone and redone at any time while you are working on the document.",
    "Print the whole document or just a range of pages, with or without annotations.",
    "Protect a document with a password and choose which actions other readers may perform.",
    "A clear structure makes a long document easier to scan, search and navigate.",
    "Reading comments from colleagues is simple because they are grouped by page.",
    "Every part of the interface follows the theme, so light and dark modes both look right."
  ];
  var CHAPTERS = [
    "Getting Started",
    "Navigation",
    "Zoom and Layout",
    "Annotations",
    "Shapes and Drawing",
    "Forms",
    "Signatures and Stamps",
    "Redaction",
    "Printing and Security",
    "Tips and Shortcuts",
    "Appendix"
  ];
  function hashStr(s2) {
    let x = 7;
    for (let i = 0; i < s2.length; i++) x = Math.imul(x, 31) + s2.charCodeAt(i) >>> 0;
    return x;
  }
  function rng(seed) {
    let s2 = seed >>> 0 || 1;
    return () => {
      s2 = Math.imul(s2, 1664525) + 1013904223 >>> 0;
      return s2 / 4294967296;
    };
  }
  function prettyTitle(name) {
    const base = name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Untitled";
  }
  function buildPages(seed, n, name) {
    const r = rng(seed);
    const pages = [];
    for (let i = 0; i < n; i++) {
      const count = i === 0 ? 2 : 3 + Math.floor(r() * 3);
      const paras = [];
      for (let p = 0; p < count; p++) {
        const k = 3 + Math.floor(r() * 2);
        const used = /* @__PURE__ */ new Set();
        const parts = [];
        while (parts.length < k) {
          const idx = Math.floor(r() * SENTENCES.length);
          if (!used.has(idx)) {
            used.add(idx);
            parts.push(SENTENCES[idx]);
          }
        }
        paras.push(parts.join(" "));
      }
      pages.push({
        heading: i === 0 ? prettyTitle(name) : `${i}. ${CHAPTERS[(i - 1) % CHAPTERS.length]}`,
        sub: i === 0 ? "Version 1.0 \xB7 October 2026" : void 0,
        paras,
        fig: i === 0 ? 1 : r() < 0.35 ? 2 : 0
      });
    }
    return pages;
  }
  function buildOutline(pages) {
    var _a;
    const out = [{ title: "Cover", page: 1 }];
    let parent = null;
    for (let i = 1; i < pages.length; i++) {
      const node = { title: pages[i].heading, page: i + 1 };
      if ((i - 1) % 3 === 0) {
        parent = node;
        out.push(node);
      } else if (parent) ((_a = parent.children) != null ? _a : parent.children = []).push(node);
    }
    return out;
  }
  function findHits(pages, q, matchCase, wholeWord) {
    if (!q.trim()) return [];
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(wholeWord ? `\\b${esc}\\b` : esc, matchCase ? "g" : "gi");
    const hits = [];
    pages.forEach(
      (pg, pi) => pg.paras.forEach((text, ki) => {
        re.lastIndex = 0;
        let m;
        while (m = re.exec(text)) {
          if (!m[0].length) {
            re.lastIndex++;
            continue;
          }
          hits.push({
            page: pi + 1,
            para: ki,
            start: m.index,
            len: m[0].length,
            before: text.slice(Math.max(0, m.index - 28), m.index),
            match: m[0],
            after: text.slice(m.index + m[0].length, m.index + m[0].length + 32)
          });
        }
      })
    );
    return hits;
  }

  // src/state.ts
  var ZOOMS = [25, 50, 100, 125, 150, 200, 400, 800, 1600];
  var BASE_PAGE_W = 640;
  var PAGE_RATIO = 1.414;
  var S = {
    docs: [],
    active: null,
    mode: "view",
    tool: null,
    // active annotation / form / insert tool (command id)
    pointerTool: "pointer",
    leftOpen: false,
    leftTab: "thumbnails",
    right: null,
    menu: null,
    modal: null,
    spread: "none",
    layout: "vertical",
    rotation: 0,
    search: { q: "", matchCase: false, wholeWord: false, active: 0 },
    selected: null,
    editingComment: null,
    commentMenu: null,
    replyDraft: {},
    // unsent reply text per comment id (survives re-renders)
    outlineOpen: {},
    fillMode: false,
    sigText: "",
    stampIdx: 0,
    print: { range: "all", spec: "", annotations: true, busy: false },
    protect: { openPw: true, perms: false },
    defaults: {},
    focusKey: null,
    scrollHit: false,
    pending: null
  };
  var renderFn = () => {
  };
  var setRenderer = (f) => {
    renderFn = f;
  };
  function update(fn) {
    fn == null ? void 0 : fn();
    renderFn();
  }
  var counter = 0;
  var uid = (p = "id") => `${p}${++counter}`;
  var doc = () => {
    var _a;
    return (_a = S.docs.find((d) => d.id === S.active)) != null ? _a : null;
  };
  function newDoc(name, pages) {
    const seed = hashStr(name);
    const n = pages != null ? pages : 8 + seed % 7;
    return { id: uid("doc"), name, pages: n, content: buildPages(seed, n, name), anns: [], undo: [], redo: [], zoom: 100, page: 1, comments: [] };
  }
  function today() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function pushHistory(d) {
    d.undo.push(JSON.stringify(d.anns));
    if (d.undo.length > 60) d.undo.shift();
    d.redo = [];
  }
  function syncComments(d) {
    d.comments = d.comments.filter((c2) => !c2.annId || d.anns.some((a) => a.id === c2.annId));
  }
  function undo(d) {
    const prev = d.undo.pop();
    if (prev === void 0) return;
    d.redo.push(JSON.stringify(d.anns));
    d.anns = JSON.parse(prev);
    syncComments(d);
    if (S.selected && !d.anns.some((a) => a.id === S.selected)) S.selected = null;
  }
  function redo(d) {
    const next = d.redo.pop();
    if (next === void 0) return;
    d.undo.push(JSON.stringify(d.anns));
    d.anns = JSON.parse(next);
    syncComments(d);
  }
  function removeAnn(d, id) {
    pushHistory(d);
    d.anns = d.anns.filter((a) => a.id !== id);
    syncComments(d);
    if (S.selected === id) S.selected = null;
  }
  function initDocs() {
    const a = newDoc("ebook.pdf", 12);
    a.comments = [
      {
        id: uid("c"),
        page: 1,
        author: "Alex",
        date: "Oct 19, 2026",
        text: "Can we rephrase this sentence?",
        color: "bg-blue",
        replies: [{ id: uid("r"), author: "Priya", date: "Oct 19, 2026", text: "Agreed \u2013 I will tighten it up.", color: "bg-purple" }]
      },
      { id: uid("c"), page: 1, author: "Priya", date: "Oct 18, 2026", text: "Looks good to me.", color: "bg-purple" },
      { id: uid("c"), page: 3, author: "Sam", date: "Oct 17, 2026", text: "Please double-check this figure.", color: "bg-green" }
    ];
    S.docs = [a, newDoc("demo.pdf", 6)];
    S.active = a.id;
  }

  // src/icons.ts
  var ICONS = {
    download: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /> <path d="M7 11l5 5l5 -5" /> <path d="M12 4l0 12" />' },
    menu: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 8l16 0" /> <path d="M4 16l16 0" />' },
    fullscreen: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 8v-2a2 2 0 0 1 2 -2h2" /> <path d="M4 16v2a2 2 0 0 0 2 2h2" /> <path d="M16 4h2a2 2 0 0 1 2 2v2" /> <path d="M16 20h2a2 2 0 0 0 2 -2v-2" />' },
    fullscreenExit: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 8v-2c0 -.551 .223 -1.05 .584 -1.412" /> <path d="M4 16v2a2 2 0 0 0 2 2h2" /> <path d="M16 4h2a2 2 0 0 1 2 2v2" /> <path d="M16 20h2c.545 0 1.04 -.218 1.4 -.572" /> <path d="M3 3l18 18" />' },
    save: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /> <path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M14 4l0 4l-6 0l0 -4" />' },
    print: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" /> <path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4" /> <path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z" />' },
    settings: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /> <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />' },
    viewSettings: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M12 10.5v1.5" /> <path d="M12 16v1.5" /> <path d="M15.031 12.25l-1.299 .75" /> <path d="M10.268 15l-1.3 .75" /> <path d="M15 15.803l-1.285 -.773" /> <path d="M10.285 12.97l-1.285 -.773" /> <path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />' },
    rotateClockwise: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5" />' },
    rotateCounterClockwise: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5" />' },
    singlePage: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M5 3m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z" />' },
    doublePage: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 3m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1zm9 -1v18" />' },
    zoomIn: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /> <path d="M9 12h6" /> <path d="M12 9v6" />' },
    zoomOut: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M9 12l6 0" />' },
    fitToWidth: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 12v-6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6" /> <path d="M10 18h-7" /> <path d="M21 18h-7" /> <path d="M6 15l-3 3l3 3" /> <path d="M18 15l3 3l-3 3" />' },
    fitToPage: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12 20h-6a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h6" /> <path d="M18 14v7" /> <path d="M18 3v7" /> <path d="M15 18l3 3l3 -3" /> <path d="M15 6l3 -3l3 3" />' },
    chevronRight: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M9 6l6 6l-6 6" />' },
    chevronLeft: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M15 6l-6 6l6 6" />' },
    chevronDown: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M6 9l6 6l6 -6" />' },
    search: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /> <path d="M21 21l-6 -6" />' },
    callout: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M20 6v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1" /> <path fill="none" d="M17 11v6h-9" /> <path fill="none" d="M8 15l-2 2l2 2" />' },
    comment: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12 11v.01" /> <path d="M8 11v.01" /> <path d="M16 11v.01" /> <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" />' },
    sidebar: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 18v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /> <path d="M10 18v-12a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z" />' },
    send: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12 19l9 2l-9 -18l-9 18l9 -2z" /> <path d="M12 19v-8" />' },
    dots: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' },
    vertical: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M8 7l4 -4l4 4" /> <path d="M8 17l4 4l4 -4" /> <path d="M12 3l0 18" />' },
    horizontal: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M7 8l-4 4l4 4" /> <path d="M17 8l4 4l-4 4" /> <path d="M3 12l18 0" />' },
    book: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /> <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /> <path d="M3 6l0 13" /> <path d="M12 6l0 13" /> <path d="M21 6l0 13" />' },
    book2: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M19 4v16h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12z" /> <path d="M19 16h-12a2 2 0 0 0 -2 2" /> <path d="M9 8h6" />' },
    squares: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M8 10a2 2 0 0 1 2 -2h9a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-9a2 2 0 0 1 -2 -2z" /> <path d="M16 8v-3a2 2 0 0 0 -2 -2h-9a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h3" />' },
    listTree: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M9 6h11" /> <path d="M12 12h8" /> <path d="M15 18h5" /> <path d="M5 6v.01" /> <path d="M8 12v.01" /> <path d="M11 18v.01" />' },
    paperclip: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" />' },
    rubberStamp: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M21 17.85h-18c0 -4.05 1.421 -4.05 3.79 -4.05c5.21 0 1.21 -4.59 1.21 -6.8a4 4 0 1 1 8 0c0 2.21 -4 6.8 1.21 6.8c2.369 0 3.79 0 3.79 4.05" /> <path d="M5 21h14" />' },
    rubberStampPlus: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M21 17.85h-18c0 -4.05 1.421 -4.05 3.79 -4.05c5.21 0 1.21 -4.59 1.21 -6.8a4 4 0 0 1 4.9 -4.1" /> <path d="M16 10c0 1.2 -4 3.8 1.21 3.8c2.369 0 3.79 0 3.79 4.05" /> <path d="M5 21h14" /> <path d="M16 5h6" /> <path d="M19 2v6" />' },
    copy: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /> <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />' },
    underline: { stroke: null, strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 20h16" stroke="__P__" /> <path d="M8 16v-8a4 4 0 1 1 8 0v8" stroke="currentColor" /> <path d="M8 10h8" stroke="currentColor" />' },
    squiggly: { stroke: null, strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M8 16v-8a4 4 0 1 1 8 0v8" stroke="currentColor" /> <path d="M8 10h8" stroke="currentColor" /> <path d="M4 20c1.5 -1.5 3.5 -1.5 5 0s3.5 1.5 5 0 3.5 -1.5 5 0" stroke="__P__" />' },
    strikethrough: { stroke: null, strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M8 16v-8a4 4 0 1 1 8 0v8" stroke="currentColor" /> <path d="M4 10h16" stroke="__P__" />' },
    highlight: { stroke: null, strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <rect x="2" y="6" width="20" height="16" rx="2" fill="__P__" stroke="none" /> <path d="M8 16v-8a4 4 0 1 1 8 0v8" stroke="currentColor" /> <path d="M8 10h8" stroke="currentColor" />' },
    palette: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" /> <path d="M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' },
    x: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M18 6l-12 12" /> <path d="M6 6l12 12" />' },
    fileImport: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M5 13v-8a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5.5m-9.5 -2h7m-3 -3l3 3l-3 3" />' },
    hand: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5" /> <path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" /> <path d="M14 5.5a1.5 1.5 0 0 1 3 0v6.5" /> <path d="M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" />' },
    zoomInArea: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M15 13v4" /> <path d="M13 15h4" /> <path d="M15 15m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /> <path d="M22 22l-3 -3" /> <path d="M6 18h-1a2 2 0 0 1 -2 -2v-1" /> <path d="M3 11v-1" /> <path d="M3 6v-1a2 2 0 0 1 2 -2h1" /> <path d="M10 3h1" /> <path d="M15 3h1a2 2 0 0 1 2 2v1" />' },
    screenshot: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M7 19a2 2 0 0 1 -2 -2" /> <path d="M5 13v-2" /> <path d="M5 7a2 2 0 0 1 2 -2" /> <path d="M11 5h2" /> <path d="M17 5a2 2 0 0 1 2 2" /> <path d="M19 11v2" /> <path d="M19 17v4" /> <path d="M21 19h-4" /> <path d="M13 19h-2" />' },
    arrowBackUp: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M9 14l-4 -4l4 -4" /> <path d="M5 10h11a4 4 0 1 1 0 8h-1" />' },
    arrowForwardUp: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M15 14l4 -4l-4 -4" /> <path d="M19 10h-11a4 4 0 1 0 0 8h1" />' },
    trash: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 7l16 0" /> <path d="M10 11l0 6" /> <path d="M14 11l0 6" /> <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /> <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />' },
    deviceFloppy: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /> <path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M14 4l0 4l-6 0l0 -4" />' },
    pencilMarker: { stroke: null, strokeWidth: null, body: '<path d="m9.109 16.275 8.856-8.097c.812-.743.87-2.014.127-2.826s-2.014-.869-2.826-.127L6.41 13.322l-.127 2.826zM13.79 6.575l2.7 2.952" stroke="currentColor" /> <path stroke="__P__" d="M19.375 20.125c.569.063-4.05-.562-6.412-.437s-4.759 1.229-6.857 1.625c-1.764.687-3.404-.938-1.981-2.5" />' },
    circle: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />' },
    square: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" />' },
    line: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M20 4l-16 16" />' },
    lineArrow: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M20 4l-16 16" /> <path d="M16 3h5v5" />' },
    polygon: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M13.163 2.168l8.021 5.828c.694 .504 .984 1.397 .719 2.212l-3.064 9.43a1.978 1.978 0 0 1 -1.881 1.367h-9.916a1.978 1.978 0 0 1 -1.881 -1.367l-3.064 -9.43a1.978 1.978 0 0 1 .719 -2.212l8.021 -5.828a1.978 1.978 0 0 1 2.326 0z" />' },
    zigzag: { stroke: "__P__", strokeWidth: null, body: '<path d="M12 2.4L21.36 11.76L2.64 12.24L12 21.6" />' },
    text: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M6.5 15.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0" /> <path d="M14 19v-10.5a3.5 3.5 0 0 1 7 0v10.5" /> <path d="M14 13h7" /> <path d="M10 12v7" />' },
    italic: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M11 5l6 0" /> <path d="M7 19l6 0" /> <path d="M14 5l-4 14" />' },
    bold: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /> <path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" />' },
    alignLeft: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 6l16 0" /> <path d="M4 12l10 0" /> <path d="M4 18l14 0" />' },
    alignCenter: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 6l16 0" /> <path d="M8 12l8 0" /> <path d="M6 18l12 0" />' },
    alignRight: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 6l16 0" /> <path d="M10 12l10 0" /> <path d="M6 18l14 0" />' },
    alignTop: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 19v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /> <path d="M11 13h2" /> <path d="M9 10h6" /> <path d="M10 7h4" />' },
    alignMiddle: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 19v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /> <path d="M11 15h2" /> <path d="M9 12h6" /> <path d="M10 9h4" />' },
    alignBottom: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 19v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /> <path d="M11 17h2" /> <path d="M9 14h6" /> <path d="M10 11h4" />' },
    photo: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M15 8h.01" /> <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" /> <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /> <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />' },
    pointer: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M7.904 17.563a1.2 1.2 0 0 0 2.228 .308l2.09 -3.093l4.907 4.907a1.067 1.067 0 0 0 1.509 0l1.047 -1.047a1.067 1.067 0 0 0 0 -1.509l-4.907 -4.907l3.113 -2.09a1.2 1.2 0 0 0 -.309 -2.228l-13.582 -3.904l3.904 13.563z" />' },
    redact: { stroke: "currentColor", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M7 4h10" /> <path d="M12 4v8" /> <defs> <clipPath id="stripeClip"> <rect x="2" y="12" width="20" height="10" rx="2" /> </clipPath> </defs> <rect x="2" y="12" width="20" height="10" rx="2" fill="none" stroke="__P__" /> <g clip-path="url(#stripeClip)" stroke="__S__"> <path d="M-7 24l12 -12" /> <path d="M-3 24l12 -12" /> <path d="M1 24l12 -12" /> <path d="M5 24l12 -12" /> <path d="M9 24l12 -12" /> <path d="M13 24l12 -12" /> <path d="M17 24l12 -12" /> <path d="M21 24l12 -12" /> <path d="M25 24l12 -12" /> </g>' },
    redactArea: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M6 20h-1a2 2 0 0 1 -2 -2v-1" /> <path d="M3 13v-3" /> <path d="M3 6v-1a2 2 0 0 1 2 -2h1" /> <path d="M10 3h3" /> <path d="M17 3h1a2 2 0 0 1 2 2v1" /> <defs> <clipPath id="redactClip"> <rect x="10" y="10" width="12" height="12" rx="2" /> </clipPath> </defs> <rect x="10" y="10" width="12" height="12" rx="2" fill="none" /> <g clip-path="url(#redactClip)" stroke="__S__"> <path d="M-2 24l14 -14" /> <path d="M2 24l14 -14" /> <path d="M6 24l14 -14" /> <path d="M10 24l15 -15" /> <path d="M14 24l15 -15" /> <path d="M18 24l15 -15" /> </g>' },
    redactCombined: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M6 20h-1a2 2 0 0 1 -2 -2v-1" /> <path d="M3 13v-3" /> <path d="M20 13v-3" /> <path d="M3 6v-1a2 2 0 0 1 2 -2h1" /> <path d="M10 3h3" /> <path d="M17 3h1a2 2 0 0 1 2 2v1" /> <path d="M8 8h8" /> <path d="M12 8v7" /> <defs> <clipPath id="redactCombinedClip"> <rect x="10" y="18" width="13" height="6" rx="2" /> </clipPath> </defs> <rect x="10" y="17" width="13" height="6" rx="2" fill="none" /> <g clip-path="url(#redactCombinedClip)" stroke="__S__"> <path d="M6 19l12 -12" /> <path d="M6 23l12 -12" /> <path d="M10 23l12 -12" /> <path d="M14 27l12 -12" /> <path d="M14 23l12 -12" /> </g>' },
    check: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M5 12l5 5l10 -10" />' },
    file: { stroke: "__P__", strokeWidth: null, body: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /> <polyline points="14 2 14 8 20 8" />' },
    plus: { stroke: "__P__", strokeWidth: null, body: '<line x1="12" y1="5" x2="12" y2="19" /> <line x1="5" y1="12" x2="19" y2="12" />' },
    lock: { stroke: "currentColor", strokeWidth: 2, body: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 10 0v4" />' },
    unlock: { stroke: "currentColor", strokeWidth: 2, body: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 9.9-1" />' },
    alertTriangle: { stroke: "currentColor", strokeWidth: 2, body: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /> <line x1="12" y1="9" x2="12" y2="13" /> <line x1="12" y1="17" x2="12.01" y2="17" />' },
    eye: { stroke: "currentColor", strokeWidth: 2, body: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /> <circle cx="12" cy="12" r="3" />' },
    info: { stroke: "currentColor", strokeWidth: 2, body: '<circle cx="12" cy="12" r="10" /> <line x1="12" y1="16" x2="12" y2="12" /> <line x1="12" y1="8" x2="12.01" y2="8" />' },
    link: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M9 15l6 -6" /> <path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /> <path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" />' },
    linkOff: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M9 15l3 -3m2 -2l1 -1" /> <path d="M11 6l.463 -.536a5 5 0 0 1 7.072 7.071l-.534 .464" /> <path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /> <path d="M3 3l18 18" />' },
    externalLink: { stroke: "currentColor", strokeWidth: 2, body: '<path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /> <path d="M11 13l9 -9" /> <path d="M15 4h5v5" />' },
    marqueeSelect: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M17 20h6" /> <path d="M20 17v6" /> <path d="M4 13v-2" /> <path d="M4 6v-1a1 1 0 0 1 1 -1h1" /> <path d="M6 20h-1a1 1 0 0 1 -1 -1v-1" /> <path d="M11 4h2" /> <path d="M11 20h2" /> <path d="M18 4h1a1 1 0 0 1 1 1v1" /> <path d="M20 11v2" />' },
    group: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M17 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M3 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M17 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M5 7v10" /> <path d="M19 7v10" /> <path d="M7 5h10" /> <path d="M7 19h10" /> <path d="M8 8H12.8V11.2H16V16H11.2V12.8H8V8Z" />' },
    ungroup: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <rect x="4" y="4" width="7" height="7" rx="1" /> <rect x="13" y="13" width="7" height="7" rx="1" />' },
    redactionSidebar: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /> <path d="M15 4v16" /> <path d="M7 8h5" /> <path d="M7 11h5" /> <path d="M7 14h4" />' },
    freeText: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M4 7v-2h12v2" /> <path d="M10 5v14" /> <path d="M12 19h-4" /> <path d="M15 13v-1h6v1" /> <path d="M18 12v7" /> <path d="M17 19h2" />' },
    insertText: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 7v-2h12v2" /> <path d="M9 5v14" /> <path d="M7 19h4" /> <path d="M18 15l2 2h-5" /> <path d="M18 19l2 -2" />' },
    replaceText: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 7v-2h12v2" /> <path d="M9 5v14" /> <path d="M7 19h4" /> <g transform="translate(-1, -3) rotate(180 19 18)"> <path d="M20 14l2 2h-3" /> <path d="M20 18l2 -2" /> <path d="M19 16a3 3 0 1 0 2 5.236" /> </g>' },
    message: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M8 9h8" stroke="currentColor" /> <path d="M8 13h6" stroke="currentColor" /> <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12" />' },
    inkHighlighter: { stroke: null, strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path stroke="currentColor" d="M3 19h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /> <path stroke="currentColor" d="M12.5 5.5l4 4" /> <path stroke="currentColor" d="M4.5 13.5l4 4" /> <path stroke="__P__" fill="__P__" d="M21 15v4h-8l4 -4l4 0" />' },
    formCheckbox: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" /> <path d="M9 12l2 2l4 -4" />' },
    formRadio: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M9 12a2 2 0 1 0 6 0a2 2 0 1 0 -6 0" fill="currentColor" /> <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />' },
    formSelect: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" /> <path d="M9 11l3 3l3 -3" />' },
    formListbox: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" /> <path d="M11 8h6" /> <path d="M11 12h6" /> <path d="M11 16h6" /> <path d="M7 8l0 .01" /> <path d="M7 12l0 .01" /> <path d="M7 16l0 .01" />' },
    formTextfield: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M12 3a3 3 0 0 0 -3 3v12a3 3 0 0 0 3 3" /> <path d="M6 3a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3" /> <path d="M13 7h7a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-7" /> <path d="M5 7h-1a1 1 0 0 0 -1 1v8a1 1 0 0 0 1 1h1" /> <path d="M17 12h.01" /> <path d="M13 12h.01" />' },
    widgetEdit: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /> <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415" /> <path d="M16 5l3 3" />' },
    signature: { stroke: "__P__", strokeWidth: null, body: '<path stroke="none" d="M0 0h24v24H0z" fill="none" /> <path d="M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.333 2.667 1.333 4 3 4c.53 0 2.639 -2 3 -2c.517 0 1.517 .667 3 2" />' }
  };

  // src/icon.ts
  function icon(name, opts = {}) {
    var _a;
    const def = ICONS[name];
    if (!def) {
      console.warn(`Icon not found: ${name}`);
      return document.createElement("span");
    }
    const { size = 24, strokeWidth = (_a = def.strokeWidth) != null ? _a : 2, primaryColor, secondaryColor, className } = opts;
    const P = primaryColor != null ? primaryColor : "currentColor";
    const S2 = secondaryColor != null ? secondaryColor : "currentColor";
    const body2 = def.body.replace(/__P__/g, P).replace(/__S__/g, S2);
    const stroke2 = def.stroke === null ? "" : `stroke="${def.stroke.replace("__P__", P)}"`;
    const cls = className ? `class="${className}"` : "";
    return fromHTML(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ${stroke2} stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${cls} aria-hidden="true">${body2}</svg>`
    );
  }

  // src/annotations.ts
  var RED = "#E44234";
  var YEL = "#FFCD45";
  var st = (color, opacity = 1, width = 2, blend = "normal") => ({ color, opacity, width, blend });
  var TOOLS = {
    "annotation:add-highlight": { type: "highlight", drag: true, style: st(YEL, 0.5, 2, "multiply") },
    "annotation:add-underline": { type: "underline", drag: true, style: st(RED) },
    "annotation:add-strikeout": { type: "strikeout", drag: true, style: st(RED) },
    "annotation:add-squiggly": { type: "squiggly", drag: true, style: st(RED) },
    "annotation:add-replace-text": { type: "replaceText", drag: true, style: st(RED) },
    "annotation:add-ink": { type: "ink", drag: true, style: st(RED, 1, 3) },
    "annotation:add-ink-highlighter": { type: "inkhl", drag: true, style: st(YEL, 0.45, 14, "multiply") },
    "annotation:add-text": { type: "text", drag: false, style: st(RED) },
    "annotation:add-insert-text": { type: "insertText", drag: false, style: st(RED) },
    "annotation:add-comment": { type: "comment", drag: false, style: st(YEL) },
    "annotation:add-callout": { type: "callout", drag: false, style: st(RED, 1, 2) },
    "annotation:add-rectangle": { type: "rect", drag: true, style: st(RED) },
    "annotation:add-circle": { type: "circle", drag: true, style: st(RED) },
    "annotation:add-line": { type: "line", drag: true, style: st(RED) },
    "annotation:add-arrow": { type: "arrow", drag: true, style: st(RED) },
    "annotation:add-polygon": { type: "polygon", drag: true, style: st(RED) },
    "annotation:add-polyline": { type: "polyline", drag: true, style: st(RED) },
    "form:add-textfield": { type: "field", kind: "textfield", drag: true, style: st("#3B82F6") },
    "form:add-checkbox": { type: "field", kind: "checkbox", drag: false, style: st("#3B82F6") },
    "form:add-radio": { type: "field", kind: "radio", drag: false, style: st("#3B82F6") },
    "form:add-select": { type: "field", kind: "select", drag: true, style: st("#3B82F6") },
    "form:add-listbox": { type: "field", kind: "listbox", drag: true, style: st("#3B82F6") },
    "insert:add-rubber-stamp": { type: "stamp", drag: false, style: st(RED) },
    "insert:add-signature": { type: "signature", drag: false, style: st("#1D4ED8") },
    "insert:add-attachment": { type: "attachment", drag: false, style: st("#6B7280") },
    "insert:add-image": { type: "image", drag: false, style: st("#6B7280") },
    "redaction:redact": { type: "redact", drag: true, style: st(RED) }
  };
  var STAMPS = ["APPROVED", "DRAFT", "CONFIDENTIAL", "REVIEWED"];
  var TYPE_LABEL = {
    highlight: "Highlight",
    underline: "Underline",
    strikeout: "Strikethrough",
    squiggly: "Squiggly",
    replaceText: "Replace Text",
    ink: "Ink",
    inkhl: "Ink Highlighter",
    text: "Text",
    insertText: "Insert Text",
    comment: "Comment",
    callout: "Callout",
    rect: "Rectangle",
    circle: "Circle",
    line: "Line",
    arrow: "Arrow",
    polygon: "Polygon",
    polyline: "Polyline",
    field: "Form Field",
    stamp: "Stamp",
    signature: "Signature",
    attachment: "Attachment",
    image: "Image",
    redact: "Redaction"
  };
  function toolStyle(id) {
    var _a;
    const t = TOOLS[id];
    return (_a = S.defaults[t.type]) != null ? _a : t.style;
  }
  function defaultFor(type) {
    var _a, _b;
    const t = Object.values(TOOLS).find((x) => x.type === type);
    return (_b = (_a = S.defaults[type]) != null ? _a : t == null ? void 0 : t.style) != null ? _b : st(RED);
  }
  function bboxOf(pts) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  var NS = "http://www.w3.org/2000/svg";
  var VW = 1e3;
  var VH = 1414;
  function s(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }
  var stroke = (a, extra = {}) => ({
    fill: "none",
    stroke: a.color,
    "stroke-width": a.width,
    "stroke-opacity": a.opacity,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "vector-effect": "non-scaling-stroke",
    ...extra
  });
  function zigzag(x, y, w, amp, step) {
    let d = `M${x},${y}`;
    let up = true;
    for (let px = x + step; px < x + w + step; px += step) {
      d += ` L${Math.min(px, x + w)},${y + (up ? -amp : amp)}`;
      up = !up;
    }
    return d;
  }
  function svgShape(a) {
    const X = a.x * VW, Y = a.y * VH, W = a.w * VW, H = a.h * VH;
    const P = (p) => `${p[0] * VW},${p[1] * VH}`;
    switch (a.type) {
      case "highlight":
        return [s("rect", { x: X, y: Y, width: W, height: H, fill: a.color, "fill-opacity": a.opacity, style: `mix-blend-mode:${a.blend}` })];
      case "underline":
        return [s("line", { x1: X, y1: Y + H, x2: X + W, y2: Y + H, ...stroke(a) })];
      case "strikeout":
        return [s("line", { x1: X, y1: Y + H / 2, x2: X + W, y2: Y + H / 2, ...stroke(a) })];
      case "replaceText":
        return [s("line", { x1: X, y1: Y + H / 2, x2: X + W, y2: Y + H / 2, ...stroke(a) }), s("path", { d: `M${X + W - 6},${Y - 8} l6,-8 l6,8`, ...stroke(a) })];
      case "squiggly":
        return [s("path", { d: zigzag(X, Y + H, W, 3, 5), ...stroke(a) })];
      case "rect":
        return [s("rect", { x: X, y: Y, width: W, height: H, ...stroke(a) })];
      case "circle":
        return [s("ellipse", { cx: X + W / 2, cy: Y + H / 2, rx: W / 2, ry: H / 2, ...stroke(a) })];
      case "line":
        return [s("line", { x1: a.pts[0][0] * VW, y1: a.pts[0][1] * VH, x2: a.pts[1][0] * VW, y2: a.pts[1][1] * VH, ...stroke(a) })];
      case "arrow": {
        const [p, q] = a.pts;
        const x1 = p[0] * VW, y1 = p[1] * VH, x2 = q[0] * VW, y2 = q[1] * VH;
        const ang = Math.atan2(y2 - y1, x2 - x1), L = 20;
        const hx = (t) => x2 - L * Math.cos(ang + t), hy = (t) => y2 - L * Math.sin(ang + t);
        return [
          s("line", { x1, y1, x2, y2, ...stroke(a) }),
          s("path", { d: `M${hx(0.5)},${hy(0.5)} L${x2},${y2} L${hx(-0.5)},${hy(-0.5)}`, ...stroke(a) })
        ];
      }
      case "polygon": {
        const cx = X + W / 2, cy = Y + H / 2;
        const pts = [0, 1, 2, 3, 4].map((i) => {
          const t = -Math.PI / 2 + i * 2 * Math.PI / 5;
          return `${cx + W / 2 * Math.cos(t)},${cy + H / 2 * Math.sin(t)}`;
        });
        return [s("polygon", { points: pts.join(" "), ...stroke(a) })];
      }
      case "polyline":
        return [s("polyline", { points: [[0, 1], [0.3, 0], [0.6, 1], [1, 0]].map(([u, v]) => `${X + u * W},${Y + v * H}`).join(" "), ...stroke(a) })];
      case "ink":
      case "inkhl":
        return [s("polyline", { points: a.pts.map(P).join(" "), ...stroke(a, a.type === "inkhl" ? { style: `mix-blend-mode:${a.blend}` } : {}) })];
      case "redact":
        return [
          a.applied ? s("rect", { x: X, y: Y, width: W, height: H, fill: "#000" }) : s("rect", { x: X, y: Y, width: W, height: H, fill: "rgba(228,66,52,.15)", stroke: a.color, "stroke-width": 2, "stroke-dasharray": "6 4", "vector-effect": "non-scaling-stroke" })
        ];
      case "callout": {
        const anchor2 = a.pts[0];
        return [s("line", { x1: (a.x + 0.01) * VW, y1: (a.y + a.h) * VH, x2: anchor2[0] * VW, y2: anchor2[1] * VH, ...stroke(a) })];
      }
      default:
        return [];
    }
  }
  var pos = (a) => `left:${a.x * 100}%;top:${a.y * 100}%;width:${a.w * 100}%;height:${a.h * 100}%;`;
  function htmlItem(a) {
    var _a, _b, _c, _d;
    const common = { "data-ann": a.id };
    switch (a.type) {
      case "text":
      case "insertText":
      case "callout":
        return h("div", {
          ...common,
          class: `ep-a-text${a.type === "callout" ? " is-callout" : ""}`,
          contenteditable: "false",
          "data-editable": a.id,
          style: `${pos(a)}color:${a.color}`
        }, (a.type === "insertText" ? "\u2038 " : "") + ((_a = a.text) != null ? _a : ""));
      case "comment":
        return h("div", { ...common, class: "ep-a-pin", style: `left:${a.x * 100}%;top:${a.y * 100}%;background:${a.color}` }, icon("message", { size: 16 }));
      case "attachment":
        return h("div", { ...common, class: "ep-a-pin ep-a-attach", style: `left:${a.x * 100}%;top:${a.y * 100}%` }, icon("paperclip", { size: 16 }));
      case "stamp":
        return h("div", { ...common, class: "ep-a-stamp", style: `left:${a.x * 100}%;top:${a.y * 100}%;color:${a.color};border-color:${a.color}` }, (_b = a.text) != null ? _b : "APPROVED");
      case "signature":
        return h("div", { ...common, class: "ep-a-signature", style: `left:${a.x * 100}%;top:${a.y * 100}%;color:${a.color}` }, (_c = a.text) != null ? _c : "Signature");
      case "image":
        return h("img", { ...common, class: "ep-a-image", src: (_d = a.src) != null ? _d : "", style: pos(a), draggable: false });
      case "field": {
        const fill = S.fillMode ? " is-fill" : "";
        let control;
        if (a.kind === "checkbox") control = h("input", { type: "checkbox" });
        else if (a.kind === "radio") control = h("input", { type: "radio", name: "r" + a.id });
        else if (a.kind === "select") control = h("select", {}, h("option", {}, "Option 1"), h("option", {}, "Option 2"), h("option", {}, "Option 3"));
        else if (a.kind === "listbox") control = h("select", { multiple: true, size: 3 }, h("option", {}, "Item 1"), h("option", {}, "Item 2"), h("option", {}, "Item 3"));
        else control = h("input", { type: "text", placeholder: "Text field" });
        return h("div", { ...common, class: `ep-a-field${fill}`, style: pos(a) }, control);
      }
      default:
        return null;
    }
  }
  function buildLayer(page, preview) {
    var _a;
    const d = doc();
    const layer = h("div", { class: "ep-layer", "data-layer": page });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "ep-ann-svg");
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.setAttribute("preserveAspectRatio", "none");
    const list = [...(_a = d == null ? void 0 : d.anns.filter((a) => a.page === page)) != null ? _a : [], ...preview && preview.page === page ? [preview] : []];
    for (const a of list) {
      const g = s("g", { "data-ann": a.id, class: "ep-ann" });
      for (const el of svgShape(a)) g.appendChild(el);
      if (!["text", "insertText", "comment", "attachment", "stamp", "signature", "image", "field"].includes(a.type)) {
        const pad = a.type === "ink" || a.type === "inkhl" || a.type === "line" || a.type === "arrow" ? 8 : 0;
        g.appendChild(s("rect", { class: "ep-hit", x: a.x * VW - pad, y: a.y * VH - pad, width: a.w * VW + pad * 2, height: a.h * VH + pad * 2, fill: "transparent" }));
      }
      svg.appendChild(g);
      if (S.selected === a.id && !["text", "insertText", "comment", "attachment", "stamp", "signature", "image", "field", "callout"].includes(a.type)) {
        svg.appendChild(s("rect", { class: "ep-sel", x: a.x * VW - 4, y: a.y * VH - 4, width: a.w * VW + 8, height: a.h * VH + 8, fill: "none", "vector-effect": "non-scaling-stroke" }));
      }
    }
    layer.appendChild(svg);
    for (const a of list) {
      const el = htmlItem(a);
      if (!el) continue;
      if (S.selected === a.id) el.classList.add("is-selected");
      layer.appendChild(el);
    }
    return layer;
  }
  function repaintLayer(page, preview) {
    const old = document.querySelector(`.ep-layer[data-layer="${page}"]`);
    if (old) old.replaceWith(buildLayer(page, preview));
  }

  // src/config.ts
  var DEFAULT_CONFIG = {
    disabledCategories: [],
    ui: { tabBar: "always" },
    mobile: {
      breakpoint: 768,
      sidebarDrawer: true,
      menuSheet: true,
      drawer: { initialSnap: "half", resizable: true }
    }
  };
  function resolve() {
    var _a, _b;
    const o = typeof window !== "undefined" && window.PDF_VIEWER_CONFIG || {};
    const cfg = {
      disabledCategories: [...(_a = o.disabledCategories) != null ? _a : DEFAULT_CONFIG.disabledCategories],
      ui: { ...DEFAULT_CONFIG.ui, ...o.ui },
      mobile: { ...DEFAULT_CONFIG.mobile, ...o.mobile, drawer: { ...DEFAULT_CONFIG.mobile.drawer, ...(_b = o.mobile) == null ? void 0 : _b.drawer } }
    };
    const fromUrl = new URLSearchParams(location.hash.slice(1)).get("disable");
    if (fromUrl) cfg.disabledCategories.push(...fromUrl.split(",").map((s2) => s2.trim()).filter(Boolean));
    const tabs = new URLSearchParams(location.hash.slice(1)).get("tabs");
    if (tabs === "always" || tabs === "auto" || tabs === "never") cfg.ui.tabBar = tabs;
    return cfg;
  }
  var config = resolve();
  function isMobileWidth() {
    const root2 = document.querySelector(".ep-root");
    return !!root2 && root2.clientWidth > 0 && root2.clientWidth < config.mobile.breakpoint;
  }
  var useDrawerMode = () => config.mobile.sidebarDrawer && isMobileWidth();
  var useSheetMode = () => config.mobile.menuSheet && isMobileWidth();

  // src/features.ts
  var ALIASES = {
    open: "document-open",
    close: "document-close",
    print: "document-print",
    export: "document-export",
    download: "document-export",
    screenshot: "document-capture",
    fullscreen: "document-fullscreen",
    view: "mode-view",
    annotate: "mode-annotate",
    shapes: "mode-shapes",
    search: "panel-search",
    comments: "panel-comment",
    sidebar: "panel-sidebar",
    thumbnails: "sidebar-thumbnails",
    outline: "sidebar-outline",
    replies: "comment-reply",
    reply: "comment-reply",
    undo: "history-undo",
    redo: "history-redo",
    tabs: "tab-bar",
    forms: "form",
    stamps: "insert-rubber-stamp"
  };
  var MARKUP = ["highlight", "underline", "strikeout", "squiggly", "insert-text", "replace-text"];
  var INK = ["ink", "ink-highlighter"];
  var TEXT = ["text", "callout"];
  var SHAPE = ["rectangle", "circle", "line", "arrow", "polygon", "polyline"];
  var MODE_EXTRA = {
    annotate: ["annotation"],
    shapes: ["annotation", "annotation-shape"],
    insert: ["insert"],
    form: ["form"],
    redact: ["redaction"]
  };
  function categoriesOf(id) {
    var _a;
    const [ns, name = ""] = id.split(":");
    switch (ns) {
      case "document":
        return name === "protect" ? ["document", "document-protect", "security"] : ["document", `document-${name}`];
      case "zoom":
        if (/^\d+$/.test(name)) return ["zoom", "zoom-level", `zoom-level-${name}`];
        if (name.startsWith("toggle-menu")) return ["zoom", "zoom-menu"];
        return ["zoom", `zoom-${name}`];
      case "pan":
        return ["tools", "pan"];
      case "pointer":
        return ["tools", "pointer"];
      case "left-action-menu":
        return ["ui", "ui-menu"];
      case "panel": {
        const p = name.replace("toggle-", "");
        return p === "redaction" ? ["panel", "panel-redaction", "redaction"] : ["panel", `panel-${p}`];
      }
      case "page":
        return ["page", `page-${name}`];
      case "spread":
        return ["page", "spread", `spread-${name}`];
      case "rotate":
        return ["page", "rotate", `rotate-${name}`];
      case "scroll":
        return name === "next-page" || name === "previous-page" ? ["page", "navigation", name === "next-page" ? "navigation-next" : "navigation-previous"] : ["page", "scroll", `scroll-${name}`];
      case "mode":
        return ["mode", `mode-${name}`, ...(_a = MODE_EXTRA[name]) != null ? _a : []];
      case "tabs":
        return ["mode", "mode-menu"];
      case "annotation": {
        if (name === "overflow-tools") return ["annotation", "ui-menu"];
        if (name === "overflow-shapes") return ["annotation", "annotation-shape", "ui-menu"];
        const t = name.replace("add-", "");
        const group = MARKUP.includes(t) ? "annotation-markup" : INK.includes(t) ? "annotation-ink" : TEXT.includes(t) ? "annotation-text" : SHAPE.includes(t) ? "annotation-shape" : t === "comment" ? "annotation-comment" : "";
        return ["annotation", ...group ? [group] : [], `annotation-${t}`];
      }
      case "form":
        if (name === "overflow-tools") return ["form", "ui-menu"];
        return ["form", `form-${name.replace("add-", "").replace("toggle-", "")}`];
      case "insert":
        return ["insert", `insert-${name.replace("add-", "")}`];
      case "redaction":
        return ["redaction", "redaction-area"];
      case "history":
        return ["history", `history-${name}`];
      default:
        return [];
    }
  }
  var disabled = new Set(
    config.disabledCategories.map((c2) => c2.trim().toLowerCase()).filter(Boolean).map((c2) => {
      var _a;
      return (_a = ALIASES[c2]) != null ? _a : c2;
    })
  );
  function categoryEnabled(cat) {
    var _a;
    const c2 = cat.toLowerCase();
    return !disabled.has((_a = ALIASES[c2]) != null ? _a : c2);
  }
  function isEnabled(id) {
    if (id === "panel:toggle-sidebar" && !categoryEnabled("sidebar-thumbnails") && !categoryEnabled("sidebar-outline")) return false;
    return categoriesOf(id).every(categoryEnabled);
  }

  // src/components/tabBar.ts
  function tabBar() {
    if (!categoryEnabled("tab-bar") || config.ui.tabBar === "never") return null;
    if (config.ui.tabBar === "auto" && S.docs.length <= 1) return null;
    const canClose = isEnabled("document:close"), canOpen = isEnabled("document:open");
    return h(
      "div",
      { class: "ep-tabbar" },
      h(
        "div",
        { class: "ep-tabbar-scroll" },
        S.docs.map((t) => {
          const active = t.id === S.active;
          return h(
            "div",
            { class: `ep-doc-tab${active ? " is-active" : ""}`, role: "tab", tabindex: 0, "aria-selected": active, "data-act": "tab-select", "data-arg": t.id },
            h("span", { class: "ep-doc-tab-name" }, t.name),
            canClose ? h("button", { type: "button", class: "ep-doc-tab-close", "aria-label": `Close ${t.name}`, "data-act": "tab-close", "data-arg": t.id }, icon("x", { size: 14 })) : null
          );
        }),
        canOpen ? h("button", { type: "button", class: "ep-tab-add", "data-tip": "Open File", "aria-label": "Open File", "data-act": "tab-add" }, icon("plus", { size: 14 })) : null
      )
    );
  }

  // src/data.ts
  var RED2 = "#E44234";
  var YELLOW = "#FFCD45";
  var COMMANDS = {
    // zoom
    "zoom:in": { label: "Zoom In", icon: "zoomIn" },
    "zoom:out": { label: "Zoom Out", icon: "zoomOut" },
    "zoom:fit-page": { label: "Fit to Page", icon: "fitToPage" },
    "zoom:fit-width": { label: "Fit to Width", icon: "fitToWidth" },
    "zoom:marquee": { label: "Marquee Zoom", icon: "zoomInArea" },
    "zoom:toggle-menu": { label: "Zoom Menu", icon: "chevronDown" },
    "zoom:toggle-menu-mobile": { label: "Zoom Menu", icon: "zoomIn" },
    // tools
    "pan:toggle": { label: "Toggle Pan Mode", icon: "hand" },
    "pointer:toggle": { label: "Toggle Pointer Mode", icon: "pointer" },
    "left-action-menu:overflow-menu": { label: "More Options", icon: "dots" },
    // document
    "document:menu": { label: "Document Menu", icon: "menu" },
    "document:open": { label: "Open", icon: "fileImport" },
    "document:close": { label: "Close", icon: "x" },
    "document:print": { label: "Print", icon: "print" },
    "document:protect": { label: "Security", icon: "lock" },
    "document:export": { label: "Export", icon: "download" },
    "document:capture": { label: "Screenshot", icon: "screenshot" },
    "document:fullscreen": { label: "Fullscreen", icon: "fullscreen" },
    // panels
    "panel:toggle-sidebar": { label: "Sidebar", icon: "sidebar" },
    "panel:toggle-search": { label: "Search", icon: "search" },
    "panel:toggle-comment": { label: "Comment", icon: "comment" },
    "panel:toggle-redaction": { label: "Redaction Sidebar", icon: "redactionSidebar" },
    "panel:toggle-annotation-style": { label: "Annotation Style", icon: "palette" },
    // page
    "page:settings": { label: "Page Settings", icon: "viewSettings" },
    "spread:none": { label: "Single Page", icon: "singlePage" },
    "spread:odd": { label: "Two Page (Odd)", icon: "doublePage" },
    "spread:even": { label: "Two Page (Even)", icon: "book2" },
    "rotate:clockwise": { label: "Rotate Clockwise", icon: "rotateClockwise" },
    "rotate:counter-clockwise": { label: "Rotate Counter-Clockwise", icon: "rotateCounterClockwise" },
    "scroll:vertical": { label: "Vertical", icon: "vertical" },
    "scroll:horizontal": { label: "Horizontal", icon: "horizontal" },
    "scroll:next-page": { label: "Next Page", icon: "chevronRight" },
    "scroll:previous-page": { label: "Previous Page", icon: "chevronLeft" },
    // modes
    "mode:view": { label: "View" },
    "mode:annotate": { label: "Annotate" },
    "mode:shapes": { label: "Shapes" },
    "mode:insert": { label: "Insert" },
    "mode:form": { label: "Form" },
    "mode:redact": { label: "Redact" },
    "tabs:overflow-menu": { label: "More", icon: "dots" },
    // annotation tools
    "annotation:add-highlight": { label: "Highlight", icon: "highlight", primaryColor: YELLOW },
    "annotation:add-underline": { label: "Underline", icon: "underline", primaryColor: RED2 },
    "annotation:add-strikeout": { label: "Strikethrough", icon: "strikethrough", primaryColor: RED2 },
    "annotation:add-squiggly": { label: "Squiggly", icon: "squiggly", primaryColor: RED2 },
    "annotation:add-insert-text": { label: "Insert Text", icon: "insertText", primaryColor: RED2 },
    "annotation:add-replace-text": { label: "Replace Text", icon: "replaceText", primaryColor: RED2 },
    "annotation:add-ink": { label: "Ink", icon: "pencilMarker", primaryColor: RED2 },
    "annotation:add-ink-highlighter": { label: "Ink Highlighter", icon: "inkHighlighter", primaryColor: YELLOW },
    "annotation:add-text": { label: "Text", icon: "freeText", primaryColor: RED2 },
    "annotation:add-callout": { label: "Callout", icon: "callout", primaryColor: RED2, secondaryColor: "transparent" },
    "annotation:add-comment": { label: "Comment", icon: "message", primaryColor: YELLOW },
    "annotation:add-rectangle": { label: "Rectangle", icon: "square", primaryColor: RED2, secondaryColor: "transparent" },
    "annotation:add-circle": { label: "Circle", icon: "circle", primaryColor: RED2, secondaryColor: "transparent" },
    "annotation:add-line": { label: "Line", icon: "line", primaryColor: RED2 },
    "annotation:add-arrow": { label: "Arrow", icon: "lineArrow", primaryColor: RED2 },
    "annotation:add-polygon": { label: "Polygon", icon: "polygon", primaryColor: RED2, secondaryColor: "transparent" },
    "annotation:add-polyline": { label: "Polyline", icon: "zigzag", primaryColor: RED2 },
    "annotation:overflow-tools": { label: "More Tools", icon: "dots" },
    "annotation:overflow-shapes": { label: "More Shapes", icon: "dots" },
    "form:overflow-tools": { label: "More Form Tools", icon: "dots" },
    // forms
    "form:add-textfield": { label: "Text Field", icon: "formTextfield" },
    "form:add-checkbox": { label: "Checkbox", icon: "formCheckbox" },
    "form:add-radio": { label: "Radio Button", icon: "formRadio" },
    "form:add-select": { label: "Dropdown", icon: "formSelect" },
    "form:add-listbox": { label: "List Box", icon: "formListbox" },
    "form:toggle-fill-mode": { label: "Toggle Fill Mode", icon: "widgetEdit" },
    // insert
    "insert:add-rubber-stamp": { label: "Rubber Stamp", icon: "rubberStamp" },
    "insert:add-signature": { label: "Signature", icon: "signature" },
    "insert:add-attachment": { label: "Attachment", icon: "paperclip" },
    "insert:add-image": { label: "Image", icon: "photo" },
    // redaction
    "redaction:redact": { label: "Redact", icon: "redactArea" },
    // history
    "history:undo": { label: "Undo", icon: "arrowBackUp" },
    "history:redo": { label: "Redo", icon: "arrowForwardUp" }
  };
  function cmd(id) {
    var _a;
    return (_a = COMMANDS[id]) != null ? _a : { label: id };
  }

  // src/components/toast.ts
  var timer;
  function toast(message) {
    var _a;
    (_a = document.querySelector(".ep-toast")) == null ? void 0 : _a.remove();
    const el = document.createElement("div");
    el.className = "ep-toast";
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-in"));
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      el.classList.remove("is-in");
      window.setTimeout(() => el.remove(), 200);
    }, 2200);
  }

  // src/commands.ts
  var MODE_DEFAULT_TOOL = {
    view: null,
    annotate: "annotation:add-highlight",
    shapes: "annotation:add-rectangle",
    insert: null,
    form: "form:add-textfield",
    redact: "redaction:redact"
  };
  function setZoom(z) {
    const d = doc();
    if (!d) return;
    d.zoom = Math.max(25, Math.min(1600, Math.round(z)));
    S.pending = { ratio: true };
  }
  function viewportSize() {
    var _a, _b;
    const vp = document.querySelector(".ep-viewport");
    return { w: (_a = vp == null ? void 0 : vp.clientWidth) != null ? _a : 800, h: (_b = vp == null ? void 0 : vp.clientHeight) != null ? _b : 600 };
  }
  function goToPage(n) {
    const d = doc();
    if (!d) return;
    d.page = Math.max(1, Math.min(d.pages, n));
    S.pending = { page: d.page };
  }
  function toggleRight(p) {
    S.right = S.right === p ? null : p;
    if (S.right === "search") S.focusKey = "search";
  }
  function pickFile(accept, cb) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      if (input.files && input.files.length) cb(input.files);
    };
    input.click();
  }
  function openDocFromPicker() {
    pickFile("application/pdf,.pdf", (files) => {
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
  function activateTool(id) {
    S.tool = id;
    if (id) S.fillMode = false;
    S.pointerTool = "pointer";
    S.selected = null;
  }
  function isActive(id) {
    const d = doc();
    switch (id) {
      case "panel:toggle-sidebar":
        return S.leftOpen;
      case "panel:toggle-search":
        return S.right === "search";
      case "panel:toggle-comment":
        return S.right === "comment";
      case "panel:toggle-annotation-style":
        return S.right === "style";
      case "panel:toggle-redaction":
        return S.right === "redaction";
      case "pan:toggle":
        return S.pointerTool === "pan";
      case "pointer:toggle":
        return S.pointerTool === "pointer" && !S.tool;
      case "zoom:marquee":
        return S.pointerTool === "marquee";
      case "document:menu":
        return S.menu === "document";
      case "page:settings":
        return S.menu === "page";
      case "zoom:toggle-menu":
      case "zoom:toggle-menu-mobile":
        return !!S.menu && S.menu.startsWith("zoom");
      case "left-action-menu:overflow-menu":
        return !!S.menu && S.menu.startsWith("left");
      case "tabs:overflow-menu":
        return S.menu === "tabs";
      case "annotation:overflow-tools":
        return S.menu === "annot-more";
      case "annotation:overflow-shapes":
        return S.menu === "shapes-more";
      case "form:overflow-tools":
        return S.menu === "forms-more";
      case "form:toggle-fill-mode":
        return S.fillMode;
      case "spread:none":
      case "spread:odd":
      case "spread:even":
        return S.spread === id.split(":")[1];
      case "scroll:vertical":
        return S.layout === "vertical";
      case "scroll:horizontal":
        return S.layout === "horizontal";
    }
    if (id.startsWith("mode:")) return S.mode === id.slice(5);
    if (/^zoom:\d+$/.test(id)) return !!d && d.zoom === Number(id.slice(5));
    return S.tool === id;
  }
  function isDisabled(id) {
    const d = doc();
    if (!d) return true;
    switch (id) {
      case "history:undo":
        return d.undo.length === 0;
      case "history:redo":
        return d.redo.length === 0;
      case "scroll:previous-page":
        return d.page <= 1;
      case "scroll:next-page":
        return d.page >= d.pages;
      case "zoom:in":
        return d.zoom >= 1600;
      case "zoom:out":
        return d.zoom <= 25;
    }
    return false;
  }
  var MENU_TOGGLES = {
    "document:menu": "document",
    "page:settings": "page",
    "zoom:toggle-menu": "zoom",
    "zoom:toggle-menu-mobile": "zoom",
    "left-action-menu:overflow-menu": "left",
    "tabs:overflow-menu": "tabs",
    "annotation:overflow-tools": "annot-more",
    "annotation:overflow-shapes": "shapes-more",
    "form:overflow-tools": "forms-more"
  };
  function execute(id) {
    const d = doc();
    if (!isEnabled(id) || isDisabled(id)) return;
    if (MENU_TOGGLES[id]) {
      update(() => {
        const m = S.menu, t = MENU_TOGGLES[id];
        S.menu = m === t || t === "left" && !!(m == null ? void 0 : m.startsWith("left")) || t === "zoom" && !!(m == null ? void 0 : m.startsWith("zoom")) ? null : t;
      });
      return;
    }
    update(() => {
      var _a, _b, _c, _d, _e;
      S.menu = null;
      if (id.startsWith("mode:")) {
        S.mode = id.slice(5);
        S.fillMode = false;
        activateTool(MODE_DEFAULT_TOOL[S.mode]);
        if (S.mode === "redact") S.right = (_a = S.right) != null ? _a : "redaction";
        return;
      }
      if (TOOLS[id]) {
        if (id === "insert:add-signature") {
          S.modal = "signature";
          return;
        }
        if (id === "insert:add-image") {
          activateTool(S.tool === id ? null : id);
          return;
        }
        activateTool(S.tool === id ? null : id);
        return;
      }
      if (/^zoom:\d+$/.test(id)) {
        setZoom(Number(id.slice(5)));
        return;
      }
      switch (id) {
        case "panel:toggle-sidebar":
          S.leftOpen = !S.leftOpen;
          break;
        case "panel:toggle-search":
          toggleRight("search");
          break;
        case "panel:toggle-comment":
          toggleRight("comment");
          break;
        case "panel:toggle-annotation-style":
          toggleRight("style");
          break;
        case "panel:toggle-redaction":
          toggleRight("redaction");
          break;
        case "pan:toggle":
          S.pointerTool = S.pointerTool === "pan" ? "pointer" : "pan";
          S.tool = null;
          break;
        case "pointer:toggle":
          S.pointerTool = "pointer";
          S.tool = null;
          break;
        case "zoom:marquee":
          S.pointerTool = S.pointerTool === "marquee" ? "pointer" : "marquee";
          S.tool = null;
          break;
        case "zoom:in":
          if (d) setZoom((_b = ZOOMS.find((z) => z > d.zoom)) != null ? _b : 1600);
          break;
        case "zoom:out":
          if (d) setZoom((_c = [...ZOOMS].reverse().find((z) => z < d.zoom)) != null ? _c : 25);
          break;
        case "zoom:fit-width": {
          const { w } = viewportSize();
          setZoom((w - 48) / 640 * 100 / (S.spread === "none" ? 1 : 2) * (S.rotation % 180 ? 1 / 1.414 : 1));
          break;
        }
        case "zoom:fit-page": {
          const { w, h: h2 } = viewportSize();
          const pw = S.rotation % 180 ? 640 * 1.414 : 640, ph = S.rotation % 180 ? 640 : 640 * 1.414;
          setZoom(Math.min((w - 48) / pw, (h2 - 48) / ph) * 100 / (S.spread === "none" ? 1 : 1));
          break;
        }
        case "spread:none":
        case "spread:odd":
        case "spread:even":
          S.spread = id.split(":")[1];
          S.pending = { page: d == null ? void 0 : d.page };
          break;
        case "scroll:vertical":
          S.layout = "vertical";
          S.pending = { page: d == null ? void 0 : d.page };
          break;
        case "scroll:horizontal":
          S.layout = "horizontal";
          S.pending = { page: d == null ? void 0 : d.page };
          break;
        case "rotate:clockwise":
          S.rotation = (S.rotation + 90) % 360;
          S.pending = { page: d == null ? void 0 : d.page };
          break;
        case "rotate:counter-clockwise":
          S.rotation = (S.rotation + 270) % 360;
          S.pending = { page: d == null ? void 0 : d.page };
          break;
        case "scroll:next-page":
          if (d) goToPage(d.page + 1);
          break;
        case "scroll:previous-page":
          if (d) goToPage(d.page - 1);
          break;
        case "history:undo":
          if (d) undo(d);
          break;
        case "history:redo":
          if (d) redo(d);
          break;
        case "form:toggle-fill-mode":
          S.fillMode = !S.fillMode;
          if (S.fillMode) S.tool = null;
          break;
        case "document:open":
          openDocFromPicker();
          break;
        case "document:close":
          closeDoc(S.active);
          break;
        case "document:print":
          S.modal = "print";
          S.print = { range: "all", spec: "", annotations: true, busy: false };
          break;
        case "document:protect":
          S.modal = "protect";
          break;
        case "document:export":
          toast("Exporting document\u2026 (demo only, nothing is downloaded)");
          break;
        case "document:capture":
          toast("Screenshot captured (demo)");
          break;
        case "document:fullscreen":
          if (document.fullscreenElement) void document.exitFullscreen();
          else void ((_e = (_d = document.documentElement).requestFullscreen) == null ? void 0 : _e.call(_d));
          break;
      }
    });
  }
  function closeDoc(id) {
    var _a, _b, _c, _d;
    const i = S.docs.findIndex((x) => x.id === id);
    if (i < 0) return;
    S.docs.splice(i, 1);
    if (S.active === id) {
      S.active = (_b = (_a = S.docs[Math.min(i, S.docs.length - 1)]) == null ? void 0 : _a.id) != null ? _b : null;
      S.pending = { page: (_d = (_c = doc()) == null ? void 0 : _c.page) != null ? _d : 1 };
    }
    S.selected = null;
  }

  // src/components/menus.ts
  function renderEntry(e, mobile) {
    var _a;
    if (e.type === "divider") return h("hr", { class: "ep-menu-divider" });
    if (e.type === "section") return h("div", { class: "ep-menu-section" }, e.label);
    const size = mobile ? 20 : 24;
    if (e.type === "back")
      return h(
        "button",
        { type: "button", class: "ep-menu-item", "data-act": "menu-go", "data-arg": e.to },
        h("span", { class: "ep-menu-icon" }, icon("chevronLeft", { size: 20 })),
        h("span", { class: "ep-menu-label" }, "Back")
      );
    if (e.type === "sub")
      return h(
        "button",
        { type: "button", role: "menuitem", class: "ep-menu-item", "data-act": "menu-go", "data-arg": e.to },
        mobile ? null : h("span", { class: "ep-menu-icon" }, icon(e.icon, { size })),
        h("span", { class: "ep-menu-label" }, e.label),
        h("span", { class: "ep-menu-chevron" }, icon("chevronRight", { size: mobile ? 16 : 16 }))
      );
    const c2 = cmd(e.id);
    const active = isActive(e.id), disabled2 = isDisabled(e.id);
    return h("button", {
      type: "button",
      role: "menuitem",
      "data-command": e.id,
      class: `ep-menu-item${active ? " is-active" : ""}${disabled2 ? " is-disabled" : ""}`
    }, h("span", { class: "ep-menu-icon" }, c2.icon ? icon(c2.icon, { size }) : null), h("span", { class: "ep-menu-label" }, (_a = e.label) != null ? _a : c2.label));
  }
  var c = (id, label) => ({ type: "command", id, label });
  var div = { type: "divider" };
  var PAGE_ENTRIES = () => [
    { type: "section", label: "Spread Mode" },
    c("spread:none"),
    c("spread:odd"),
    c("spread:even"),
    div,
    { type: "section", label: "Scroll Layout" },
    c("scroll:vertical"),
    c("scroll:horizontal"),
    div,
    { type: "section", label: "Page Rotation" },
    c("rotate:clockwise"),
    c("rotate:counter-clockwise"),
    div,
    c("document:fullscreen")
  ];
  var PRESETS = () => [25, 50, 100, 125, 150, 200, 400, 800, 1600].map((z) => c(`zoom:${z}`, `${z}%`));
  function zoomEntries(levelsMenu) {
    var _a, _b;
    const w = (_b = (_a = document.querySelector(".ep-root")) == null ? void 0 : _a.clientWidth) != null ? _b : 1280;
    const sub = { type: "sub", to: levelsMenu, label: "Zoom Level", icon: "zoomIn" };
    const tail = [div, c("zoom:fit-page"), c("zoom:fit-width"), div, c("zoom:marquee")];
    if (w >= 768) return [...PRESETS(), ...tail];
    if (w <= 640) return [sub, div, c("zoom:in"), c("zoom:out"), ...tail];
    return [...PRESETS(), sub, div, c("zoom:in"), c("zoom:out"), ...tail];
  }
  var MENUS = {
    document: { entries: () => [c("document:open"), c("document:close"), div, c("document:print"), c("document:protect"), c("document:capture"), c("document:export"), div, c("document:fullscreen")] },
    page: { entries: PAGE_ENTRIES },
    zoom: { entries: () => zoomEntries("zoom-levels") },
    "zoom-levels": { parent: "zoom", title: "Zoom Level", entries: PRESETS },
    left: {
      entries: () => [
        { type: "sub", to: "left-page", label: "View Controls", icon: "viewSettings" },
        { type: "sub", to: "left-zoom", label: "Zoom Controls", icon: "zoomIn" },
        div,
        c("pan:toggle"),
        c("pointer:toggle")
      ]
    },
    "left-page": { parent: "left", title: "View Controls", entries: PAGE_ENTRIES },
    "left-zoom": { parent: "left", title: "Zoom Controls", entries: () => zoomEntries("left-zoom-levels") },
    "left-zoom-levels": { parent: "left-zoom", title: "Zoom Level", entries: PRESETS },
    tabs: { entries: () => ["view", "annotate", "shapes", "insert", "form", "redact"].map((m) => c(`mode:${m}`)) },
    "shapes-more": { entries: () => ["polygon", "polyline"].map((t) => c(`annotation:add-${t}`)) },
    "forms-more": { entries: () => ["select", "listbox"].map((t) => c(`form:add-${t}`)) },
    "annot-more": { entries: () => ["text", "ink", "ink-highlighter", "insert-text", "replace-text", "comment", "callout"].map((t) => c(`annotation:add-${t}`)) }
  };
  var hasContent = (list) => list.some((e) => e.type === "command" || e.type === "sub");
  function visible(entries) {
    let out = entries.filter((e) => e.type === "command" ? isEnabled(e.id) : e.type === "sub" ? menuAvailable(e.to) : true);
    const before = out;
    out = out.filter((e, i) => {
      if (e.type !== "section") return true;
      for (let j = i + 1; j < before.length; j++) {
        const n = before[j];
        if (n.type === "command" || n.type === "sub") return true;
        if (n.type === "section" || n.type === "divider") return false;
      }
      return false;
    });
    const res = [];
    for (const e of out) {
      if (e.type === "divider") {
        const prev = res[res.length - 1];
        if (!prev || prev.type === "divider") continue;
      }
      res.push(e);
    }
    while (res.length && res[res.length - 1].type === "divider") res.pop();
    return res;
  }
  function entriesFor(id, mobile) {
    const def = MENUS[id];
    if (!def) return [];
    const base = def.entries();
    const full = def.parent && !mobile ? [{ type: "back", to: def.parent }, div, ...base] : base;
    return visible(full);
  }
  function menuAvailable(id) {
    return hasContent(entriesFor(id, false));
  }
  function menuIf(...ids) {
    const open = S.menu;
    if (!open || !ids.includes(open) || useSheetMode()) return null;
    const entries = entriesFor(open, false);
    if (!hasContent(entries)) return null;
    return h("div", { class: "ep-menu", role: "menu", "data-scroll": "menu" }, entries.map((e) => renderEntry(e, false)));
  }
  function sheetMenu() {
    var _a;
    const id = S.menu;
    if (!id || !MENUS[id]) return null;
    const entries = entriesFor(id, true);
    if (!hasContent(entries)) return null;
    const def = MENUS[id];
    return h(
      "div",
      { class: "ep-sheet-menu", "data-menu-id": id },
      def.parent ? h(
        "div",
        { class: "ep-sheet-header" },
        h("button", { type: "button", class: "ep-sheet-back", "aria-label": "Back", "data-act": "menu-go", "data-arg": def.parent }, icon("chevronLeft", { size: 20 })),
        h("h3", {}, (_a = def.title) != null ? _a : "Menu")
      ) : null,
      h("div", { class: "ep-sheet-items", role: "menu", "data-scroll": "menu" }, entries.map((e) => renderEntry(e, true)))
    );
  }

  // src/components/buttons.ts
  var MENU_TRIGGERS = /* @__PURE__ */ new Set([
    "document:menu",
    "page:settings",
    "zoom:toggle-menu",
    "zoom:toggle-menu-mobile",
    "left-action-menu:overflow-menu",
    "tabs:overflow-menu",
    "annotation:overflow-tools"
  ]);
  var TRIGGER_MENU = {
    "document:menu": "document",
    "page:settings": "page",
    "zoom:toggle-menu": "zoom",
    "zoom:toggle-menu-mobile": "zoom",
    "left-action-menu:overflow-menu": "left",
    "tabs:overflow-menu": "tabs",
    "annotation:overflow-tools": "annot-more",
    "annotation:overflow-shapes": "shapes-more",
    "form:overflow-tools": "forms-more"
  };
  function commandButton(commandId, opts = {}) {
    var _a;
    if (!isEnabled(commandId)) return null;
    if (TRIGGER_MENU[commandId] && !menuAvailable(TRIGGER_MENU[commandId])) return null;
    const c2 = cmd(commandId);
    const active = isActive(commandId);
    const disabled2 = isDisabled(commandId);
    const btn = h("button", {
      type: "button",
      class: ["ep-btn", active ? "is-active" : "", disabled2 ? "is-disabled" : "", (_a = opts.className) != null ? _a : ""].filter(Boolean).join(" "),
      "data-tip": c2.label,
      "aria-label": c2.label,
      "aria-pressed": active,
      "data-command": commandId,
      "data-menu-trigger": MENU_TRIGGERS.has(commandId) ? "1" : void 0,
      disabled: disabled2
    });
    let primary = c2.primaryColor, secondary = c2.secondaryColor;
    if (TOOLS[commandId]) {
      const st2 = toolStyle(commandId);
      if (primary) primary = st2.color;
    }
    if (c2.icon) btn.appendChild(icon(c2.icon, { size: 20, primaryColor: primary, secondaryColor: secondary }));
    else btn.appendChild(h("span", { class: "ep-btn-text" }, c2.label));
    return btn;
  }
  function tabButton(commandId, className = "") {
    if (!isEnabled(commandId)) return null;
    const active = isActive(commandId);
    return h("button", {
      type: "button",
      role: "tab",
      "aria-selected": active,
      "data-command": commandId,
      class: `ep-tab-btn${active ? " is-active" : ""} ${className}`.trim()
    }, cmd(commandId).label);
  }
  var divider = (className = "") => h("div", { class: `ep-divider-wrap ${className}`.trim() }, h("div", { class: "ep-divider", "aria-hidden": true }));
  var spacer = () => h("div", { class: "ep-spacer", "aria-hidden": true });
  var anchor = (child, popup, className = "") => child ? h("div", { class: `ep-anchor ${className}`.trim() }, child, popup) : null;
  function tidy(el) {
    const isDiv = (n) => n.classList.contains("ep-divider-wrap");
    el.querySelectorAll(":scope > .ep-group").forEach((g) => {
      tidy(g);
      if (!g.children.length) g.remove();
    });
    let prevDiv = true;
    for (const c2 of Array.from(el.children)) {
      if (isDiv(c2)) {
        if (prevDiv) c2.remove();
        else prevDiv = true;
      } else if (!c2.classList.contains("ep-spacer")) prevDiv = false;
    }
    while (el.lastElementChild && isDiv(el.lastElementChild)) el.lastElementChild.remove();
    return el;
  }

  // src/components/toolbar.ts
  function zoomToolbar() {
    var _a;
    if (!categoryEnabled("zoom")) return null;
    const d = doc();
    return h(
      "div",
      { class: "ep-zoom hide-lt-768" },
      h(
        "div",
        { class: "ep-zoom-inner" },
        h(
          "div",
          { class: "ep-zoom-input-wrap" },
          h("input", { class: "ep-zoom-input", name: "zoom", type: "text", inputmode: "numeric", value: String((_a = d == null ? void 0 : d.zoom) != null ? _a : 100), "aria-label": "Set zoom", "data-in": "zoom", "data-focus": "zoom" }),
          h("span", { class: "ep-zoom-pct" }, "%")
        ),
        anchor(commandButton("zoom:toggle-menu"), menuIf("zoom", "zoom-levels")),
        commandButton("zoom:out"),
        commandButton("zoom:in")
      )
    );
  }
  function modeSelect() {
    const label = S.mode.charAt(0).toUpperCase() + S.mode.slice(1);
    const btn = commandButton("tabs:overflow-menu");
    if (!btn) return null;
    btn.className = "ep-btn ep-mode-select" + (S.menu === "tabs" ? " is-active" : "");
    btn.replaceChildren(h("span", { class: "ep-mode-select-label" }, label));
    btn.insertAdjacentHTML("beforeend", '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6l6 -6"/></svg>');
    return h("div", { class: "ep-mode-select-wrap show-lt-640" }, anchor(btn, menuIf("tabs"), "ep-anchor-block"));
  }
  function mainToolbar() {
    return tidy(h(
      "div",
      { class: "ep-toolbar ep-toolbar-main", role: "toolbar" },
      h(
        "div",
        { class: "ep-group" },
        anchor(commandButton("document:menu"), menuIf("document")),
        divider(),
        commandButton("panel:toggle-sidebar"),
        anchor(commandButton("left-action-menu:overflow-menu", { className: "show-lt-400" }), menuIf("left", "left-page", "left-zoom", "left-zoom-levels"), "show-lt-400"),
        anchor(commandButton("page:settings", { className: "hide-lt-400" }), menuIf("page"), "hide-lt-400")
      ),
      divider("hide-lt-400"),
      h(
        "div",
        { class: "ep-group ep-group-center" },
        anchor(commandButton("zoom:toggle-menu-mobile"), menuIf("zoom", "zoom-levels"), "show-400-767"),
        zoomToolbar(),
        divider("hide-lt-500"),
        commandButton("pan:toggle", { className: "hide-lt-500" }),
        commandButton("pointer:toggle", { className: "hide-lt-500" })
      ),
      spacer(),
      modeSelect(),
      h(
        "div",
        { class: "ep-tabs hide-lt-640", role: "tablist" },
        tabButton("mode:view"),
        tabButton("mode:annotate"),
        tabButton("mode:shapes", "hide-lt-768"),
        tabButton("mode:insert", "hide-lt-1024"),
        tabButton("mode:form", "hide-lt-1024"),
        tabButton("mode:redact", "hide-lt-1024"),
        anchor(commandButton("tabs:overflow-menu", { className: "hide-gte-1024" }), menuIf("tabs"), "hide-gte-1024")
      ),
      spacer(),
      h("div", { class: "ep-group" }, commandButton("panel:toggle-search"), commandButton("panel:toggle-comment"))
    ));
  }
  var history = () => [commandButton("history:undo"), commandButton("history:redo")];
  var sec = (items) => {
    const bar2 = h("div", { class: "ep-toolbar ep-toolbar-secondary", role: "toolbar" }, spacer(), h("div", { class: "ep-group" }, items), spacer());
    tidy(bar2);
    return bar2.querySelector(".ep-group") ? bar2 : null;
  };
  function secondaryToolbar() {
    const style = commandButton("panel:toggle-annotation-style");
    switch (S.mode) {
      case "annotate":
        return sec([
          commandButton("annotation:add-highlight"),
          commandButton("annotation:add-strikeout"),
          commandButton("annotation:add-underline"),
          commandButton("annotation:add-squiggly"),
          ...["ink", "ink-highlighter", "text", "insert-text", "replace-text", "comment", "callout"].map((t) => commandButton(`annotation:add-${t}`, { className: "hide-lt-640" })),
          anchor(commandButton("annotation:overflow-tools", { className: "show-lt-640" }), menuIf("annot-more"), "show-lt-640"),
          divider(),
          style,
          divider(),
          ...history()
        ]);
      case "shapes":
        return sec([
          ...["rectangle", "circle", "line", "arrow"].map((t) => commandButton(`annotation:add-${t}`)),
          ...["polygon", "polyline"].map((t) => commandButton(`annotation:add-${t}`, { className: "hide-lt-640" })),
          anchor(commandButton("annotation:overflow-shapes", { className: "show-lt-640" }), menuIf("shapes-more"), "show-lt-640"),
          divider(),
          style,
          divider(),
          ...history()
        ]);
      case "form":
        return sec([
          ...["textfield", "checkbox", "radio"].map((t) => commandButton(`form:add-${t}`)),
          ...["select", "listbox"].map((t) => commandButton(`form:add-${t}`, { className: "hide-lt-640" })),
          anchor(commandButton("form:overflow-tools", { className: "show-lt-640" }), menuIf("forms-more"), "show-lt-640"),
          divider(),
          style,
          commandButton("form:toggle-fill-mode"),
          divider(),
          ...history()
        ]);
      case "insert":
        return sec([
          commandButton("insert:add-rubber-stamp"),
          commandButton("insert:add-signature"),
          commandButton("insert:add-attachment"),
          commandButton("insert:add-image"),
          divider(),
          style,
          divider(),
          ...history()
        ]);
      case "redact":
        return sec([commandButton("redaction:redact"), divider(), commandButton("panel:toggle-redaction"), style, divider(), ...history()]);
      default:
        return null;
    }
  }

  // src/components/page.ts
  var bar = (w, cls = "") => h("div", { class: `ep-bar ${cls}`.trim(), style: `width:${w}%` });
  var para = (ws) => h("div", { class: "ep-para" }, ws.map((w) => bar(w)));
  function skeletonPage(n) {
    const page = h("div", { class: "ep-page ep-skel", "data-thumb-page": n });
    const inner = h("div", { class: "ep-page-inner" });
    if (n === 1) inner.append(bar(55, "ep-bar-title"), bar(35, "ep-bar-sub"), h("div", { class: "ep-fig" }), para([100, 96, 100, 92, 100, 60]), para([100, 98, 94, 100, 40]));
    else {
      inner.append(bar(30, "ep-bar-h2"), para([100, 97, 100, 95, 100, 88, 100, 45]), para([100, 100, 93, 100, 72]));
      if (n % 2 === 0) inner.append(h("div", { class: "ep-fig ep-fig-small" }));
      inner.append(para([100, 96, 100, 98, 100, 55]), para([100, 94, 100, 90]));
    }
    page.append(inner);
    return page;
  }

  // src/components/viewport.ts
  var hitsFor = (d) => findHits(d.content, S.search.q, S.search.matchCase, S.search.wholeWord);
  function paraNodes(text, mine) {
    if (!mine.length) return [text];
    const out = [];
    let cur = 0;
    for (const { hit, idx } of mine) {
      out.push(text.slice(cur, hit.start));
      out.push(h("mark", { class: `ep-mark${idx === S.search.active ? " is-active" : ""}`, "data-hit": idx }, text.slice(hit.start, hit.start + hit.len)));
      cur = hit.start + hit.len;
    }
    out.push(text.slice(cur));
    return out;
  }
  function pageBox(d, n, hits) {
    const W = Math.round(BASE_PAGE_W * d.zoom / 100), H = Math.round(W * PAGE_RATIO);
    const swap = S.rotation % 180 !== 0;
    const bw = swap ? H : W, bh = swap ? W : H;
    const c2 = d.content[n - 1];
    const inner = h("div", { class: "ep-page-inner" });
    if (n === 1) {
      inner.append(h("h1", { class: "ep-ph-title" }, c2.heading));
      if (c2.sub) inner.append(h("div", { class: "ep-ph-sub" }, c2.sub));
    } else inner.append(h("h2", { class: "ep-ph" }, c2.heading));
    if (c2.fig === 1) inner.append(h("div", { class: "ep-fig" }));
    c2.paras.forEach((text, k) => {
      const mine = hits.map((hit, idx) => ({ hit, idx })).filter((x) => x.hit.page === n && x.hit.para === k);
      inner.append(h("p", { class: "ep-ptext" }, paraNodes(text, mine)));
      if (c2.fig === 2 && k === 0) inner.append(h("div", { class: "ep-fig ep-fig-small" }));
    });
    inner.append(h("div", { class: "ep-pnum" }, String(n)));
    const page = h("div", { class: "ep-page ep-page-live", "data-page": n, style: `width:${W}px;height:${H}px;left:${(bw - W) / 2}px;top:${(bh - H) / 2}px;transform:rotate(${S.rotation}deg)` }, inner, buildLayer(n));
    return h("div", { class: "ep-page-box", "data-page-box": n, style: `width:${bw}px;height:${bh}px` }, page);
  }
  function rows(total) {
    const out = [];
    if (S.spread === "none") for (let i = 1; i <= total; i++) out.push([i]);
    else {
      let i = 1;
      if (S.spread === "odd") {
        out.push([1]);
        i = 2;
      }
      for (; i <= total; i += 2) out.push(i + 1 <= total ? [i, i + 1] : [i]);
    }
    return out;
  }
  function viewport() {
    const d = doc();
    const hits = hitsFor(d);
    return h(
      "div",
      { class: "ep-viewport-wrap" },
      h(
        "div",
        { class: "ep-viewport", "data-scroll": "viewport" },
        h(
          "div",
          { class: `ep-pages is-${S.layout}` },
          rows(d.pages).map((r) => h("div", { class: "ep-row" }, r.map((n) => pageBox(d, n, hits))))
        )
      ),
      pageControls(d)
    );
  }
  function pageControls(d) {
    if (!categoryEnabled("navigation")) return null;
    return h(
      "div",
      { class: "ep-overlay ep-overlay-bottom-center" },
      h(
        "div",
        { class: "ep-page-controls" },
        commandButton("scroll:previous-page"),
        h(
          "div",
          { class: "ep-page-input-wrap" },
          h("input", { class: "ep-page-input", type: "text", inputmode: "numeric", value: String(d.page), "aria-label": "Page number", "data-in": "page", "data-focus": "page" }),
          h("span", { class: "ep-page-total" }, `\xA0 ${d.pages}`)
        ),
        commandButton("scroll:next-page")
      )
    );
  }
  function emptyState() {
    return h(
      "div",
      { class: "ep-empty" },
      h(
        "div",
        { class: "ep-empty-inner" },
        h("div", { class: "ep-empty-icon" }, icon("file", { size: 48 })),
        h("h2", { class: "ep-empty-title" }, "No Documents Open"),
        h("p", { class: "ep-empty-desc" }, "Open a PDF document to get started.", h("br"), "You can view multiple documents using tabs."),
        isEnabled("document:open") ? h("button", { type: "button", class: "ep-primary-btn", "data-act": "tab-add" }, icon("plus", { size: 16 }), "Open Document") : null,
        h("p", { class: "ep-empty-hint" }, "Supported format: PDF")
      )
    );
  }

  // src/components/sidebars.ts
  function segmented() {
    const tab = (id, ic, cls) => h("button", { type: "button", role: "tab", "aria-selected": S.leftTab === id, class: `ep-seg ${cls}${S.leftTab === id ? " is-active" : ""}`, "data-tip": id === "thumbnails" ? "Thumbnails" : "Outline", "data-act": "left-tab", "data-arg": id }, icon(ic, { size: 20 }));
    const tabs = [categoryEnabled("sidebar-thumbnails") ? "thumbnails" : null, categoryEnabled("sidebar-outline") ? "outline" : null].filter(Boolean);
    if (tabs.length < 2) return null;
    return h("div", { class: "ep-seg-group", role: "tablist" }, tab("thumbnails", "squares", "first"), tab("outline", "listTree", "last"));
  }
  function thumbnails(d) {
    return h("div", { class: "ep-thumbs" }, Array.from({ length: d.pages }, (_, i) => {
      const n = i + 1;
      return h(
        "div",
        { class: "ep-thumb", "data-act": "thumb", "data-arg": n },
        h("div", { class: `ep-thumb-frame${n === d.page ? " is-current" : ""}`, "data-thumb": n }, skeletonPage(n)),
        h("span", { class: "ep-thumb-label" }, String(n))
      );
    }));
  }
  function outlineNode(node, depth) {
    var _a, _b;
    const key = `${node.page}:${node.title}`;
    const has = !!((_a = node.children) == null ? void 0 : _a.length);
    const open = (_b = S.outlineOpen[key]) != null ? _b : depth === 0;
    return h(
      "div",
      { class: "ep-outline-node" },
      h(
        "div",
        { class: "ep-outline-row", style: `padding-left:${8 + depth * 16}px`, "data-act": "outline-go", "data-arg": node.page },
        has ? h("span", { class: "ep-outline-toggle", "data-act": "outline-toggle", "data-arg": key, "data-open": open }, icon(open ? "chevronDown" : "chevronRight", { size: 12 })) : h("span", { class: "ep-outline-spacer" }),
        h("span", { class: "ep-outline-title" }, node.title)
      ),
      has && open ? node.children.map((c2) => outlineNode(c2, depth + 1)) : null
    );
  }
  function leftSidebar(d) {
    return h(
      "aside",
      { class: "ep-sidebar ep-sidebar-left" },
      h(
        "div",
        { class: "ep-sidebar-tabs-layout" },
        segmented(),
        h(
          "div",
          { class: "ep-sidebar-body", "data-scroll": "left" },
          S.leftTab === "thumbnails" ? thumbnails(d) : h("div", { class: "ep-outline" }, buildOutline(d.content).map((n) => outlineNode(n, 0)))
        )
      )
    );
  }
  function checkbox(label, key, checked) {
    return h(
      "label",
      { class: "ep-checkbox" },
      h("input", { type: "checkbox", checked, "data-in": key }),
      h("span", { class: "ep-checkbox-box" }, icon("check", { size: 14, strokeWidth: 3 })),
      label
    );
  }
  function searchPanel(d) {
    const hits = hitsFor(d);
    const q = S.search.q;
    const groups = /* @__PURE__ */ new Map();
    hits.forEach((x, i) => {
      var _a;
      return groups.set(x.page, [...(_a = groups.get(x.page)) != null ? _a : [], i]);
    });
    return h(
      "div",
      { class: "ep-search" },
      h(
        "div",
        { class: "ep-search-top" },
        h(
          "div",
          { class: "ep-search-input-wrap" },
          h("span", { class: "ep-search-icon" }, icon("search", { size: 16 })),
          h("input", { class: "ep-search-input", type: "text", placeholder: "Search", value: q, "data-in": "search-q", "data-focus": "search", autocomplete: "off" }),
          q ? h("button", { type: "button", class: "ep-search-clear", "aria-label": "Clear", "data-act": "search-clear" }, icon("x", { size: 16 })) : null
        ),
        h("div", { class: "ep-search-flags" }, checkbox("Case sensitive", "search-case", S.search.matchCase), checkbox("Whole word", "search-word", S.search.wholeWord)),
        h("hr", { class: "ep-hr" }),
        h(
          "div",
          { class: "ep-search-summary" },
          h("div", { class: "ep-search-count" }, q.trim() ? hits.length ? `${S.search.active + 1} of ${hits.length} results` : "No results found" : "Type to search"),
          h(
            "div",
            { class: "ep-search-nav" },
            h("button", { type: "button", class: "ep-btn", "aria-label": "Previous result", disabled: !hits.length, "data-act": "search-prev" }, icon("chevronLeft", { size: 16 })),
            h("button", { type: "button", class: "ep-btn", "aria-label": "Next result", disabled: !hits.length, "data-act": "search-next" }, icon("chevronRight", { size: 16 }))
          )
        )
      ),
      h(
        "div",
        { class: "ep-search-results", "data-scroll": "right" },
        [...groups.entries()].map(([page, idxs]) => h(
          "div",
          { class: "ep-hit-group" },
          h("div", { class: "ep-hit-page" }, `Page ${page}`),
          h("div", { class: "ep-hit-list" }, idxs.map((i) => {
            const x = hits[i];
            return h(
              "button",
              { type: "button", class: `ep-hit${i === S.search.active ? " is-active" : ""}`, "data-act": "hit-go", "data-arg": i },
              h("span", {}, "\u2026 " + x.before, h("span", { class: "ep-hit-match" }, x.match), x.after + " \u2026")
            );
          }))
        ))
      )
    );
  }
  var avatar = (name, color) => h("div", { class: `ep-avatar ${color}` }, name.charAt(0).toUpperCase());
  function itemMenu(id) {
    const canEdit = categoryEnabled("comment-edit"), canDelete = categoryEnabled("comment-delete");
    if (!canEdit && !canDelete) return null;
    return h(
      "div",
      { class: "ep-anchor" },
      h("button", { type: "button", class: "ep-card-menu", "aria-label": "Menu", "data-act": "comment-menu", "data-arg": id, "data-menu-trigger": "1" }, icon("dots", { size: 16 })),
      S.commentMenu === id ? h(
        "div",
        { class: "ep-menu ep-menu-small", role: "menu" },
        canEdit ? h("button", { type: "button", class: "ep-menu-item", "data-act": "comment-edit", "data-arg": id }, h("span", { class: "ep-menu-label" }, "Edit")) : null,
        canDelete ? h("button", { type: "button", class: "ep-menu-item", "data-act": "comment-delete", "data-arg": id }, h("span", { class: "ep-menu-label" }, "Delete")) : null
      ) : null
    );
  }
  function editForm(id, text) {
    return h(
      "div",
      { class: "ep-card-edit" },
      h("textarea", { class: "ep-textarea", rows: 3, "data-focus": "comment-edit", "data-in": "comment-text", "data-arg": id }, text),
      h(
        "div",
        { class: "ep-card-edit-actions" },
        h("button", { type: "button", class: "ep-secondary-btn ep-sm", "data-act": "comment-cancel" }, "Cancel"),
        h("button", { type: "button", class: "ep-primary-btn ep-sm", "data-act": "comment-save", "data-arg": id }, "Save")
      )
    );
  }
  function replyItem(r) {
    const editing = S.editingComment === r.id;
    return h(
      "div",
      { class: "ep-reply" },
      avatar(r.author, r.color),
      h(
        "div",
        { class: "ep-card-main" },
        h(
          "div",
          { class: "ep-card-head" },
          h("div", { class: "ep-card-author" }, h("h5", {}, r.author), h("span", {}, r.date)),
          itemMenu(r.id)
        ),
        editing ? editForm(r.id, r.text) : h("p", { class: "ep-card-text" }, r.text)
      )
    );
  }
  function replyForm(c2) {
    var _a;
    const draft = (_a = S.replyDraft[c2.id]) != null ? _a : "";
    return h(
      "div",
      { class: "ep-reply-form", "data-act": "noop" },
      h("input", { type: "text", class: "ep-reply-field", placeholder: "Add reply", value: draft, "aria-label": "Add reply", autocomplete: "off", "data-in": "reply-text", "data-arg": c2.id, "data-focus": `reply-${c2.id}` }),
      h("button", { type: "button", class: "ep-reply-send", "aria-label": "Send reply", "data-act": "reply-send", "data-arg": c2.id, ...draft.trim() ? {} : { disabled: true } }, icon("send", { size: 20 }))
    );
  }
  function commentCard(c2) {
    var _a;
    const editing = S.editingComment === c2.id;
    const selected = !!c2.annId && S.selected === c2.annId;
    const replies = (_a = c2.replies) != null ? _a : [];
    return h(
      "div",
      { class: `ep-card${selected ? " is-selected" : ""}`, "data-act": "comment-go", "data-arg": c2.id },
      h(
        "div",
        { class: "ep-card-body" },
        h(
          "div",
          { class: "ep-card-row" },
          avatar(c2.author, c2.color),
          h(
            "div",
            { class: "ep-card-main" },
            h(
              "div",
              { class: "ep-card-head" },
              h("div", { class: "ep-card-author" }, h("h4", {}, c2.author), h("span", {}, c2.date)),
              itemMenu(c2.id)
            ),
            editing ? editForm(c2.id, c2.text) : h("p", { class: "ep-card-text" }, c2.text)
          )
        ),
        replies.length ? h("div", { class: "ep-reply-list" }, replies.map(replyItem)) : null,
        categoryEnabled("comment-reply") && !editing ? replyForm(c2) : null
      )
    );
  }
  function commentPanel(d) {
    if (!d.comments.length)
      return h(
        "div",
        { class: "ep-comments ep-comments-empty" },
        h("div", { class: "ep-empty-icon small" }, icon("comment", { size: 28 })),
        h("p", { class: "ep-card-text" }, "No comments yet."),
        h("p", { class: "ep-hint" }, "Switch to Annotate and pick the comment tool, then click on a page.")
      );
    const pages = [...new Set(d.comments.map((c2) => c2.page))].sort((a, b) => a - b);
    return h("div", { class: "ep-comments", "data-scroll": "right" }, pages.map((p) => {
      const list = d.comments.filter((c2) => c2.page === p);
      return h(
        "div",
        { class: "ep-comment-page" },
        h("div", { class: "ep-comment-page-head" }, h("h3", {}, `Page ${p}`), h("p", {}, `${list.length} comment${list.length === 1 ? "" : "s"}`)),
        h("div", { class: "ep-comment-list" }, list.map(commentCard))
      );
    }));
  }
  var SWATCHES = ["#E44234", "#FF9500", "#FFCD45", "#34C759", "#00C7BE", "#3B82F6", "#AF52DE", "#FF2D92", "#8E8E93", "#000000"];
  var BLENDS = ["normal", "multiply", "screen", "overlay", "darken", "lighten"];
  var NO_WIDTH = ["highlight", "text", "insertText", "comment", "stamp", "signature", "attachment", "image", "field", "redact"];
  var HAS_BLEND = ["highlight", "inkhl"];
  function styleTarget(d) {
    var _a;
    const ann = (_a = d.anns.find((a) => a.id === S.selected)) != null ? _a : null;
    if (ann) return { type: ann.type, style: ann, ann };
    if (S.tool && TOOLS[S.tool]) return { type: TOOLS[S.tool].type, style: defaultFor(TOOLS[S.tool].type), ann: null };
    return null;
  }
  function section(label, value, control, valueId) {
    return h(
      "div",
      { class: "ep-style-section" },
      h("div", { class: "ep-style-label-row" }, h("label", { class: "ep-style-label" }, label), value ? h("span", { class: "ep-style-value", id: valueId }, value) : null),
      control
    );
  }
  function stylePanel(d) {
    var _a;
    const t = styleTarget(d);
    if (!t) return h("div", { class: "ep-style" }, h("h3", { class: "ep-style-title" }, "Annotation Styles"), h("p", { class: "ep-hint" }, "Pick an annotation tool or select an annotation on the page to edit its style."));
    const s2 = t.style;
    return h(
      "div",
      { class: "ep-style" },
      h("h3", { class: "ep-style-title" }, `${(_a = TYPE_LABEL[t.type]) != null ? _a : t.type} Styles`),
      section("Color", null, h("div", { class: "ep-swatches" }, SWATCHES.map((c2) => h("button", { type: "button", class: `ep-swatch${c2.toLowerCase() === s2.color.toLowerCase() ? " is-selected" : ""}`, style: `background:${c2}`, "aria-label": c2, "data-act": "style-color", "data-arg": c2 })))),
      section("Opacity", `${Math.round(s2.opacity * 100)}%`, h("input", { class: "ep-range", type: "range", min: 10, max: 100, value: Math.round(s2.opacity * 100), "data-in": "style-opacity" }), "style-opacity-v"),
      NO_WIDTH.includes(t.type) ? null : section("Stroke width", `${s2.width}px`, h("input", { class: "ep-range", type: "range", min: 1, max: 24, value: s2.width, "data-in": "style-width" }), "style-width-v"),
      HAS_BLEND.includes(t.type) ? section("Blend mode", null, h("select", { class: "ep-select", "data-in": "style-blend" }, BLENDS.map((b) => h("option", { value: b, selected: b === s2.blend }, b.charAt(0).toUpperCase() + b.slice(1))))) : null
    );
  }
  function redactionPanel(d) {
    const items = d.anns.filter((a) => a.type === "redact" && !a.applied);
    return h(
      "div",
      { class: "ep-style ep-redaction" },
      h("h3", { class: "ep-style-title" }, "Redactions"),
      items.length ? h("div", { class: "ep-red-list" }, items.map((a) => h(
        "div",
        { class: "ep-red-item" },
        h("span", {}, `Page ${a.page}`),
        h(
          "div",
          { class: "ep-red-actions" },
          h("button", { type: "button", class: "ep-secondary-btn ep-sm", "data-act": "redact-apply", "data-arg": a.id }, "Apply"),
          h("button", { type: "button", class: "ep-btn", "aria-label": "Delete", "data-act": "ann-delete", "data-arg": a.id }, icon("x", { size: 16 }))
        )
      ))) : h("p", { class: "ep-hint" }, "No pending redactions. Use the Redact tool to drag over an area of a page."),
      items.length ? h(
        "div",
        { class: "ep-red-footer" },
        h("button", { type: "button", class: "ep-secondary-btn", "data-act": "redact-clear" }, "Clear all"),
        h("button", { type: "button", class: "ep-primary-btn", "data-act": "redact-apply-all" }, "Apply all")
      ) : null
    );
  }
  function rightSidebar(d) {
    const body2 = S.right === "search" ? searchPanel(d) : S.right === "comment" ? commentPanel(d) : S.right === "style" ? stylePanel(d) : redactionPanel(d);
    return h("aside", { class: "ep-sidebar ep-sidebar-right" }, body2);
  }

  // src/components/drawer.ts
  var PCT = { closed: 0, half: 50, full: 100 };
  var ANIMATION_MS = 300;
  var VELOCITY_THRESHOLD = 0.5;
  var SNAP_FULL_ABOVE = 75;
  var SNAP_CLOSE_BELOW = 25;
  var TAP_SLOP = 5;
  var backdrop = h("div", { class: "ep-drawer-backdrop" });
  var body = h("div", { class: "ep-drawer-body" });
  var handle = h("div", { class: "ep-drawer-handle", "aria-hidden": "true" }, h("div", { class: "ep-drawer-grip" }));
  var sheet = h("div", { class: "ep-drawer", role: "dialog", "aria-modal": "true" }, handle, body);
  var drawerLayer = h("div", { class: "ep-drawer-layer" }, backdrop, sheet);
  var visible2 = false;
  var snap = "closed";
  var hideTimer = 0;
  var openToken = 0;
  var prevLeft = false;
  function normalizePanels(mobile) {
    if (mobile && S.leftOpen && S.right) {
      if (!prevLeft) S.right = null;
      else S.leftOpen = false;
    }
    prevLeft = S.leftOpen;
  }
  function closePanels() {
    update(() => {
      S.leftOpen = false;
      S.right = null;
    });
  }
  function paint(pct) {
    sheet.style.height = `${pct}%`;
    backdrop.style.opacity = String(Math.min(pct / PCT.half, 1) * 0.6);
    backdrop.style.pointerEvents = pct === 0 ? "none" : "auto";
  }
  function show() {
    window.clearTimeout(hideTimer);
    hideTimer = 0;
    if (visible2) {
      snap = snap === "closed" ? config.mobile.drawer.initialSnap : snap;
      paint(PCT[snap]);
      return;
    }
    visible2 = true;
    snap = "closed";
    drawerLayer.classList.add("is-visible");
    paint(0);
    void sheet.offsetHeight;
    const token2 = ++openToken;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token2 !== openToken || !visible2) return;
      snap = config.mobile.drawer.initialSnap;
      paint(PCT[snap]);
    }));
  }
  function hide(immediate = false) {
    if (!visible2) return;
    openToken++;
    snap = "closed";
    const finish = () => {
      hideTimer = 0;
      visible2 = false;
      drawerLayer.classList.remove("is-visible");
      body.replaceChildren();
    };
    if (immediate) {
      window.clearTimeout(hideTimer);
      finish();
      return;
    }
    paint(0);
    if (!hideTimer) hideTimer = window.setTimeout(finish, ANIMATION_MS);
  }
  function syncDrawer(d, mobile) {
    const panel = d && mobile ? S.right ? "right" : S.leftOpen ? "left" : null : null;
    if (!d || !panel) {
      hide(!mobile);
      return;
    }
    const el = panel === "left" ? leftSidebar(d) : rightSidebar(d);
    el.classList.add("in-drawer");
    body.replaceChildren(el);
    sheet.setAttribute("data-panel", panel === "left" ? "left" : S.right);
    show();
  }
  backdrop.addEventListener("click", closePanels);
  if (!config.mobile.drawer.resizable) handle.classList.add("is-static");
  var drag = null;
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !visible2 || !config.mobile.drawer.resizable) return;
    const total = drawerLayer.clientHeight || 1;
    drag = { id: e.pointerId, startY: e.clientY, startPct: sheet.offsetHeight / total * 100, moved: false, samples: [{ y: e.clientY, t: performance.now() }] };
    handle.setPointerCapture(e.pointerId);
    sheet.classList.add("is-dragging");
    backdrop.classList.add("is-dragging");
    e.preventDefault();
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const total = drawerLayer.clientHeight || 1;
    if (Math.abs(e.clientY - drag.startY) >= TAP_SLOP) drag.moved = true;
    const pct = Math.max(0, Math.min(100, drag.startPct + (drag.startY - e.clientY) / total * 100));
    const now = performance.now();
    drag.samples.push({ y: e.clientY, t: now });
    while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
    paint(pct);
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    sheet.classList.remove("is-dragging");
    backdrop.classList.remove("is-dragging");
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    const total = drawerLayer.clientHeight || 1;
    const current = sheet.offsetHeight / total * 100;
    if (!d.moved) {
      paint(PCT[snap]);
      return;
    }
    const first = d.samples[0], last = d.samples[d.samples.length - 1];
    const dt = last.t - first.t;
    const velocity = dt > 0 ? (last.y - first.y) / dt : 0;
    let next;
    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      next = velocity > 0 ? current > PCT.half ? "half" : "closed" : current < PCT.half ? "half" : "full";
    } else if (current >= SNAP_FULL_ABOVE) next = "full";
    else if (current <= SNAP_CLOSE_BELOW) next = "closed";
    else next = "half";
    if (next === "closed") {
      closePanels();
      return;
    }
    snap = next;
    paint(PCT[next]);
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  // src/components/menuSheet.ts
  var ANIMATION_MS2 = 300;
  var VELOCITY_THRESHOLD2 = 0.5;
  var MIN_DRAG_DISTANCE = 5;
  var CLOSE_THRESHOLD = 30;
  var backdrop2 = h("div", { class: "ep-sheet-backdrop" });
  var content = h("div", { class: "ep-sheet-content" });
  var handle2 = h("div", { class: "ep-sheet-handle", "aria-hidden": "true" }, h("div", { class: "ep-drawer-grip" }));
  var sheet2 = h("div", { class: "ep-menu-sheet", role: "dialog", "aria-modal": "true" }, handle2, content);
  var menuSheetLayer = h("div", { class: "ep-sheet-layer" }, backdrop2, sheet2);
  var visible3 = false;
  var hideTimer2 = 0;
  var token = 0;
  function paint2(open) {
    sheet2.style.transform = open ? "translateY(0)" : "translateY(100%)";
    backdrop2.style.opacity = open ? "1" : "0";
  }
  function show2() {
    if (hideTimer2) {
      window.clearTimeout(hideTimer2);
      hideTimer2 = 0;
      paint2(true);
      return;
    }
    if (visible3) return;
    visible3 = true;
    menuSheetLayer.classList.add("is-visible");
    paint2(false);
    void sheet2.offsetHeight;
    const t = ++token;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (t === token && visible3) paint2(true);
    }));
  }
  function hide2(immediate) {
    if (!visible3) return;
    token++;
    const finish = () => {
      hideTimer2 = 0;
      visible3 = false;
      menuSheetLayer.classList.remove("is-visible");
      content.replaceChildren();
    };
    if (immediate) {
      window.clearTimeout(hideTimer2);
      finish();
      return;
    }
    paint2(false);
    if (!hideTimer2) hideTimer2 = window.setTimeout(finish, ANIMATION_MS2);
  }
  function syncMenuSheet(active) {
    const menu = active && S.menu ? sheetMenu() : null;
    if (!menu) {
      hide2(!active);
      return;
    }
    content.replaceChildren(menu);
    show2();
  }
  var close = () => update(() => {
    S.menu = null;
  });
  backdrop2.addEventListener("click", close);
  var drag2 = null;
  handle2.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !visible3) return;
    drag2 = { id: e.pointerId, startY: e.clientY, startT: performance.now(), height: sheet2.offsetHeight || 1, offset: 0, moved: false };
    handle2.setPointerCapture(e.pointerId);
    sheet2.classList.add("is-dragging");
    e.preventDefault();
  });
  handle2.addEventListener("pointermove", (e) => {
    if (!drag2 || e.pointerId !== drag2.id) return;
    const dy = e.clientY - drag2.startY;
    if (Math.abs(dy) >= MIN_DRAG_DISTANCE) drag2.moved = true;
    drag2.offset = Math.max(0, dy);
    sheet2.style.transform = `translateY(${drag2.offset}px)`;
  });
  function endDrag2(e) {
    if (!drag2 || e.pointerId !== drag2.id) return;
    const d = drag2;
    drag2 = null;
    sheet2.classList.remove("is-dragging");
    if (handle2.hasPointerCapture(e.pointerId)) handle2.releasePointerCapture(e.pointerId);
    if (!d.moved) {
      paint2(true);
      return;
    }
    const percent = d.offset / d.height * 100;
    const dt = performance.now() - d.startT;
    const velocity = dt > 0 ? d.offset / dt : 0;
    if (percent > CLOSE_THRESHOLD || velocity > VELOCITY_THRESHOLD2) close();
    else paint2(true);
  }
  handle2.addEventListener("pointerup", endDrag2);
  handle2.addEventListener("pointercancel", endDrag2);

  // src/enforce.ts
  var MODES = ["view", "annotate", "shapes", "insert", "form", "redact"];
  var PANEL_CMD = { search: "panel:toggle-search", comment: "panel:toggle-comment", style: "panel:toggle-annotation-style", redaction: "panel:toggle-redaction" };
  function enforceFeatures() {
    if (!isEnabled(`mode:${S.mode}`)) {
      const next = MODES.find((m) => isEnabled(`mode:${m}`));
      if (next) S.mode = next;
      S.tool = null;
    }
    if (S.tool && !isEnabled(S.tool)) S.tool = null;
    if (S.right && !isEnabled(PANEL_CMD[S.right])) S.right = null;
    if (S.leftOpen && !isEnabled("panel:toggle-sidebar")) S.leftOpen = false;
    if (S.leftTab === "thumbnails" && !categoryEnabled("sidebar-thumbnails")) S.leftTab = "outline";
    if (S.leftTab === "outline" && !categoryEnabled("sidebar-outline")) S.leftTab = "thumbnails";
    if (S.menu && !menuAvailable(S.menu)) S.menu = null;
    if (S.modal === "print" && !isEnabled("document:print")) S.modal = null;
    if (S.modal === "protect" && !isEnabled("document:protect")) S.modal = null;
    if (S.modal === "signature" && !isEnabled("insert:add-signature")) S.modal = null;
  }

  // src/components/modals.ts
  function frame(title, body2, footer2) {
    return h(
      "div",
      { class: "ep-modal-backdrop", "data-act": "modal-backdrop" },
      h(
        "div",
        { class: "ep-dialog", role: "dialog", "aria-modal": true },
        h(
          "div",
          { class: "ep-dialog-header" },
          h("h2", {}, title),
          h("button", { type: "button", class: "ep-btn", "aria-label": "Close", "data-act": "modal-close" }, icon("x", { size: 20 }))
        ),
        h("div", { class: "ep-dialog-content" }, body2, footer2)
      )
    );
  }
  var footer = (primary, act, busy = false) => h(
    "div",
    { class: "ep-dialog-footer" },
    h("button", { type: "button", class: "ep-secondary-btn", "data-act": "modal-close" }, "Cancel"),
    h("button", { type: "button", class: "ep-primary-btn", "data-act": act, disabled: busy }, busy ? "Preparing\u2026" : primary)
  );
  function radio(label, value, extra) {
    return h(
      "label",
      { class: "ep-radio" },
      h("input", { type: "radio", name: "pageRange", checked: S.print.range === value, "data-in": "print-range", value }),
      h("div", { class: "ep-radio-body" }, h("span", {}, label), extra)
    );
  }
  function printModal() {
    const d = doc();
    const body2 = h(
      "div",
      { class: "ep-form" },
      h(
        "div",
        {},
        h("label", { class: "ep-form-label" }, "Pages to print"),
        h(
          "div",
          { class: "ep-form-stack" },
          radio("All pages", "all"),
          radio(`Current page (${d.page})`, "current"),
          radio("Specify pages", "specify", S.print.range === "specify" ? h("input", { class: "ep-text-input", type: "text", placeholder: "e.g., 1-3, 5, 8-10", value: S.print.spec, "data-in": "print-spec", "data-focus": "print-spec" }) : void 0)
        ),
        h("p", { class: "ep-form-hint" }, `Total pages in document: ${d.pages}`)
      ),
      h("label", { class: "ep-check-line" }, h("input", { type: "checkbox", checked: S.print.annotations, "data-in": "print-ann" }), h("span", {}, "Include annotations"))
    );
    return frame("Print Settings", body2, footer("Print", "print-do", S.print.busy));
  }
  function protectModal() {
    const body2 = h(
      "div",
      { class: "ep-form" },
      h("label", { class: "ep-check-line" }, h("input", { type: "checkbox", checked: S.protect.openPw, "data-in": "protect-open" }), h("span", {}, "Require a password to open")),
      S.protect.openPw ? h("input", { class: "ep-text-input", type: "password", placeholder: "Password" }) : null,
      h("label", { class: "ep-check-line" }, h("input", { type: "checkbox", checked: S.protect.perms, "data-in": "protect-perms" }), h("span", {}, "Restrict permissions")),
      S.protect.perms ? h(
        "div",
        { class: "ep-form-stack ep-indent" },
        ...["Printing", "Copying text", "Editing", "Annotating"].map((p) => h("label", { class: "ep-check-line" }, h("input", { type: "checkbox", checked: true }), h("span", {}, `Allow ${p.toLowerCase()}`)))
      ) : null
    );
    return frame("Document Security", body2, footer("Apply", "protect-do"));
  }
  function signatureModal() {
    const body2 = h(
      "div",
      { class: "ep-form" },
      h(
        "div",
        {},
        h("label", { class: "ep-form-label" }, "Type your name"),
        h("input", { class: "ep-text-input", type: "text", placeholder: "Your name", value: S.sigText, "data-in": "sig-text", "data-focus": "sig" })
      ),
      h("div", { class: "ep-sig-preview", id: "sig-preview" }, S.sigText || "Signature")
    );
    return frame("Add Signature", body2, footer("Create", "sig-do"));
  }

  // src/components/tooltip.ts
  function setupTooltips(root2) {
    let timer2;
    let bubble = null;
    const hide3 = () => {
      window.clearTimeout(timer2);
      bubble == null ? void 0 : bubble.remove();
      bubble = null;
    };
    root2.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-tip]");
      hide3();
      if (!el || el.disabled) return;
      timer2 = window.setTimeout(() => {
        bubble = document.createElement("div");
        bubble.className = "ep-tooltip";
        bubble.textContent = el.getAttribute("data-tip");
        document.body.appendChild(bubble);
        const r = el.getBoundingClientRect();
        const bw = bubble.offsetWidth;
        bubble.style.left = `${Math.max(4, Math.min(window.innerWidth - bw - 4, r.left + r.width / 2 - bw / 2))}px`;
        bubble.style.top = `${r.bottom + 6}px`;
      }, 450);
    });
    root2.addEventListener("mouseout", hide3);
    root2.addEventListener("pointerdown", hide3);
    root2.addEventListener("scroll", hide3, true);
  }

  // src/actions.ts
  function showHit(d, i) {
    const hits = hitsFor(d);
    if (!hits.length) return;
    S.search.active = (i + hits.length) % hits.length;
    S.scrollHit = true;
    goToPage(hits[S.search.active].page);
  }
  function applyStyle(patch, live = false) {
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
  function onClick(e) {
    var _a;
    const t = e.target;
    const el = t.closest("[data-act],[data-command]");
    if (!el) return;
    const cmdId = el.getAttribute("data-command");
    if (cmdId) {
      execute(cmdId);
      return;
    }
    const act = el.getAttribute("data-act");
    const arg = (_a = el.getAttribute("data-arg")) != null ? _a : "";
    const d = doc();
    switch (act) {
      case "tab-select":
        update(() => {
          var _a2, _b;
          S.active = arg;
          S.selected = null;
          S.pending = { page: (_b = (_a2 = doc()) == null ? void 0 : _a2.page) != null ? _b : 1 };
        });
        break;
      case "tab-close":
        if (isEnabled("document:close")) update(() => closeDoc(arg));
        break;
      case "tab-add":
        if (isEnabled("document:open")) openDocFromPicker();
        break;
      case "left-tab":
        update(() => {
          S.leftTab = arg;
        });
        break;
      case "thumb":
      case "outline-go":
        update(() => goToPage(Number(arg)));
        break;
      case "outline-toggle":
        update(() => {
          S.outlineOpen[arg] = el.getAttribute("data-open") !== "true";
        });
        break;
      case "menu-go":
        update(() => {
          S.menu = arg;
        });
        break;
      case "search-clear":
        update(() => {
          S.search.q = "";
          S.search.active = 0;
          S.focusKey = "search";
        });
        break;
      case "search-next":
        if (d) update(() => showHit(d, S.search.active + 1));
        break;
      case "search-prev":
        if (d) update(() => showHit(d, S.search.active - 1));
        break;
      case "hit-go":
        if (d) update(() => showHit(d, Number(arg)));
        break;
      case "comment-go": {
        const c2 = d == null ? void 0 : d.comments.find((x) => x.id === arg);
        if (c2) update(() => {
          var _a2;
          const wasSelected = !!c2.annId && S.selected === c2.annId;
          goToPage(c2.page);
          S.selected = (_a2 = c2.annId) != null ? _a2 : null;
          if (!wasSelected && categoryEnabled("comment-reply") && matchMedia("(pointer: fine)").matches) S.focusKey = `reply-${c2.id}`;
        });
        break;
      }
      case "comment-menu":
        update(() => {
          S.commentMenu = S.commentMenu === arg ? null : arg;
        });
        break;
      case "comment-edit":
        if (!categoryEnabled("comment-edit")) break;
        update(() => {
          S.editingComment = arg;
          S.commentMenu = null;
          S.focusKey = "comment-edit";
        });
        break;
      case "comment-cancel":
        update(() => {
          S.editingComment = null;
        });
        break;
      case "comment-save": {
        const ta = document.querySelector('textarea[data-in="comment-text"]');
        const found = findEntry(d, arg);
        update(() => {
          if (found && ta && ta.value.trim()) found.item.text = ta.value.trim();
          S.editingComment = null;
        });
        break;
      }
      case "noop":
        break;
      // clicks inside the reply form must not select the card
      case "reply-send":
        sendReply(arg);
        break;
      case "comment-delete": {
        if (!categoryEnabled("comment-delete")) break;
        const found = findEntry(d, arg);
        update(() => {
          var _a2;
          if (!d || !found) return;
          if (found.parent) found.parent.replies = ((_a2 = found.parent.replies) != null ? _a2 : []).filter((x) => x.id !== arg);
          else {
            const c2 = found.item;
            if (c2.annId) removeAnn(d, c2.annId);
            else d.comments = d.comments.filter((x) => x.id !== arg);
          }
          S.commentMenu = null;
        });
        break;
      }
      case "style-color":
        update(() => applyStyle({ color: arg }));
        break;
      case "ann-delete":
        if (d) update(() => removeAnn(d, arg));
        break;
      case "redact-apply":
        if (d) update(() => {
          pushHistory(d);
          const a = d.anns.find((x) => x.id === arg);
          if (a) a.applied = true;
        });
        break;
      case "redact-apply-all":
        if (d) update(() => {
          pushHistory(d);
          d.anns.forEach((a) => {
            if (a.type === "redact") a.applied = true;
          });
        });
        toast("Redactions applied");
        break;
      case "redact-clear":
        if (d) update(() => {
          pushHistory(d);
          d.anns = d.anns.filter((a) => !(a.type === "redact" && !a.applied));
        });
        break;
      case "modal-backdrop":
        if (t === el) update(() => {
          S.modal = null;
        });
        break;
      case "modal-close":
        update(() => {
          S.modal = null;
        });
        break;
      case "print-do":
        update(() => {
          S.print.busy = true;
        });
        window.setTimeout(() => {
          update(() => {
            S.modal = null;
            S.print.busy = false;
          });
          toast("Sent to printer (demo only)");
        }, 900);
        break;
      case "protect-do":
        update(() => {
          S.modal = null;
        });
        toast("Security settings applied (demo)");
        break;
      case "sig-do":
        update(() => {
          S.sigText = S.sigText.trim() || "Signature";
          S.modal = null;
          activateTool("insert:add-signature");
        });
        break;
    }
  }
  function findEntry(d, id) {
    var _a;
    if (!d) return null;
    for (const c2 of d.comments) {
      if (c2.id === id) return { item: c2, parent: null };
      const r = (_a = c2.replies) == null ? void 0 : _a.find((x) => x.id === id);
      if (r) return { item: r, parent: c2 };
    }
    return null;
  }
  function sendReply(id) {
    var _a, _b;
    const d = doc();
    const c2 = d == null ? void 0 : d.comments.find((x) => x.id === id);
    if (!d || !c2 || !categoryEnabled("comment-reply")) return;
    const input = document.querySelector(`input[data-in="reply-text"][data-arg="${id}"]`);
    const text = ((_b = (_a = input == null ? void 0 : input.value) != null ? _a : S.replyDraft[id]) != null ? _b : "").trim();
    if (!text) return;
    update(() => {
      var _a2;
      ((_a2 = c2.replies) != null ? _a2 : c2.replies = []).push({ id: uid("r"), author: "You", date: today(), text, color: "bg-blue" });
      delete S.replyDraft[id];
      S.focusKey = `reply-${id}`;
    });
  }
  function onInput(e) {
    var _a, _b;
    const el = e.target;
    const key = (_a = el.getAttribute) == null ? void 0 : _a.call(el, "data-in");
    if (!key) return;
    const d = doc();
    const live = (id, text) => {
      const n = document.getElementById(id);
      if (n) n.textContent = text;
    };
    switch (key) {
      case "reply-text": {
        const id = el.getAttribute("data-arg");
        S.replyDraft[id] = el.value;
        const btn = (_b = el.parentElement) == null ? void 0 : _b.querySelector(".ep-reply-send");
        if (btn) btn.disabled = !el.value.trim();
        return;
      }
      case "search-q":
        S.search.q = el.value;
        S.search.active = 0;
        S.focusKey = "search";
        update(() => {
          if (d) {
            const hs = hitsFor(d);
            if (hs.length) {
              S.scrollHit = true;
              goToPage(hs[0].page);
            }
          }
        });
        break;
      case "style-opacity":
        applyStyle({ opacity: Number(el.value) / 100 }, true);
        live("style-opacity-v", `${el.value}%`);
        break;
      case "style-width":
        applyStyle({ width: Number(el.value) }, true);
        live("style-width-v", `${el.value}px`);
        break;
      case "style-blend":
        applyStyle({ blend: el.value });
        break;
      case "print-spec":
        S.print.spec = el.value;
        break;
      case "sig-text":
        S.sigText = el.value;
        live("sig-preview", el.value || "Signature");
        break;
    }
  }
  function onChange(e) {
    var _a;
    const el = e.target;
    const key = (_a = el.getAttribute) == null ? void 0 : _a.call(el, "data-in");
    if (!key) return;
    const d = doc();
    switch (key) {
      case "search-case":
        update(() => {
          S.search.matchCase = el.checked;
          S.search.active = 0;
        });
        break;
      case "search-word":
        update(() => {
          S.search.wholeWord = el.checked;
          S.search.active = 0;
        });
        break;
      case "print-range":
        update(() => {
          S.print.range = el.value;
        });
        break;
      case "print-ann":
        S.print.annotations = el.checked;
        break;
      case "protect-open":
        update(() => {
          S.protect.openPw = el.checked;
        });
        break;
      case "protect-perms":
        update(() => {
          S.protect.perms = el.checked;
        });
        break;
      case "zoom": {
        const n = parseInt(el.value, 10);
        update(() => {
          if (!isNaN(n)) setZoom(n);
        });
        break;
      }
      case "page": {
        const n = parseInt(el.value, 10);
        update(() => {
          if (d && !isNaN(n)) goToPage(n);
        });
        break;
      }
    }
  }
  var typing = (t) => /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
  function onKeydown(e) {
    const t = e.target;
    const d = doc();
    if (e.key === "Escape") {
      if (t.isContentEditable) t.blur();
      update(() => {
        if (S.modal) S.modal = null;
        else if (S.menu || S.commentMenu) {
          S.menu = null;
          S.commentMenu = null;
        } else if (S.editingComment) S.editingComment = null;
        else if (useDrawerMode() && (S.leftOpen || S.right)) {
          S.leftOpen = false;
          S.right = null;
        } else if (S.selected) S.selected = null;
        else if (S.tool || S.pointerTool !== "pointer") {
          S.tool = null;
          S.pointerTool = "pointer";
        }
      });
      return;
    }
    if (typing(t)) {
      const key = t.getAttribute("data-in");
      if (e.key === "Enter" && (key === "zoom" || key === "page")) {
        e.preventDefault();
        onChange(e);
      } else if (e.key === "Enter" && key === "reply-text") {
        e.preventDefault();
        sendReply(t.getAttribute("data-arg"));
      } else if (e.key === "Enter" && key === "search-q" && d) {
        e.preventDefault();
        update(() => showHit(d, S.search.active + (e.shiftKey ? -1 : 1)));
        S.focusKey = "search";
      } else if (e.key === "Enter" && t.hasAttribute("data-editable") === false && t.isContentEditable) {
        e.preventDefault();
        t.blur();
      }
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "f") {
      e.preventDefault();
      if (isEnabled("panel:toggle-search")) update(() => {
        S.right = "search";
        S.focusKey = "search";
      });
    } else if (mod && e.key.toLowerCase() === "p") {
      e.preventDefault();
      execute("document:print");
    } else if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      execute(e.shiftKey ? "history:redo" : "history:undo");
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      execute("history:redo");
    } else if (mod && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      execute("zoom:in");
    } else if (mod && e.key === "-") {
      e.preventDefault();
      execute("zoom:out");
    } else if ((e.key === "Delete" || e.key === "Backspace") && S.selected && d) {
      e.preventDefault();
      update(() => removeAnn(d, S.selected));
    }
  }

  // src/interactions.ts
  var drag3 = null;
  var hideTimer3;
  var pageEl = (n) => document.querySelector(`.ep-page[data-page="${n}"]`);
  function toPage(e, el) {
    const r = el.getBoundingClientRect();
    const W = el.offsetWidth, H = el.offsetHeight;
    const a = -S.rotation * Math.PI / 180;
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a);
    return { x: Math.max(0, Math.min(1, (x + W / 2) / W)), y: Math.max(0, Math.min(1, (y + H / 2) / H)) };
  }
  function flashControls() {
    const el = document.querySelector(".ep-overlay");
    if (!el) return;
    el.classList.add("is-visible");
    window.clearTimeout(hideTimer3);
    hideTimer3 = window.setTimeout(() => el.classList.remove("is-visible"), 2500);
  }
  function syncPageUI() {
    const d = doc();
    if (!d) return;
    const input = document.querySelector(".ep-page-input");
    if (input && document.activeElement !== input) input.value = String(d.page);
    document.querySelectorAll(".ep-thumb-frame").forEach((f) => f.classList.toggle("is-current", Number(f.getAttribute("data-thumb")) === d.page));
    const prev = document.querySelector('[data-command="scroll:previous-page"]');
    const next = document.querySelector('[data-command="scroll:next-page"]');
    prev == null ? void 0 : prev.classList.toggle("is-disabled", d.page <= 1);
    if (prev) prev.disabled = d.page <= 1;
    next == null ? void 0 : next.classList.toggle("is-disabled", d.page >= d.pages);
    if (next) next.disabled = d.page >= d.pages;
  }
  function onScroll(e) {
    var _a;
    const vp = e.target;
    if (!((_a = vp.classList) == null ? void 0 : _a.contains("ep-viewport"))) return;
    const d = doc();
    if (!d) return;
    const vr = vp.getBoundingClientRect();
    let best = d.page, bestArea = -1;
    vp.querySelectorAll(".ep-page-box").forEach((b) => {
      const r = b.getBoundingClientRect();
      const w = Math.min(r.right, vr.right) - Math.max(r.left, vr.left);
      const h2 = Math.min(r.bottom, vr.bottom) - Math.max(r.top, vr.top);
      const area = Math.max(0, w) * Math.max(0, h2);
      if (area > bestArea) {
        bestArea = area;
        best = Number(b.getAttribute("data-page-box"));
      }
    });
    if (best !== d.page) {
      d.page = best;
      syncPageUI();
    }
    flashControls();
  }
  function startEdit(id) {
    {
      const el = document.querySelector(`[data-editable="${id}"]`);
      if (!el) return;
      el.contentEditable = "true";
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel == null ? void 0 : sel.removeAllRanges();
      sel == null ? void 0 : sel.addRange(range);
    }
  }
  function create(page, def, p) {
    const st2 = defaultFor(def.type);
    return { id: uid("a"), page, type: def.type, kind: def.kind, x: p.x, y: p.y, w: 0, h: 0, ...st2 };
  }
  function placeClickTool(toolId, def, page, p) {
    const d = doc();
    const a = create(page, def, p);
    switch (def.type) {
      case "text":
        Object.assign(a, { w: 0.28, h: 0.04, text: "Text" });
        break;
      case "insertText":
        Object.assign(a, { w: 0.28, h: 0.04, text: "Inserted text" });
        break;
      case "callout":
        Object.assign(a, { x: Math.min(0.7, p.x + 0.06), y: Math.max(0.02, p.y - 0.09), w: 0.26, h: 0.05, text: "Callout", pts: [[p.x, p.y]] });
        break;
      case "comment":
        a.commentId = uid("c");
        break;
      case "stamp":
        a.text = STAMPS[S.stampIdx++ % STAMPS.length];
        break;
      case "signature":
        a.text = S.sigText || "Signature";
        break;
      case "field":
        Object.assign(a, { w: 0.032, h: 0.023 });
        break;
      case "image":
        return placeImage(page, p);
    }
    pushHistory(d);
    d.anns.push(a);
    if (def.type === "comment") {
      d.comments.push({ id: a.commentId, page, annId: a.id, author: "You", date: today(), text: "New comment", color: "bg-blue" });
    }
    update(() => {
      if (def.type === "comment") {
        S.right = "comment";
        S.editingComment = a.commentId;
        S.focusKey = "comment-edit";
        S.tool = null;
      }
      if (["text", "insertText", "callout"].includes(def.type)) S.selected = a.id;
    });
    if (["text", "insertText", "callout"].includes(def.type)) startEdit(a.id);
  }
  function placeImage(page, p) {
    pickFile("image/*", (files) => {
      const url = URL.createObjectURL(files[0]);
      const img = new Image();
      img.onload = () => {
        const w = 0.3, h2 = w / PAGE_RATIO * (img.naturalHeight / img.naturalWidth);
        const d = doc();
        const a = { ...create(page, TOOLS["insert:add-image"], p), w, h: h2, src: url };
        a.x = Math.min(p.x, 1 - w);
        a.y = Math.min(p.y, 1 - h2);
        pushHistory(d);
        d.anns.push(a);
        update(() => {
          S.selected = a.id;
          S.tool = null;
        });
      };
      img.src = url;
    });
  }
  function onDown(e) {
    var _a;
    const t = e.target;
    const ae = document.activeElement;
    if ((ae == null ? void 0 : ae.isContentEditable) && !t.closest('[contenteditable="true"]')) ae.blur();
    if ((S.menu || S.commentMenu) && !t.closest(".ep-menu") && !t.closest(".ep-menu-sheet") && !t.closest("[data-menu-trigger]")) {
      S.menu = null;
      S.commentMenu = null;
      update();
    }
    if (e.button !== 0) return;
    const vp = t.closest(".ep-viewport");
    if (!vp) return;
    const d = doc();
    if (!d) return;
    const el = t.closest(".ep-page");
    if (S.pointerTool === "pan") {
      drag3 = { kind: "pan", x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop, vp };
      (_a = document.querySelector(".ep-root")) == null ? void 0 : _a.classList.add("panning");
      e.preventDefault();
      return;
    }
    if (S.pointerTool === "marquee") {
      const wrap = vp.parentElement;
      const box = document.createElement("div");
      box.className = "ep-marquee";
      wrap.appendChild(box);
      drag3 = { kind: "marquee", x0: e.clientX, y0: e.clientY, el: box, wrap };
      e.preventDefault();
      return;
    }
    if (S.tool && TOOLS[S.tool] && !S.fillMode && el) {
      const def = TOOLS[S.tool];
      const page = Number(el.getAttribute("data-page"));
      const p = toPage(e, el);
      e.preventDefault();
      if (t.closest('[data-editable][contenteditable="true"]')) return;
      if (def.drag) {
        const ann = create(page, def, p);
        if (def.type === "ink" || def.type === "inkhl") ann.pts = [[p.x, p.y]];
        drag3 = { kind: "draw", def, page, start: p, ann };
      } else placeClickTool(S.tool, def, page, p);
      return;
    }
    if (t.closest(".ep-a-field.is-fill") || t.closest('[contenteditable="true"]')) return;
    const annEl = t.closest("[data-ann]");
    if (annEl && el) {
      const id = annEl.getAttribute("data-ann");
      const page = Number(el.getAttribute("data-page"));
      drag3 = { kind: "move", id, page, last: toPage(e, el), moved: false };
      if (S.selected !== id) update(() => {
        S.selected = id;
      });
      return;
    }
    if (S.selected) update(() => {
      S.selected = null;
    });
  }
  function onMove(e) {
    var _a;
    if (!drag3) return;
    if (drag3.kind === "pan") {
      drag3.vp.scrollLeft = drag3.sl - (e.clientX - drag3.x);
      drag3.vp.scrollTop = drag3.st - (e.clientY - drag3.y);
    } else if (drag3.kind === "marquee") {
      const r = drag3.wrap.getBoundingClientRect();
      const x = Math.min(e.clientX, drag3.x0) - r.left, y = Math.min(e.clientY, drag3.y0) - r.top;
      Object.assign(drag3.el.style, { left: `${x}px`, top: `${y}px`, width: `${Math.abs(e.clientX - drag3.x0)}px`, height: `${Math.abs(e.clientY - drag3.y0)}px` });
    } else if (drag3.kind === "draw") {
      const el = pageEl(drag3.page);
      if (!el) return;
      const p = toPage(e, el);
      const a = drag3.ann, s2 = drag3.start;
      if (a.type === "ink" || a.type === "inkhl") {
        a.pts.push([p.x, p.y]);
        Object.assign(a, bboxOf(a.pts));
      } else if (a.type === "line" || a.type === "arrow") {
        a.pts = [[s2.x, s2.y], [p.x, p.y]];
        Object.assign(a, bboxOf(a.pts));
      } else Object.assign(a, { x: Math.min(s2.x, p.x), y: Math.min(s2.y, p.y), w: Math.abs(p.x - s2.x), h: Math.abs(p.y - s2.y) });
      repaintLayer(drag3.page, a);
    } else if (drag3.kind === "move") {
      const d = doc(), el = pageEl(drag3.page);
      const moveId = drag3.id;
      const a = d == null ? void 0 : d.anns.find((x) => x.id === moveId);
      if (!d || !el || !a) return;
      const p = toPage(e, el);
      const dx = p.x - drag3.last.x, dy = p.y - drag3.last.y;
      if (!drag3.moved) {
        if (Math.abs(dx) + Math.abs(dy) < 2e-3) return;
        pushHistory(d);
        drag3.moved = true;
      }
      a.x += dx;
      a.y += dy;
      (_a = a.pts) == null ? void 0 : _a.forEach((q) => {
        q[0] += dx;
        q[1] += dy;
      });
      drag3.last = p;
      repaintLayer(drag3.page);
    }
  }
  function onUp(e) {
    var _a;
    if (!drag3) return;
    const dr = drag3;
    drag3 = null;
    (_a = document.querySelector(".ep-root")) == null ? void 0 : _a.classList.remove("panning");
    if (dr.kind === "marquee") {
      const rect = dr.el.getBoundingClientRect();
      dr.el.remove();
      const d = doc();
      const vp = document.querySelector(".ep-viewport");
      update(() => {
        S.pointerTool = "pointer";
        if (d && vp && rect.width > 8 && rect.height > 8) {
          const vr = vp.getBoundingClientRect();
          const factor = Math.min(vp.clientWidth / rect.width, vp.clientHeight / rect.height);
          const old = d.zoom;
          setZoom(old * factor);
          const k = d.zoom / old;
          S.pending = { left: (vp.scrollLeft + rect.left - vr.left) * k, top: (vp.scrollTop + rect.top - vr.top) * k };
        }
      });
    } else if (dr.kind === "draw") {
      const d = doc();
      const a = dr.ann;
      const tiny = a.w < 8e-3 && a.h < 8e-3;
      const markup = ["highlight", "underline", "strikeout", "squiggly", "replaceText", "ink", "inkhl", "line", "arrow"].includes(a.type);
      if (tiny && markup) {
        repaintLayer(dr.page);
        return;
      }
      if (tiny) {
        if (a.type === "field") Object.assign(a, { w: a.kind === "select" || a.kind === "textfield" ? 0.3 : 0.2, h: a.kind === "listbox" ? 0.07 : 0.03 });
        else Object.assign(a, { w: 0.14, h: 0.09 });
        a.x = Math.min(a.x, 1 - a.w);
        a.y = Math.min(a.y, 1 - a.h);
      }
      if (a.type === "field" && a.w < 0.05) Object.assign(a, { w: 0.2 });
      pushHistory(d);
      d.anns.push(a);
      update(() => {
        if (a.type === "redact") S.right = "redaction";
      });
    } else if (dr.kind === "move") {
      if (dr.moved) update();
    }
  }
  function setupInteractions(root2) {
    root2.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    root2.addEventListener("scroll", onScroll, true);
    root2.addEventListener("wheel", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const vp = e.target.closest(".ep-viewport");
      const d = doc();
      if (!vp || !d) return;
      e.preventDefault();
      if (!categoryEnabled("zoom")) return;
      update(() => {
        var _a, _b;
        return setZoom(e.deltaY < 0 ? (_a = ZOOMS.find((z) => z > d.zoom)) != null ? _a : 1600 : (_b = [...ZOOMS].reverse().find((z) => z < d.zoom)) != null ? _b : 25);
      });
    }, { passive: false });
    root2.addEventListener("dblclick", (e) => {
      const el = e.target.closest("[data-editable]");
      if (el && !S.tool) startEdit(el.getAttribute("data-editable"));
    });
    root2.addEventListener("focusout", (e) => {
      var _a, _b, _c;
      const el = e.target;
      const id = (_a = el.getAttribute) == null ? void 0 : _a.call(el, "data-editable");
      if (!id) return;
      const a = (_b = doc()) == null ? void 0 : _b.anns.find((x) => x.id === id);
      const text = ((_c = el.textContent) != null ? _c : "").replace(/^\u2038 /, "");
      if (a && a.text !== text) {
        pushHistory(doc());
        a.text = text;
      }
      el.contentEditable = "false";
    });
  }

  // src/main.ts
  var target = document.getElementById("pdf-viewer");
  var root = h("div", { class: "ep-root" });
  target.appendChild(root);
  function render() {
    var _a, _b, _c, _d, _e;
    const scrolls = {};
    root.querySelectorAll("[data-scroll]").forEach((el) => {
      scrolls[el.getAttribute("data-scroll")] = { l: el.scrollLeft, t: el.scrollTop, w: el.scrollWidth, h: el.scrollHeight };
    });
    const ae = document.activeElement;
    const focusKey = ae && root.contains(ae) ? (_a = ae.getAttribute) == null ? void 0 : _a.call(ae, "data-focus") : null;
    const sel = focusKey ? { s: ae.selectionStart, e: ae.selectionEnd } : null;
    const d = doc();
    enforceFeatures();
    const mobile = useDrawerMode();
    normalizePanels(mobile);
    const classes = ["ep-root"];
    if (isMobileWidth()) classes.push("is-mobile");
    if (S.pointerTool === "pan") classes.push("tool-pan");
    if (S.pointerTool === "marquee") classes.push("tool-marquee");
    if (S.tool && TOOLS[S.tool] && !S.fillMode) classes.push("tool-draw");
    root.className = classes.join(" ");
    const content2 = d ? h("div", { class: "ep-content" }, !mobile && S.leftOpen ? leftSidebar(d) : null, h("div", { class: "ep-main" }, viewport()), !mobile && S.right ? rightSidebar(d) : null) : h("div", { class: "ep-content" }, h("div", { class: "ep-main" }, emptyState()));
    const modal = S.modal === "print" && d ? printModal() : S.modal === "protect" ? protectModal() : S.modal === "signature" ? signatureModal() : null;
    const parts = [tabBar(), d ? mainToolbar() : null, d ? secondaryToolbar() : null, content2, modal];
    Array.from(root.children).forEach((c2) => {
      if (c2 !== drawerLayer && c2 !== menuSheetLayer) c2.remove();
    });
    const anchor2 = drawerLayer.parentNode === root ? drawerLayer : null;
    parts.forEach((n) => {
      if (n) root.insertBefore(n, anchor2);
    });
    if (!anchor2) root.append(drawerLayer, menuSheetLayer);
    syncDrawer(d, mobile);
    syncMenuSheet(useSheetMode());
    const pending = S.pending;
    S.pending = null;
    root.querySelectorAll("[data-scroll]").forEach((el) => {
      const key = el.getAttribute("data-scroll");
      const prev = scrolls[key];
      if (!prev) return;
      if (key === "viewport" && (pending == null ? void 0 : pending.ratio)) {
        el.scrollLeft = prev.l / prev.w * el.scrollWidth + (el.clientWidth ? 0 : 0);
        el.scrollTop = prev.t / prev.h * el.scrollHeight;
      } else {
        el.scrollLeft = prev.l;
        el.scrollTop = prev.t;
      }
    });
    const vp = root.querySelector(".ep-viewport");
    if (vp && pending) {
      if (pending.page !== void 0) {
        const box = vp.querySelector(`[data-page-box="${pending.page}"]`);
        if (box) {
          const vr = vp.getBoundingClientRect(), br = box.getBoundingClientRect();
          if (S.layout === "horizontal") vp.scrollLeft += br.left - vr.left - 24;
          else vp.scrollTop += br.top - vr.top - 16;
        }
        flashControls();
      }
      if (pending.left !== void 0) vp.scrollLeft = pending.left;
      if (pending.top !== void 0) vp.scrollTop = pending.top;
    }
    if (S.scrollHit) {
      S.scrollHit = false;
      (_b = root.querySelector(".ep-mark.is-active")) == null ? void 0 : _b.scrollIntoView({ block: "center", inline: "center" });
    }
    const wanted = (_c = S.focusKey) != null ? _c : focusKey;
    if (wanted) {
      const el = root.querySelector(`[data-focus="${wanted}"]`);
      if (el) {
        el.focus();
        if (S.focusKey) (_d = el.select) == null ? void 0 : _d.call(el);
        else if (sel && sel.s !== null && sel.e !== null) (_e = el.setSelectionRange) == null ? void 0 : _e.call(el, sel.s, sel.e);
      }
      S.focusKey = null;
    }
    syncPageUI();
  }
  var theme = new URLSearchParams(location.hash.slice(1)).get("theme");
  if (theme === "dark" || theme === "light") document.documentElement.setAttribute("data-theme", theme);
  initDocs();
  setRenderer(render);
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  document.addEventListener("keydown", onKeydown);
  setupTooltips(root);
  setupInteractions(root);
  render();
  var wasMobile = isMobileWidth();
  new ResizeObserver(() => {
    const m = isMobileWidth();
    if (m !== wasMobile) {
      wasMobile = m;
      update();
    }
  }).observe(root);
})();
