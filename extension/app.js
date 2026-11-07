const { FOLDERS: FOLDERS_KEY, MAX_VIDEO_BYTES, BLOB_KINDS, videoEmbed, DONATE_PROVIDERS, DONATE_DEFAULTS, donateUrl, KEY, BLOB_PREFIX, SETTINGS: SETTINGS_KEY, DEFAULT_SETTINGS, MAX_IMAGE_BYTES, esc, norm, stamp, parseCsvRows, csvInfo, jsonInfo, svgDataUri, dataUriMime, domainOf, mdToHtml, LANG_LABEL, languageOf, detectKind, sensitiveOf, htmlFeatures, cleanTags, sha, kindOfEntry, applyRetention } = CopyitLib;
const $ = id => document.getElementById(id);
const isDash = document.body.classList.contains('dashboard');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// two themes: "color" (flat multicolor, default) and "mono" (black & white with gradient)
const THEMES = [
  { id: 'color', name: 'Multicolor',    c: ['#3b6ef5', '#3b6ef5'], t: '#fff' },
  { id: 'mono',  name: 'Black & White', c: ['#ffffff', '#000000'], t: '#000' }
];
const setTheme = id => { if (id !== 'mono') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = id; };
const curTheme = () => document.documentElement.dataset.theme || 'color';
try { setTheme(localStorage.getItem('vaultTheme')); } catch { }
// appearance: light | dark | auto (follow the system)
const setMode = m => { if (m === 'light' || m === 'dark') document.documentElement.dataset.mode = m; else delete document.documentElement.dataset.mode; };
const curMode = () => document.documentElement.dataset.mode || 'auto';
try { setMode(localStorage.getItem('vaultMode')); } catch { }
try { if (isDash) { if (sessionStorage.getItem('vaultSplash')) document.getElementById('splash')?.remove(); else sessionStorage.setItem('vaultSplash', '1'); } } catch { }

let entries = [];
let settings = { ...DEFAULT_SETTINGS };
let typeFilter = 'all';
let filter = 'all';
let sort = 'recent';
let activeTag = '';
let folders = [], activeFolder = '';
const folderOf = x => (x.folder && folders.find(f => f.id === x.folder)) || null;
let editingId = null;
let draft = '';
let draftTags = '';
const seen = new Set();
const revealed = new Set();
const kindCache = new WeakMap();
const kindOf = x => kindOfEntry(x, kindCache);

/* ───────────── helpers ───────────── */
const dateText = s => { if (!s) return 'Unknown date'; const d = new Date(s); return Number.isNaN(+d) ? 'Unknown date' : d.toLocaleString(); };
const fmtBytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function rel(s) {
  const d = new Date(s);
  if (Number.isNaN(+d)) return 'Unknown date';
  const sec = (Date.now() - d) / 1000;
  if (sec < 45) return 'just now';
  if (sec < 3600) return Math.round(sec / 60) + 'm ago';
  if (sec < 86400) return Math.round(sec / 3600) + 'h ago';
  if (sec < 604800) return Math.round(sec / 86400) + 'd ago';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

function highlight(text, q) {
  if (!q) return esc(text);
  const lower = text.toLocaleLowerCase();
  if (lower.length !== text.length) return esc(text);
  let out = '', i = 0, j;
  while ((j = lower.indexOf(q, i)) >= 0) {
    out += esc(text.slice(i, j)) + '<mark>' + esc(text.slice(j, j + q.length)) + '</mark>';
    i = j + q.length;
  }
  return out + esc(text.slice(i));
}

const svg = p => `<svg class="i" viewBox="0 0 24 24">${p}</svg>`;
const ICON = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  auto: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>'),
  star: svg('<polygon points="12 2.5 14.9 8.8 21.7 9.6 16.6 14.2 18 21 12 17.5 6 21 7.4 14.2 2.3 9.6 9.1 8.8"/>'),
  pin: svg('<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="3"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  text: svg('<path d="M5 7h14M5 12h14M5 17h9"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  code: svg('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  json: svg('<path d="M8 4c-2 0-3 1-3 3v2c0 1-1 3-2 3 1 0 2 2 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 1 3 2 3-1 0-2 2-2 3v2c0 2-1 3-3 3"/>'),
  csv: svg('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 10h17M9.5 5v14"/>'),
  markdown: svg('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 15V9l3 3.5L12 9v6M17 9v6m0 0l-2-2m2 2l2-2"/>'),
  svg: svg('<circle cx="8" cy="8" r="4"/><rect x="12.5" y="12.5" width="7.5" height="7.5" rx="1.5"/><path d="M4 20l4-6 4 6z"/>'),
  datauri: svg('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'),
  image: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>'),
  rich: svg('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  more: svg('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  download: svg('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>'),
  tag: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>'),
  open: svg('<path d="M7 17L17 7M9 7h8v8"/>'),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  video: svg('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10.5l5-3v9l-5-3z"/>'),
  media: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="M4 18l5-5 4 4 3-3 4 4"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  folderplus: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14h6"/>'),
  heart: svg('<path d="M12 20.5s-8-4.7-8-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8 2.5c0 5.7-8 10.4-8 10.4z"/>'),
  warn: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.3v.1"/>')
};
const TYPES = {
  text: { label: 'Text' }, link: { label: 'Links' }, code: { label: 'Code' }, json: { label: 'JSON' }, csv: { label: 'CSV' },
  markdown: { label: 'Markdown' }, svg: { label: 'SVG' }, image: { label: 'Images' }, video: { label: 'Videos' }, datauri: { label: 'Data URI' }, rich: { label: 'Rich text' }
};
const TYPE_ORDER = ['text', 'link', 'code', 'json', 'csv', 'markdown', 'svg', 'image', 'video', 'datauri', 'rich'];
const isMediaKind = (x, k) => (k === 'link' && (MEDIA_URL.test(String(x.content || '').trim()) || !!videoEmbed(String(x.content || '')))) || k === 'image' || k === 'video' || k === 'svg' || (k === 'datauri' && /^(image|video)\/|^application\/pdf$/.test(dataUriMime(String(x.content || ''))));
const canPreview = (x, k) => isMediaKind(x, k) || (k === 'link' && /^https?:\/\//i.test(String(x.content || '').trim()));
const hasBlob = x => BLOB_KINDS.includes(x.kind);
const MEDIA_URL = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|bmp|svg|ico|mp4|webm|mov|m4v|ogv|pdf)(\?\S*)?(#\S*)?$/i;
const VIDEO_URL = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const mediaUrl = x => kindOf(x) === 'link' && MEDIA_URL.test(String(x.content || '').trim());
const fmtDur = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const ALWAYS_CHIPS = ['text', 'link', 'code'];
const SOURCES = {
  'clipboard-button': { label: 'Clipboard' }, 'context-menu': { label: 'Right-click' }, manual: { label: 'Typed' },
  import: { label: 'Imported' }, paste: { label: 'Pasted' }, drop: { label: 'Dropped' }
};
const srcOf = x => SOURCES[x.source] || SOURCES.manual;

/* ───────────── toasts ───────────── */
function toast(msg, type = 'ok', action) {
  const box = $('toasts'); if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'err' ? 'err' : '');
  t.innerHTML = `<span class="dot">${type === 'err' ? ICON.x : ICON.check}</span><span>${esc(msg)}</span>${action ? `<button class="act">${esc(action.label)}</button>` : ''}`;
  const dismiss = () => { t.classList.add('out'); setTimeout(() => t.remove(), 320); };
  t.querySelector('.act')?.addEventListener('click', () => { action.fn(); dismiss(); });
  box.append(t);
  setTimeout(dismiss, action ? 6000 : 2800);
}

/* ───────────── storage ───────────── */
async function load() {
  const data = await chrome.storage.local.get([KEY, SETTINGS_KEY, FOLDERS_KEY]);
  folders = Array.isArray(data[FOLDERS_KEY]) ? data[FOLDERS_KEY] : [];
  entries = Array.isArray(data[KEY]) ? data[KEY] : [];
  settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
  await autoClean();
  render();
  pruneBlobs();
}
async function persist() {
  await chrome.storage.local.set({ [KEY]: entries });
  render();
}
async function autoClean() {
  const { kept, removed } = applyRetention(entries, settings);
  if (removed.length) { entries = kept; await chrome.storage.local.set({ [KEY]: entries }); }
}
async function pruneBlobs() {                        // delete stored images whose clip no longer exists
  try {
    if (!chrome.storage.local.getKeys) return;
    const ids = new Set(entries.map(e => e.id));
    const dead = (await chrome.storage.local.getKeys()).filter(k => k.startsWith(BLOB_PREFIX) && !ids.has(k.slice(BLOB_PREFIX.length)));
    if (dead.length) await chrome.storage.local.remove(dead);
  } catch { }
}
const getBlob = async id => (await chrome.storage.local.get(BLOB_PREFIX + id))[BLOB_PREFIX + id] || '';
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[SETTINGS_KEY]) settings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
  if (changes[FOLDERS_KEY]) { folders = Array.isArray(changes[FOLDERS_KEY].newValue) ? changes[FOLDERS_KEY].newValue : []; render(); }
  if (!changes[KEY]) { if (changes[SETTINGS_KEY]) render(); return; }
  const next = Array.isArray(changes[KEY].newValue) ? changes[KEY].newValue : [];
  if (JSON.stringify(next) === JSON.stringify(entries)) return;
  entries = next; render();
});

/* ───────────── rendering ───────────── */
const sorters = {
  recent: (a, b) => stamp(b) - stamp(a),
  oldest: (a, b) => stamp(a) - stamp(b),
  copies: (a, b) => (b.copies || 1) - (a.copies || 1) || stamp(b) - stamp(a),
  az: (a, b) => String(a.content).localeCompare(String(b.content))
};

function matches(x, q) {
  if (!q) return true;
  if ((x.content || '').toLocaleLowerCase().includes(q)) return true;
  const tq = q.replace(/^#/, '');
  return (x.tags || []).some(t => t.includes(tq)) || (x.lang && x.lang.includes(q)) || (TYPES[kindOf(x)]?.label || '').toLowerCase().includes(q);
}

function visible() {
  const q = ($('search')?.value || '').trim().toLocaleLowerCase();
  let shown = entries.filter(x => matches(x, q));
  if (filter === 'pinned') shown = shown.filter(x => x.pinned);
  if (filter === 'favorites') shown = shown.filter(x => x.favorite);
  if (typeFilter === 'media') shown = shown.filter(x => isMediaKind(x, kindOf(x)));
  else if (typeFilter !== 'all') shown = shown.filter(x => kindOf(x) === typeFilter);
  if (activeFolder === '__none') shown = shown.filter(x => !x.folder || !folders.some(f => f.id === x.folder));
  else if (activeFolder) shown = shown.filter(x => x.folder === activeFolder);
  if (activeTag) shown = shown.filter(x => (x.tags || []).includes(activeTag));
  shown.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || sorters[sort](a, b));
  return { shown, q };
}

function emptyHtml(hasAny) {
  return `<div class="empty">
    <svg viewBox="0 0 120 90"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f43f5e"/><stop offset=".55" stop-color="#a21caf"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs>
      <g class="doc"><rect x="38" y="20" width="22" height="28" rx="4" fill="#fff" stroke="#c4b5fd"/><path d="M43 29h12M43 34h12M43 39h7" stroke="#a78bfa" stroke-width="2" stroke-linecap="round"/></g>
      <g class="doc d2"><rect x="62" y="24" width="20" height="26" rx="4" fill="#fff" stroke="#fda4af"/><path d="M67 33h10M67 38h10" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/></g>
      <g class="doc d3"><rect x="22" y="26" width="18" height="24" rx="4" fill="#fff" stroke="#a5b4fc"/><path d="M27 35h8M27 40h8" stroke="#818cf8" stroke-width="2" stroke-linecap="round"/></g>
      <rect x="20" y="52" width="80" height="30" rx="9" fill="url(#eg)"/>
      <g class="lid"><rect x="20" y="42" width="80" height="14" rx="7" fill="url(#eg)" opacity=".85"/></g>
      <circle cx="60" cy="67" r="6" fill="#fff" fill-opacity=".92"/><rect x="58.5" y="64" width="3" height="7" rx="1.5" fill="#7c3aed"/>
      <path class="spark" d="M100 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#f59e0b"/><path class="spark s2" d="M14 38l1.5 3.5 3.5 1.5-3.5 1.5L14 48l-1.5-3.5L9 43l3.5-1.5z" fill="#8b5cf6"/>
    </svg>
    <b>${hasAny ? 'Nothing matches' : 'Your vault is empty'}</b>
    <span>${hasAny ? 'Try a different search or switch the filter.' : 'Press Ctrl+V, save your clipboard, or right-click a selection or link on any page.'}</span>
  </div>`;
}

const csvTable = info => {
  const head = info.rows[0].slice(0, 12), body = info.rows.slice(1, 41), extraRows = info.count - body.length, extraCols = info.cols - head.length;
  return `<div class="tablewrap"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${head.map((_, i) => `<td>${esc(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${extraRows > 0 || extraCols > 0 ? `<div class="fmtline">${[extraRows > 0 ? `+${plural(extraRows, 'more row')}` : '', extraCols > 0 ? `+${plural(extraCols, 'more column')}` : ''].filter(Boolean).join(' · ')}</div>` : ''}`;
};

function statLine(x, kind) {
  const c = String(x.content ?? '');
  switch (kind) {
    case 'video': return `${x.image.w}×${x.image.h} · ${(x.image.mime.split('/')[1] || 'video').toUpperCase()} · ${fmtDur(x.image.duration)} · ${fmtBytes(x.image.size)}`;
    case 'image': return `${x.image.w}×${x.image.h} · ${(x.image.mime.split('/')[1] || 'img').replace('jpeg', 'jpg').toUpperCase()} · ${fmtBytes(x.image.size)}`;
    case 'json': { const j = jsonInfo(c); return j ? `valid JSON · ${plural(j.count, j.isArray ? 'item' : 'key')}` : `${c.length} chars`; }
    case 'csv': { const i = csvInfo(c); return i ? `${plural(i.count, 'row')} × ${plural(i.cols, 'col')}` : `${c.length} chars`; }
    case 'svg': return `vector · ${fmtBytes(new Blob([c]).size)}`;
    case 'datauri': return `${dataUriMime(c) || 'data'} · ${fmtBytes(c.length)}`;
    case 'code': return plural(c.split('\n').length, 'line') + ` · ${c.length} chars`;
    default: { const w = (c.trim().match(/\S+/g) || []).length; return `${c.length} chars · ${plural(w, 'word')}`; }
  }
}

function previewHtml(x, kind, q) {
  const c = String(x.content ?? '');
  const shownTxt = kind === 'json' ? (jsonInfo(c)?.pretty ?? c) : c;
  const long = shownTxt.length > 190 || shownTxt.split('\n').length > 4;
  const clamp = long ? ' clamped' : '';
  const raw = cls => `<div class="entry-text ${cls}${clamp}">${highlight(c, q)}</div>`;
  switch (kind) {
    case 'video': return `<div class="imgwrap vidwrap" data-peek="video"><img class="thumb" alt="Saved video" src="${esc(x.image?.thumb || '')}"><span class="playbadge">${ICON.video}${fmtDur(x.image?.duration)}</span></div>`;
    case 'image': return `<div class="imgwrap" data-peek="image"><img class="thumb" alt="Saved clipboard image" src="${esc(x.image?.thumb || '')}"></div>`;
    case 'svg': return `<div class="imgwrap checker" data-peek="svg"><img class="thumb" alt="SVG preview" src="${svgDataUri(c)}"></div>`;
    case 'datauri': {
      const m = dataUriMime(c);
      if (m.startsWith('image/') && c.length < 700000) return `<div class="imgwrap checker" data-peek="datauri"><img class="thumb" alt="Data URI preview" src="${esc(c.trim())}"></div>`;
      return `<div class="entry-text code clamped"${/^(video\/|application\/pdf$)/.test(m) ? '' : ''}>${esc(c.slice(0, 160))}${c.length > 160 ? '…' : ''}</div>`;
    }
    case 'json': { if (q) return raw('code'); const j = jsonInfo(c); return `<div class="entry-text code${clamp}">${esc(j ? j.pretty : c)}</div>`; }
    case 'csv': { if (q) return raw('code'); const i = csvInfo(c); return i ? csvTable(i) : raw('code'); }
    case 'markdown': return q ? raw('') : `<div class="entry-text md${clamp}">${mdToHtml(c)}</div>`;
    case 'code': return raw('code');
    case 'rich': return raw('') + `<div class="fmtline"><span class="fmt-pill">Keeps formatting</span>${htmlFeatures(x.html).map(f => `<span class="fmt-pill">${f}</span>`).join('')}</div>`;
    case 'link': { const u = c.trim(), ok = /^https?:\/\//i.test(u), uk = ok ? urlKind(u) : '';
      const em = ok ? videoEmbed(u) : null, lab = em ? em.label : ({ image: 'Image link', svg: 'Vector link', video: 'Video link', pdf: 'PDF link', web: 'Website' }[uk] || '');
      const thumb = em && em.thumb && settings.linkPreview !== false ? `<div class="imgwrap vidwrap" data-peek="yt"><img class="thumb" alt="${esc(em.label)} thumbnail" loading="lazy" src="${esc(em.thumb)}" onerror="this.parentNode.remove()"><span class="playbadge">${ICON.video}${esc(em.provider === 'youtube' ? 'YouTube' : 'Vimeo')}</span></div>` : '';
      return raw('') + thumb + (domainOf(c) ? `<div class="linkline">${ICON.link}${esc(domainOf(c))}${lab ? `<span class="fmt-pill">${lab}</span>` : ''}</div>` : ''); }
    default: return raw('');
  }
}

function entryHtml(x, q, delay, isNew) {
  const kind = kindOf(x), s = srcOf(x);
  const c = String(x.content ?? '');
  const isImg = hasBlob(x);
  const shownTxt = kind === 'json' ? (jsonInfo(c)?.pretty ?? c) : c;
  const long = !isImg && kind !== 'csv' && kind !== 'svg' && kind !== 'datauri' && (shownTxt.length > 190 || shownTxt.split('\n').length > 4);
  const editing = x.id === editingId;
  const when = x.copiedAt || x.createdAt;
  const sens = isImg ? '' : sensitiveOf(c);
  const blur = !!sens && settings.blur && !revealed.has(x.id);
  const lang = kind === 'code' ? (x.lang || languageOf(c)) : '';
  const kindPill = ['json', 'csv', 'markdown', 'svg', 'image', 'video', 'datauri', 'rich'].includes(kind) ? TYPES[kind].label.replace(/s$/, '') : (lang && lang !== 'code' ? LANG_LABEL[lang] || lang : '');
  const tags = (x.tags || []).map(t => `<button class="tag${t === activeTag ? ' on' : ''}" data-action="tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('');
  return `<article class="entry t-${kind}${x.pinned ? ' is-pinned' : ''}${isNew ? ' enter' : ''}${editing ? ' editing' : ''}" data-id="${esc(x.id)}" style="--d:${delay}ms">
    <div class="tile" title="${esc(TYPES[kind]?.label || kind)}">${ICON[kind] || ICON.text}</div>
    <div class="main">
      <div class="entry-top">
        <span class="when" data-t="${esc(when)}" title="${esc(dateText(when))}">${rel(when)}</span>
        <span class="dotsep">·</span><span class="src">${s.label}</span>
        ${x.copies > 1 ? `<span class="chip" title="Copied ${x.copies} times">×${x.copies}</span>` : ''}
        ${kindPill ? `<span class="kpill">${esc(kindPill)}</span>` : ''}
        ${folderOf(x) ? `<button class="fpill" data-action="openfolder" title="Open folder">${ICON.folder}${esc(folderOf(x).name)}</button>` : ''}
        <span class="spacer"></span>
        <button class="ib" data-action="share" title="Scan to open on your phone">${SH_ICON.qr}</button>
        <button class="ib${x.favorite ? ' on' : ''}" data-action="favorite" title="${x.favorite ? 'Remove star' : 'Star entry'}">${ICON.star}</button>
        <button class="ib${x.pinned ? ' on' : ''}" data-action="pin" title="${x.pinned ? 'Unpin entry' : 'Pin entry'}">${ICON.pin}</button>
      </div>
      ${sens ? `<div class="sens">${ICON.lock}Sensitive · ${esc(sens)}</div>` : ''}
      <div class="pv${blur ? ' blurred' : ''}">${previewHtml(x, kind, q)}${blur ? `<button class="reveal" data-action="reveal">${ICON.eye}Reveal</button>` : ''}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${long ? '<button class="more" data-action="toggle">Show more</button>' : ''}
      ${canPreview(x, kind) ? `<div class="pvrow"><button class="btn sm pvbtn" data-action="preview" title="Open a preview in a small window">${ICON.eye}<span>Preview</span></button></div>` : ''}
      <div class="entry-foot">
        <span class="stat-line">${esc(statLine(x, kind))}</span>
        <span class="spacer"></span>
        ${kind === 'link' ? `<button class="ib" data-action="open" title="Open link">${ICON.open}</button>` : ''}
        <button class="ib" data-action="edit" title="${isImg ? 'Edit tags' : 'Edit entry'}">${ICON.edit}</button>
        <button class="ib" data-action="menu" title="Copy as, download and more">${ICON.more}</button>
        <button class="ib danger" data-action="delete" title="Delete entry">${ICON.trash}<span class="ask">Sure?</span></button>
        <button class="btn primary copy" data-action="copy" title="${isImg ? 'Copy image' : kind === 'rich' ? 'Copy with formatting' : 'Copy text'}"><span class="ico ico-copy">${ICON.copy}</span><span class="ico ico-check">${ICON.check}</span><span class="lbl">Copy</span></button>
      </div>
    </div>
    <div class="edit-area">
      ${isImg ? '' : `<textarea>${esc(editing ? draft : c)}</textarea>`}
      <label class="tags-edit">${ICON.tag}<input type="text" placeholder="Tags, separated by commas" value="${esc(editing ? draftTags : (x.tags || []).join(', '))}" maxlength="120"></label>
      <div class="edit-foot"><span>${isImg ? 'Edit tags' : kind === 'rich' ? 'Editing converts this to plain text' : 'Edit saved text'}</span><button class="btn primary sm" data-action="save-edit">Save</button><button class="btn sm" data-action="cancel-edit">Cancel</button></div>
    </div>
  </article>`;
}

function renderTypeChips() {
  const box = $('typeChips'); if (!box) return;
  const counts = {};
  entries.forEach(x => { const k = kindOf(x); counts[k] = (counts[k] || 0) + 1; });
  const types = TYPE_ORDER.filter(t => counts[t] || ALWAYS_CHIPS.includes(t));
  const mediaN = entries.filter(x => isMediaKind(x, kindOf(x))).length;
  if (typeFilter === 'media' && !mediaN) typeFilter = 'all';
  if (typeFilter !== 'all' && typeFilter !== 'media' && !types.includes(typeFilter)) typeFilter = 'all';
  const sig = types.map(t => t + (counts[t] || 0)).join() + '|' + typeFilter + '|m' + mediaN;
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = `<button class="${typeFilter === 'all' ? 'on' : ''}" data-type="all">All types</button>` +
    `<button class="${typeFilter === 'media' ? 'on' : ''}" data-type="media" title="Images, videos, SVG and image data URIs">${ICON.media}Multimedia${mediaN ? `<b>${mediaN}</b>` : ''}</button>` +
    types.map(t => `<button class="${typeFilter === t ? 'on' : ''}" data-type="${t}">${ICON[t]}${TYPES[t].label}${counts[t] ? `<b>${counts[t]}</b>` : ''}</button>`).join('');
}

function renderTagBar() {
  const box = $('tagBar'); if (!box) return;
  const counts = {};
  entries.forEach(x => (x.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  if (activeTag && !counts[activeTag]) activeTag = '';
  box.hidden = !tags.length;
  box.innerHTML = tags.length ? `<span class="tb-label">${ICON.tag}Tags</span>` + tags.map(t => `<button class="tag${t === activeTag ? ' on' : ''}" data-tag="${esc(t)}">#${esc(t)}<b>${counts[t]}</b></button>`).join('') : '';
}

const TYPE_COLORS = { text: 'var(--accent)', link: '#2f7bf5', code: '#0f9d7a', json: '#d97706', csv: '#16a34a', markdown: '#6366f1', svg: '#db2777', image: '#0ea5e9', video: '#ef4444', datauri: '#64748b', rich: '#c026d3' };
function renderTypeBar() {
  const box = $('typeBar'); if (!box) return;
  const counts = {};
  entries.forEach(x => { const k = kindOf(x); counts[k] = (counts[k] || 0) + 1; });
  const present = TYPE_ORDER.filter(t => counts[t]);
  const sig = present.map(t => t + counts[t]).join();
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  if (!present.length) { box.innerHTML = ''; return; }
  const total = entries.length;
  box.innerHTML = `<div class="tb-head"><b>By type</b><span>${plural(present.length, 'format')}</span></div>
    <div class="tb-bar">${present.map((t, i) => `<i style="--w:${counts[t] / total * 100}%;--c:${TYPE_COLORS[t]};--i:${i}" title="${TYPES[t].label}: ${counts[t]}"></i>`).join('')}</div>
    <div class="tb-legend">${present.map(t => `<span><i style="background:${TYPE_COLORS[t]}"></i>${TYPES[t].label} <b>${counts[t]}</b></span>`).join('')}</div>`;
}

function render() {
  const list = $('list'); if (!list) return;
  renderTypeChips(); renderFolderBar(); renderTagBar();
  const { shown, q } = visible();

  // remember positions so surviving cards glide (FLIP) to their new place
  const before = new Map();
  list.querySelectorAll('.entry').forEach(el => before.set(el.dataset.id, el.getBoundingClientRect()));

  updateStats();
  const count = $('count');
  if (count) count.textContent = `${shown.length} shown · ${entries.length} saved`;

  if (!shown.length) { list.innerHTML = emptyHtml(entries.length > 0); return; }

  let n = 0;
  list.innerHTML = shown.map(x => {
    const isNew = !seen.has(x.id);
    return entryHtml(x, q, isNew ? Math.min(n++, 9) * 45 : 0, isNew);
  }).join('');
  shown.forEach(x => seen.add(x.id));

  if (!reduce) {
    list.querySelectorAll('.entry:not(.enter)').forEach(el => {
      const b = before.get(el.dataset.id); if (!b) return;
      const a = el.getBoundingClientRect();
      const dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }
  if (editingId) list.querySelector('.entry.editing textarea, .entry.editing .tags-edit input')?.focus();
}
// a preview that fails to decode (bad base64, broken SVG) shows a quiet fallback instead of a broken icon
document.addEventListener('error', e => { if (e.target?.tagName === 'IMG') e.target.closest('.imgwrap')?.classList.add('broken'); }, true);

function setNum(el, v) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = v;
  if (reduce || from === v) { el.textContent = v; return; }
  cancelAnimationFrame(el._raf);
  const t0 = performance.now(), dur = 650;
  const step = t => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(from + (v - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function updateStats() {
  const vals = {
    statTotal: entries.length,
    statPinned: entries.filter(x => x.pinned).length,
    statStarred: entries.filter(x => x.favorite).length,
    statCopies: entries.reduce((a, x) => a + (x.copies || 1), 0)
  };
  for (const [id, v] of Object.entries(vals)) { const el = $(id); if (el) setNum(el, v); }
  renderChart(); renderTypeBar();
}

function renderChart() {
  const box = $('chart'); if (!box) return;
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push({ d, n: 0 }); }
  entries.forEach(x => {
    const t = new Date(x.copiedAt || x.createdAt); if (Number.isNaN(+t)) return;
    t.setHours(0, 0, 0, 0);
    const day = days.find(o => +o.d === +t); if (day) day.n++;
  });
  const sig = days.map(o => o.n).join();
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  const max = Math.max(1, ...days.map(o => o.n));
  box.innerHTML = days.map((o, i) => `<div class="bar${i === 6 ? ' today' : ''}" title="${o.n} on ${esc(o.d.toLocaleDateString())}"><span class="num">${o.n}</span><div class="fill" style="--h:${Math.max(6, o.n / max * 78)}px;--i:${i}"></div><em>${esc(o.d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3))}</em></div>`).join('');
}

function moveThumb() {
  const seg = $('filterChips'); if (!seg) return;
  const act = seg.querySelector('button.on'), th = seg.querySelector('.thumb');
  if (!act || !th) return;
  th.style.width = act.offsetWidth + 'px';
  th.style.transform = `translateX(${act.offsetLeft}px)`;
}

/* ───────────── clipboard: reading ───────────── */
const send = msg => chrome.runtime.sendMessage(msg);
const htmlToText = html => { try { return (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim(); } catch { return ''; } };
const blobToDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

/* Reads every format on the clipboard: image/*, text/html and text/plain. Falls back to readText(). */
async function readClipboardPayload() {
  if (navigator.clipboard.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) return { image: await item.getType(imgType) };
        const text = item.types.includes('text/plain') ? await (await item.getType('text/plain')).text() : '';
        const html = item.types.includes('text/html') ? await (await item.getType('text/html')).text() : '';
        if (text.trim() || html.trim()) return { text, html };
      }
      return null;
    } catch { /* some browsers only allow readText; try that next */ }
  }
  const text = await navigator.clipboard.readText();
  return text.trim() ? { text } : null;
}

async function makeThumb(blob) {
  const bmp = await createImageBitmap(blob);
  const w = bmp.width, h = bmp.height, s = Math.min(1, 280 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return { w, h, thumb: c.toDataURL('image/webp', 0.82) };
}

function videoMeta(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), v = document.createElement('video');
    v.muted = true; v.preload = 'metadata'; v.playsInline = true;
    const done = (fn, a) => { URL.revokeObjectURL(url); fn(a); };
    v.onerror = () => done(reject, new Error('This video format cannot be previewed'));
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 0) / 4); };
    v.onseeked = () => {
      const w = v.videoWidth || 320, h = v.videoHeight || 180, s = Math.min(1, 280 / Math.max(w, h));
      const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      done(resolve, { w, h, duration: v.duration || 0, thumb: c.toDataURL('image/webp', 0.8) });
    };
    v.src = url;
  });
}
async function saveVideoBlob(blob, source) {
  if (blob.size > MAX_VIDEO_BYTES) return { ok: false, msg: `Video is over ${fmtBytes(MAX_VIDEO_BYTES)}, so it was not saved.` };
  const [hash, dataUrl, m] = await Promise.all([blob.arrayBuffer().then(sha), blobToDataUrl(blob), videoMeta(blob)]);
  const ext = (blob.type.split('/')[1] || 'video').toUpperCase();
  const res = await send({ type: 'SAVE_ENTRY', blob: dataUrl, entry: { content: `Video ${m.w}×${m.h} ${ext}`, kind: 'video', source, hash, image: { mime: blob.type, w: m.w, h: m.h, duration: m.duration, size: blob.size, thumb: m.thumb } } });
  return finishSave(res, 'video');
}
async function saveImageBlob(blob, source) {
  if (blob.type.startsWith('video/')) return saveVideoBlob(blob, source);
  if (blob.type === 'image/svg+xml') return saveText(await blob.text(), source);
  if (blob.size > MAX_IMAGE_BYTES) return { ok: false, msg: `Image is over ${fmtBytes(MAX_IMAGE_BYTES)}, so it was not saved.` };
  const [hash, dataUrl, t] = await Promise.all([blob.arrayBuffer().then(sha), blobToDataUrl(blob), makeThumb(blob)]);
  const ext = (blob.type.split('/')[1] || 'img').replace('jpeg', 'jpg').toUpperCase();
  const res = await send({ type: 'SAVE_ENTRY', blob: dataUrl, entry: { content: `Image ${t.w}×${t.h} ${ext}`, kind: 'image', source, hash, image: { mime: blob.type || 'image/png', w: t.w, h: t.h, size: blob.size, thumb: t.thumb } } });
  return finishSave(res, 'image');
}
async function saveText(text, source, html) {
  if (!String(text || '').trim()) return { ok: false, msg: 'Nothing to save.' };
  return finishSave(await send({ type: 'SAVE_ENTRY', entry: { content: text, html: html || undefined, source } }));
}
async function finishSave(res, forced) {
  if (!res?.ok) return { ok: false, msg: res?.error || 'Could not save.' };
  await load();
  const x = entries.find(e => e.id === res.id);
  const label = (TYPES[forced || (x && kindOf(x))]?.label || 'Text').replace(/s$/, '');
  return { ok: true, msg: res.duplicate ? `Already saved · moved to the top` : `${label} saved to your vault` };
}
async function saveFromPayload(p, source) {
  if (!p) return { ok: false, msg: 'Clipboard is empty.' };
  if (p.image) return saveImageBlob(p.image, source);
  const text = (p.text || '').trim() ? p.text : htmlToText(p.html || '');
  return saveText(text, source, p.html);
}
const report = r => toast(r.msg, r.ok ? 'ok' : 'err');

async function saveClipboard() {
  const btn = $('saveClipboard');
  btn.classList.add('loading');
  try { report(await saveFromPayload(await readClipboardPayload(), 'clipboard-button')); }
  catch { toast('Could not read the clipboard. Allow clipboard access for Copyit, or press Ctrl+V here instead.', 'err'); }
  finally { btn.classList.remove('loading'); }
}

/* Ctrl/Cmd+V anywhere in Copyit saves whatever was copied: images, rich text, plain text. No permission prompt. */
document.addEventListener('paste', async e => {
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  const cd = e.clipboardData; if (!cd) return;
  e.preventDefault();
  try {
    const img = [...cd.files].find(f => f.type.startsWith('image/'));
    if (img) return report(await saveImageBlob(img, 'paste'));
    const text = cd.getData('text/plain'), html = cd.getData('text/html');
    if (!text.trim() && !html.trim()) return toast('Nothing to paste. Copyit saves text, links, code and images.', 'err');
    report(await saveFromPayload({ text, html }, 'paste'));
  } catch (err) { toast(`Could not paste: ${err.message}`, 'err'); }
});

function openAdd() {
  const dlg = $('addDialog'); $('addText').value = '';
  dlg.showModal(); $('addText').focus();
}
async function submitAdd() {
  const content = $('addText').value;
  if (!content.trim()) { toast('Nothing to save yet.', 'err'); return; }
  $('addDialog').close();
  report(await saveText(content, 'manual'));
}

/* ───────────── clipboard: writing (copy as…) ───────────── */
function dataUrlToBlob(u) {
  const i = u.indexOf(','), head = u.slice(0, i), body = u.slice(i + 1), mime = /^data:([^;,]+)/.exec(head)?.[1] || 'application/octet-stream';
  if (/;base64/i.test(head)) { const bin = atob(body.replace(/\s/g, '')); const a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k); return new Blob([a], { type: mime }); }
  return new Blob([decodeURIComponent(body)], { type: mime });
}
const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not decode the image')); i.src = src; });
async function toPngBlob(src) {
  const img = await loadImage(src);
  let w = img.naturalWidth || 256, h = img.naturalHeight || 256;
  if (Math.max(w, h) < 512 && src.startsWith('data:image/svg')) { const s = 512 / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Could not convert to PNG')), 'image/png'));
}
/* Writes several formats at once (e.g. text/html + text/plain) so rich editors and terminals each get what they want. */
async function writeClip(parts) {
  try {
    const o = {};
    for (const [t, v] of Object.entries(parts)) o[t] = v instanceof Blob ? v : new Blob([v], { type: t });
    await navigator.clipboard.write([new ClipboardItem(o)]);
  } catch (err) {
    if (parts['text/plain'] != null) await navigator.clipboard.writeText(parts['text/plain']); else throw err;
  }
}
function download(name, data, type) { const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }

const EXT = { js: 'js', python: 'py', sql: 'sql', shell: 'sh', html: 'html', css: 'css' };
async function defaultCopy(x, kind) {
  if (kind === 'video') { const u = await getBlob(x.id); if (!u) throw new Error('The video data is missing'); download(`copyit-video.${(x.image.mime.split('/')[1] || 'mp4').replace('quicktime', 'mov')}`, dataUrlToBlob(u)); toast('Browsers cannot copy video to the clipboard, so it was downloaded instead.'); return; }
  if (kind === 'image') { const u = await getBlob(x.id); if (!u) throw new Error('The full-size image is missing'); const png = x.image.mime === 'image/png' ? dataUrlToBlob(u) : await toPngBlob(u); await writeClip({ 'image/png': png }); return; }
  if (kind === 'rich' && x.html) { await writeClip({ 'text/plain': x.content, 'text/html': x.html }); return; }
  await navigator.clipboard.writeText(x.content);
}
function actionsFor(x, kind) {
  const c = String(x.content ?? ''), acts = [];
  const A = (label, run) => acts.push({ label, run });
  switch (kind) {
    case 'video':
      A('Download video', async () => { await defaultCopy(x, kind); return 'Video downloaded'; });
      A('Copy still frame (PNG)', async () => { await writeClip({ 'image/png': await toPngBlob(x.image.thumb) }); return 'Frame copied'; });
      A('Copy as data URI', async () => { await navigator.clipboard.writeText(await getBlob(x.id)); return 'Data URI copied'; });
      return acts;
    case 'image':
      A('Copy image', async () => { await defaultCopy(x, kind); return 'Image copied'; });
      A('Copy as data URI', async () => { await navigator.clipboard.writeText(await getBlob(x.id)); return 'Data URI copied'; });
      A('Download image', async () => { const b = dataUrlToBlob(await getBlob(x.id)); download(`copyit-image.${(x.image.mime.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, b); return 'Image downloaded'; });
      return acts;
    case 'rich':
      A('Copy with formatting', async () => { await defaultCopy(x, kind); return 'Copied with formatting'; });
      A('Copy as plain text', async () => { await navigator.clipboard.writeText(c); return 'Plain text copied'; });
      A('Copy as HTML source', async () => { await navigator.clipboard.writeText(x.html || c); return 'HTML source copied'; });
      A('Download as .html', async () => { download('copyit-rich.html', x.html || c, 'text/html'); return 'Downloaded'; });
      return acts;
    case 'json': { const j = jsonInfo(c);
      A('Copy formatted JSON', async () => { await navigator.clipboard.writeText(j ? j.pretty : c); return 'Formatted JSON copied'; });
      A('Copy minified JSON', async () => { await navigator.clipboard.writeText(j ? j.mini : c); return 'Minified JSON copied'; });
      A('Download as .json', async () => { download('copyit.json', j ? j.pretty : c, 'application/json'); return 'Downloaded'; });
      return acts; }
    case 'csv': { const i = csvInfo(c);
      A('Copy as plain CSV', async () => { await navigator.clipboard.writeText(c); return 'CSV copied'; });
      if (i) {
        const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
        A('Copy for Sheets / Excel (tab-separated)', async () => {
          const tsv = i.rows.map(r => r.map(v => String(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
          const table = '<table>' + i.rows.map((r, k) => '<tr>' + r.map(v => `<${k ? 'td' : 'th'}>${esc(v)}</${k ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table>';
          await writeClip({ 'text/plain': tsv, 'text/html': table }); return 'Copied for spreadsheets';
        });
        A('Copy as Markdown table', async () => { const [h, ...b] = i.rows; await navigator.clipboard.writeText(['| ' + h.map(cell).join(' | ') + ' |', '| ' + h.map(() => '---').join(' | ') + ' |', ...b.map(r => '| ' + h.map((_, k) => cell(r[k])).join(' | ') + ' |')].join('\n')); return 'Markdown table copied'; });
        A('Copy as JSON', async () => { const [h, ...b] = i.rows; await navigator.clipboard.writeText(JSON.stringify(b.map(r => Object.fromEntries(h.map((k, n) => [k, r[n] ?? '']))), null, 2)); return 'JSON copied'; });
      }
      A('Download as .csv', async () => { download('copyit.csv', c, 'text/csv'); return 'Downloaded'; });
      return acts; }
    case 'markdown':
      A('Copy as Markdown', async () => { await navigator.clipboard.writeText(c); return 'Markdown copied'; });
      A('Copy as rich text (rendered)', async () => { await writeClip({ 'text/plain': c, 'text/html': mdToHtml(c) }); return 'Copied as rich text'; });
      A('Copy as HTML source', async () => { await navigator.clipboard.writeText(mdToHtml(c)); return 'HTML copied'; });
      A('Download as .md', async () => { download('copyit.md', c, 'text/markdown'); return 'Downloaded'; });
      return acts;
    case 'svg':
      A('Copy SVG code', async () => { await navigator.clipboard.writeText(c); return 'SVG copied'; });
      A('Copy as PNG image', async () => { await writeClip({ 'image/png': await toPngBlob(svgDataUri(c)) }); return 'PNG image copied'; });
      A('Copy as data URI', async () => { await navigator.clipboard.writeText(svgDataUri(c)); return 'Data URI copied'; });
      A('Download as .svg', async () => { download('copyit.svg', c, 'image/svg+xml'); return 'Downloaded'; });
      return acts;
    case 'datauri': { const m = dataUriMime(c);
      A('Copy data URI', async () => { await navigator.clipboard.writeText(c.trim()); return 'Data URI copied'; });
      if (m.startsWith('image/')) A('Copy as image', async () => { await writeClip({ 'image/png': await toPngBlob(c.trim()) }); return 'Image copied'; });
      A('Download decoded file', async () => { const b = dataUrlToBlob(c.trim()); download(`copyit-file.${(m.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace('+xml', '')}`, b); return 'Downloaded'; });
      return acts; }
    case 'link': { const d = domainOf(c) || c;
      A('Copy link', async () => { await navigator.clipboard.writeText(c); return 'Link copied'; });
      A('Copy as Markdown link', async () => { await navigator.clipboard.writeText(`[${d}](${c.trim()})`); return 'Markdown link copied'; });
      A('Copy as HTML link', async () => { await writeClip({ 'text/plain': c.trim(), 'text/html': `<a href="${esc(c.trim())}">${esc(d)}</a>` }); return 'HTML link copied'; });
      return acts; }
    case 'code': { const lang = x.lang || languageOf(c);
      A('Copy code', async () => { await navigator.clipboard.writeText(c); return 'Code copied'; });
      A('Copy as Markdown code block', async () => { await navigator.clipboard.writeText('```' + (lang === 'code' ? '' : lang) + '\n' + c + '\n```'); return 'Code block copied'; });
      A(`Download as .${EXT[lang] || 'txt'}`, async () => { download(`copyit.${EXT[lang] || 'txt'}`, c, 'text/plain'); return 'Downloaded'; });
      return acts; }
    default:
      A('Copy text', async () => { await navigator.clipboard.writeText(c); return 'Text copied'; });
      A('Copy as single line', async () => { await navigator.clipboard.writeText(c.replace(/\s+/g, ' ').trim()); return 'Single line copied'; });
      A('Copy as Markdown quote', async () => { await navigator.clipboard.writeText(c.split('\n').map(l => '> ' + l).join('\n')); return 'Quote copied'; });
      A('Download as .txt', async () => { download('copyit.txt', c, 'text/plain'); return 'Downloaded'; });
      return acts;
  }
}

/* "Copy as…" popover */
let menuEl = null;
function closeMenu() { menuEl?.remove(); menuEl = null; }
function openMenu(btn, x) {
  closeMenu();
  const acts = actionsFor(x, kindOf(x));
  const nCopy = acts.length;
  folders.forEach(f => acts.push({ label: f.name, folder: true, on: x.folder === f.id, run: async () => { await setFolder(x, f.id); return `Moved to “${f.name}”`; } }));
  if (folderOf(x)) acts.push({ label: 'Remove from folder', folder: true, icon: 'close', run: async () => { await setFolder(x, ''); return 'Removed from folder'; } });
  acts.push({ label: 'New folder…', folder: true, icon: 'folderplus', run: async () => { openFolderDialog(null, x); return 'Name your new folder'; } });
  menuEl = document.createElement('div'); menuEl.className = 'menu-pop'; menuEl.setAttribute('role', 'menu');
  menuEl.innerHTML = `<div class="mp-title">Copy as</div>` + acts.map((a, i) => `${i === nCopy ? '<div class="mp-title">Move to folder</div>' : ''}<button role="menuitem" data-i="${i}" class="${a.on ? 'on' : ''}">${a.folder ? (ICON[a.icon] || ICON.folder) : a.label.startsWith('Download') ? ICON.download : ICON.copy}<span>${esc(a.label)}</span></button>`).join('');
  document.body.append(menuEl);
  const r = btn.getBoundingClientRect(), mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
  menuEl.style.left = Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8)) + 'px';
  menuEl.style.top = (r.bottom + 6 + mh > innerHeight - 8 ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
  menuEl.addEventListener('click', async e => {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    const a = acts[+b.dataset.i]; closeMenu();
    try { const m = await a.run(); if (!a.folder || !a.label.startsWith('New')) toast(m); } catch (err) { toast(`Could not do that: ${err.message}`, 'err'); }
  });
  menuEl.querySelector('button')?.focus();
}
document.addEventListener('click', e => { if (menuEl && !e.target.closest('.menu-pop') && !e.target.closest('[data-action=menu]')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
$('list')?.addEventListener('scroll', closeMenu);


/* ───────────── folders (your own categories) ───────────── */
async function saveFolders() { await chrome.storage.local.set({ [FOLDERS_KEY]: folders }); }
async function setFolder(x, id) { if (id) x.folder = id; else delete x.folder; await persist(); }
function renderFolderBar() {
  const box = $('folderBar'); if (!box) return;
  const cnt = id => entries.filter(x => x.folder === id).length;
  const unfiled = folders.length ? entries.filter(x => !folderOf(x)).length : 0;
  if (activeFolder && activeFolder !== '__none' && !folders.some(f => f.id === activeFolder)) activeFolder = '';
  const sig = JSON.stringify([folders, folders.map(f => cnt(f.id)), unfiled, activeFolder]);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = `<span class="tb-label">${ICON.folder}Folders</span>` +
    folders.map(f => `<button class="fchip${activeFolder === f.id ? ' on' : ''}" data-folder="${esc(f.id)}">${ICON.folder}${esc(f.name)}<b>${cnt(f.id)}</b></button>`).join('') +
    (folders.length ? `<button class="fchip${activeFolder === '__none' ? ' on' : ''}" data-folder="__none">No folder<b>${unfiled}</b></button>` : '') +
    (activeFolder && activeFolder !== '__none' ? `<button class="fchip tool" data-folder-edit title="Rename or delete this folder">${ICON.edit || ICON.tag}Edit</button>` : '') +
    `<button class="fchip add" data-folder-new>${ICON.folderplus}New folder</button>`;
}
let folderDlg;
function openFolderDialog(folder, moveItem) {
  if (!folderDlg) {
    folderDlg = document.createElement('dialog'); folderDlg.id = 'folderDialog';
    folderDlg.innerHTML = `<form class="set" method="dialog"><h2 id="fdTitle">New folder</h2><p>Folders are your own categories. Move any clip into one from its ••• menu.</p>
      <input id="fdName" maxlength="28" placeholder="e.g. Work, Recipes, Designs" autocomplete="off">
      <div class="dlg-foot"><button type="button" class="btn sm danger-btn" id="fdDelete" hidden>Delete folder</button><span class="spacer"></span><button type="button" class="btn sm" id="fdCancel">Cancel</button><button type="submit" class="btn primary sm" id="fdSave">Save</button></div></form>`;
    document.body.append(folderDlg);
    $('fdCancel').addEventListener('click', () => folderDlg.close());
  }
  folderDlg._f = folder; folderDlg._move = moveItem;
  $('fdTitle').textContent = folder ? 'Edit folder' : 'New folder';
  $('fdName').value = folder ? folder.name : '';
  $('fdDelete').hidden = !folder;
  folderDlg.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const name = $('fdName').value.trim().replace(/\s+/g, ' ');
    if (!name) { toast('Give the folder a name.', 'err'); return; }
    const f = folderDlg._f;
    if (folders.some(o => o !== f && o.name.toLowerCase() === name.toLowerCase())) { toast('A folder with that name already exists.', 'err'); return; }
    let target = f;
    if (f) f.name = name; else { target = { id: crypto.randomUUID(), name }; folders.push(target); }
    await saveFolders();
    if (folderDlg._move) { folderDlg._move.folder = target.id; toast(`Moved to “${name}”`); }
    folderDlg.close(); await persist(); $('folderBar') && ($('folderBar').dataset.sig = ''); render();
  };
  $('fdDelete').onclick = async () => {
    const f = folderDlg._f; if (!f) return;
    const n = entries.filter(x => x.folder === f.id).length;
    folders = folders.filter(o => o !== f); entries.forEach(x => { if (x.folder === f.id) delete x.folder; });
    if (activeFolder === f.id) activeFolder = '';
    await saveFolders(); folderDlg.close(); await persist(); toast(`Folder “${f.name}” deleted${n ? ` · ${plural(n, 'clip')} kept` : ''}`);
  };
  folderDlg.showModal(); $('fdName').focus(); $('fdName').select();
}
$('folderBar')?.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-folder-new')) return openFolderDialog(null);
  if (b.hasAttribute('data-folder-edit')) return openFolderDialog(folders.find(f => f.id === activeFolder));
  if (b.dataset.folder) { activeFolder = activeFolder === b.dataset.folder ? '' : b.dataset.folder; render(); }
});

/* ───────────── hover: auto-scroll long text ───────────── */
const hscroll = (() => {
  let cur = null;
  const stop = st => { if (!st) return; cancelAnimationFrame(st.raf); const b = st.box; b.scrollTo({ top: 0, left: 0, behavior: 'smooth' }); setTimeout(() => { if (cur?.box !== b) { b.classList.remove('hscroll'); b.style.maxHeight = ''; } }, 420); };
  function start(box) {
    const clamped = box.classList.contains('clamped');
    if (clamped) { box.style.maxHeight = box.clientHeight + 'px'; box.classList.add('hscroll'); }
    const maxY = () => box.scrollHeight - box.clientHeight, maxX = () => box.scrollWidth - box.clientWidth;
    if (maxY() < 4 && maxX() < 4) { box.classList.remove('hscroll'); box.style.maxHeight = ''; return null; }
    const st = { box, raf: 0 }; let last = performance.now(), hold = 450;
    const tick = now => {
      const dt = Math.min(60, now - last); last = now;
      if (hold > 0) hold -= dt;
      else if (box.scrollTop < maxY() - 1) box.scrollTop += dt * 0.045;
      else if (box.scrollLeft < maxX() - 1) box.scrollLeft += dt * 0.06;
      else return;
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick); return st;
  }
  return {
    over(article) {
      this.leave(); if (reduce || article.classList.contains('editing')) return;
      const box = article.querySelector('.entry-text, .tablewrap'); if (!box) return;
      cur = start(box);
    },
    leave() { const s = cur; cur = null; stop(s); },
    prepare(box) {                                   // make a clamped box scrollable (wheel) and park the auto-scroll
      if (cur && cur.box === box) { cancelAnimationFrame(cur.raf); return; }
      if (box.classList.contains('clamped') && !box.classList.contains('hscroll')) { box.style.maxHeight = box.clientHeight + 'px'; box.classList.add('hscroll'); }
    }
  };
})();
let hoverArticle = null;
$('list')?.addEventListener('mouseover', e => {
  const a = e.target.closest('.entry'); if (a === hoverArticle) return;
  hoverArticle = a; if (a) hscroll.over(a); else hscroll.leave();
});
$('list')?.addEventListener('mouseleave', () => { hoverArticle = null; hscroll.leave(); });


/* mouse-wheel scrolling inside a clip (smooth); at the edge the wheel hands over to the page */
$('list')?.addEventListener('wheel', e => {
  const box = e.target.closest('.entry-text, .tablewrap');
  if (!box || e.ctrlKey || box.closest('.entry')?.classList.contains('editing') || box.matches('textarea')) return;
  const horiz = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
  const raw = horiz ? (e.deltaX || e.deltaY) : e.deltaY, d = raw * (e.deltaMode === 1 ? 34 : e.deltaMode === 2 ? box.clientHeight : 1);
  if (!d) return;
  hscroll.prepare(box);
  const max = horiz ? box.scrollWidth - box.clientWidth : box.scrollHeight - box.clientHeight;
  if (max < 4) return;
  const a = box._wheel || (box._wheel = { y: box.scrollTop, x: box.scrollLeft, raf: 0 });
  if (!a.raf) { a.y = box.scrollTop; a.x = box.scrollLeft; }
  const k = horiz ? 'x' : 'y', at = a[k];
  if ((d < 0 && at <= 0.5) || (d > 0 && at >= max - 0.5)) return;      // edge reached: let the page scroll
  e.preventDefault();
  a[k] = Math.max(0, Math.min(max, at + d));
  if (reduce) { box.scrollTop = a.y; box.scrollLeft = a.x; return; }
  cancelAnimationFrame(a.raf);
  const step = () => {
    const dy = a.y - box.scrollTop, dx = a.x - box.scrollLeft;
    if (Math.abs(dy) < .5 && Math.abs(dx) < .5) { box.scrollTop = a.y; box.scrollLeft = a.x; a.raf = 0; return; }
    box.scrollTop += dy * .2; box.scrollLeft += dx * .2; a.raf = requestAnimationFrame(step);
  };
  a.raf = requestAnimationFrame(step);
}, { passive: false });

const urlKind = u => videoEmbed(u) ? 'embed' : /\.pdf(\?|#|$)/i.test(u) ? 'pdf' : VIDEO_URL.test(u) ? 'video' : /\.svg(\?|#|$)/i.test(u) ? 'svg' : /\.(png|jpe?g|gif|webp|avif|bmp|ico)(\?|#|$)/i.test(u) ? 'image' : 'web';
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };

/* ───────────── click a media clip or media link: full viewer ───────────── */
let lb;
async function describeMedia(x) {
  const kind = kindOf(x), c = String(x.content || '').trim();
  if (kind === 'link') {
    const url = safeUrl(c.split(/\s+/)[0]); if (!url) return null;
    const em = videoEmbed(url), t = urlKind(url); return { type: t, src: em ? em.embed : url, thumb: em && em.thumb, openUrl: em ? em.watch : url, title: domainOf(url) || url, sub: url, copy: url };
  }
  if (kind === 'image') { const u = await getBlob(x.id); if (!u) throw new Error('The full-size image is missing'); return { type: 'image', src: u, blob: () => dataUrlToBlob(u), name: `copyit-image.${(x.image.mime.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, title: 'Image', sub: statLine(x, kind), img: true }; }
  if (kind === 'video') { const u = await getBlob(x.id); if (!u) throw new Error('The video data is missing'); const b = dataUrlToBlob(u); return { type: 'video', src: URL.createObjectURL(b), blob: () => b, name: `copyit-video.${(x.image.mime.split('/')[1] || 'mp4').replace('quicktime', 'mov')}`, title: 'Video', sub: statLine(x, kind) }; }
  if (kind === 'svg') return { type: 'svg', src: svgDataUri(c), blob: () => new Blob([c], { type: 'image/svg+xml' }), name: 'copyit-vector.svg', title: 'Vector (SVG)', sub: statLine(x, kind), copy: c };
  if (kind === 'datauri') {
    const m = dataUriMime(c), b = dataUrlToBlob(c), t = m.startsWith('video/') ? 'video' : m === 'application/pdf' ? 'pdf' : m === 'image/svg+xml' ? 'svg' : 'image';
    return { type: t, src: t === 'image' || t === 'svg' ? c : URL.createObjectURL(b), blob: () => b, name: `copyit-data.${(m.split('/')[1] || 'bin').split('+')[0]}`, title: 'Data URI', sub: statLine(x, kind), copy: c };
  }
  return null;
}
async function openLightbox(x) {
  let d; try { d = await describeMedia(x); } catch (err) { toast(err.message, 'err'); return; }
  if (!d) return;
  hscroll.leave();
  if (!lb) {
    lb = document.createElement('dialog'); lb.id = 'lightbox';
    lb.innerHTML = `<div class="lb-bar"><div class="lb-title"><b></b><small></small></div><span class="spacer"></span>
      <button class="btn sm" data-lb="open">${ICON.open}<span>Open in new tab</span></button><button class="btn sm" data-lb="dl">${ICON.download}<span>Download</span></button><button class="btn sm" data-lb="copy">${ICON.copy}<span>Copy</span></button><button class="ib" data-lb="close" title="Close (Esc)">${ICON.close}</button></div><div class="lb-body"></div>`;
    document.body.append(lb);
    lb.addEventListener('click', async e => {
      if (e.target === lb || e.target.classList?.contains('lb-body')) { lb.close(); return; }
      const img = e.target.closest('.lb-body img'); if (img) { img.parentNode.classList.toggle('zoom'); return; }
      const b = e.target.closest('[data-lb]'); if (!b) return;
      const cur = lb._d, act = b.dataset.lb;
      try {
        if (act === 'close') lb.close();
        else if (act === 'open') { const url = cur.openUrl || URL.createObjectURL(cur.blob()); await chrome.tabs.create({ url }); }
        else if (act === 'dl') { if (cur.blob) download(cur.name, cur.blob()); else window.open(cur.openUrl); toast('Download started'); }
        else if (act === 'copy') { if (cur.img) await writeClip({ 'image/png': cur.blob().type === 'image/png' ? cur.blob() : await toPngBlob(cur.src) }); else await navigator.clipboard.writeText(cur.copy || cur.openUrl || ''); toast('Copied'); }
      } catch (err) { toast(`Could not do that: ${err.message}`, 'err'); }
    });
    lb.addEventListener('close', () => { lb.querySelector('.lb-body').innerHTML = ''; });
  }
  lb._d = d;
  lb.querySelector('.lb-title b').textContent = d.title; lb.querySelector('.lb-title small').textContent = d.sub || '';
  lb.querySelector('[data-lb=dl]').hidden = d.type === 'web' || (!d.blob && !d.openUrl);
  lb.querySelector('[data-lb=copy]').hidden = !(d.img || d.copy || d.openUrl);
  lb.querySelector('[data-lb=open]').hidden = false;
  const body = lb.querySelector('.lb-body'); body.className = 'lb-body t-' + d.type + (d.type === 'svg' ? ' checker' : '');
  body.innerHTML = d.type === 'video' ? `<video src="${esc(d.src)}" controls autoplay loop playsinline></video>`
    : d.type === 'embed' ? `<iframe src="${esc(d.src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
    : d.type === 'pdf' ? `<iframe src="${esc(d.src)}"></iframe>`
    : d.type === 'web' ? `<iframe sandbox="allow-same-origin" referrerpolicy="no-referrer" src="${esc(d.src)}"></iframe><div class="lb-note">Some sites block being shown here. Use “Open in new tab”.</div>`
    : `<img alt="" src="${esc(d.src)}" onerror="this.replaceWith(Object.assign(document.createElement('p'),{textContent:'Could not load this file.'}))">`;
  lb.showModal();
}
$('list')?.addEventListener('click', e => {                         // the picture itself also opens the preview
  const w = e.target.closest('.imgwrap[data-peek]'); if (!w || e.target.closest('button, a')) return;
  const x = entries.find(i => i.id === w.closest('.entry')?.dataset.id); if (x) openPreview(x);
});
async function openPreview(x) {                                       // small window; falls back to an in-page viewer
  if (chrome.windows?.create) {
    const W = Math.min(560, screen.availWidth - 40), H = Math.min(500, screen.availHeight - 80);
    let url = chrome.runtime.getURL('viewer.html?id=' + encodeURIComponent(x.id));
    if (kindOf(x) === 'link') {                                       // websites and YouTube/Vimeo refuse to be framed: show the real page in the small window itself
      const u = safeUrl(String(x.content || '').trim().split(/\s+/)[0]), t = u && urlKind(u);
      if (t === 'web' || t === 'embed') url = (videoEmbed(u) || {}).watch || u;
    }
    try { await chrome.windows.create({ url, type: 'popup', width: W, height: H, left: Math.round((screen.availWidth - W) / 2), top: Math.round((screen.availHeight - H) / 3) }); return; } catch { }
  }
  openLightbox(x);
}


/* ───────────── backup & restore (format v2) ───────────── */
function csvEscape(v) { return '"' + String(v ?? '').replace(/"/g, '""') + '"'; }
const exportable = () => settings.excludeSensitiveFromExport ? entries.filter(x => hasBlob(x) || !sensitiveOf(x.content)) : entries;
function toCsv(items) {
  const cols = ['content', 'kind', 'tags', 'createdAt', 'copiedAt', 'updatedAt', 'favorite', 'pinned', 'copies', 'source'];
  return [cols.map(csvEscape).join(','), ...items.map(x => cols.map(k => csvEscape(k === 'tags' ? (x.tags || []).join(';') : k === 'kind' ? kindOf(x) : x[k])).join(','))].join('\r\n');
}
async function exportJson() {
  const items = exportable(), blobs = {};
  const imgs = items.filter(hasBlob);
  if (imgs.length) { const got = await chrome.storage.local.get(imgs.map(x => BLOB_PREFIX + x.id)); imgs.forEach(x => { const u = got[BLOB_PREFIX + x.id]; if (u) blobs[x.id] = u; }); }
  download('copyit-backup.json', JSON.stringify({ format: 'copyit', version: 2, exportedAt: new Date().toISOString(), entries: items, blobs, folders }, null, 2), 'application/json');
  toast(`Backup exported · ${plural(items.length, 'clip')}${imgs.length ? `, ${plural(imgs.length, 'media file')} included` : ''}`);
}
function exportTxt() {
  const items = exportable().filter(x => !hasBlob(x));
  if (!items.length) { toast('No text clips to export.', 'err'); return; }
  download('copyit-clips.txt', items.map(x => String(x.content || '')).join('\n\n----------\n\n'), 'text/plain;charset=utf-8');
  toast(`Exported ${plural(items.length, 'text clip')} as .txt`);
}
function exportMd() {
  const items = exportable().filter(x => !hasBlob(x));
  if (!items.length) { toast('No text clips to export.', 'err'); return; }
  const fenced = new Set(['code', 'json', 'css', 'html', 'xml', 'sql', 'csv']);
  const body = items.map(x => {
    const k = kindOf(x), tags = (x.tags || []).map(t => '#' + t).join(' '), c = String(x.content || '');
    const head = `## ${new Date(x.createdAt || Date.now()).toLocaleString()} · ${k}${tags ? ' · ' + tags : ''}`;
    const fence = fenced.has(k) ? '```' : '';
    return fence ? `${head}\n\n${fence}${k === 'code' ? '' : k}\n${c}\n${fence}` : `${head}\n\n${c}`;
  }).join('\n\n---\n\n');
  download('copyit-clips.md', `# Copyit clips\n\nExported ${new Date().toLocaleString()}\n\n---\n\n${body}\n`, 'text/markdown;charset=utf-8');
  toast(`Exported ${plural(items.length, 'text clip')} as Markdown`);
}
async function importPicked(files) {
  const list = [...files]; if (!list.length) return;
  for (const f of list) await handleDroppedFile(f);
}
function exportCsv() { download('copyit.csv', toCsv(exportable()), 'text/csv;charset=utf-8'); toast('Backup exported as CSV (image data is only in the JSON backup)'); }
function parseCsv(text) {
  const rows = parseCsvRows(text); if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(c => c.trim())).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

async function mergeImported(incoming, blobMap = {}, folderList = []) {
  let added = 0, updated = 0, skipped = 0;
  const fmap = {};
  for (const f of Array.isArray(folderList) ? folderList : []) {
    if (!f || !f.id || !f.name) continue;
    const have = folders.find(o => o.id === f.id || o.name.toLowerCase() === String(f.name).toLowerCase());
    if (have) fmap[f.id] = have.id; else { folders.push({ id: f.id, name: String(f.name).slice(0, 28) }); fmap[f.id] = f.id; }
  }
  if (Object.keys(fmap).length) await saveFolders();
  const writes = {}, flag = v => v === true || v === 'true';
  for (const raw of incoming) {
    if (!raw || typeof raw.content !== 'string' || !raw.content.trim()) continue;
    const content = raw.content.trim(), isImg = BLOB_KINDS.includes(raw.kind) && raw.image;
    const match = entries.find(x => isImg ? (raw.hash && x.hash === raw.hash) : (!hasBlob(x) && norm(x.content) === norm(content)));
    if (match) {
      match.favorite = match.favorite || flag(raw.favorite); match.pinned = match.pinned || flag(raw.pinned);
      if (raw.tags) match.tags = cleanTags([...(match.tags || []), ...cleanTags(raw.tags)]);
      updated++; continue;
    }
    if (isImg && !blobMap[raw.id]) { skipped++; continue; }                  // an image without its data cannot be restored
    const id = crypto.randomUUID();
    const kind = isImg ? raw.kind : (raw.kind === 'rich' && raw.html) ? 'rich' : detectKind(content);
    const e = { id, content, kind, createdAt: raw.createdAt || new Date().toISOString(), copiedAt: raw.copiedAt || raw.createdAt || new Date().toISOString(), updatedAt: raw.updatedAt || null, favorite: flag(raw.favorite), pinned: flag(raw.pinned), copies: Number(raw.copies) || 1, source: raw.source || 'import', hash: raw.hash || '' };
    if (kind === 'code') e.lang = raw.lang || languageOf(content);
    if (kind === 'rich') e.html = raw.html;
    if (isImg) { e.image = raw.image; writes[BLOB_PREFIX + id] = blobMap[raw.id]; }
    const tags = cleanTags(raw.tags); if (tags.length) e.tags = tags;
    if (raw.folder && fmap[raw.folder]) e.folder = fmap[raw.folder];
    entries.push(e); added++;
  }
  if (Object.keys(writes).length) await chrome.storage.local.set(writes);
  await persist();
  toast(`Import complete · ${added} added, ${updated} merged${skipped ? `, ${skipped} images skipped (no image data)` : ''}`);
}

async function importFile(f, { lenient = false } = {}) {
  if (!f) return;
  try {
    if (/\.csv$/i.test(f.name) || f.type === 'text/csv') return await mergeImported(parseCsv(await f.text()));
    const text = await f.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    const incoming = Array.isArray(data) ? data : data?.entries;
    if (Array.isArray(incoming)) return await mergeImported(incoming, (data && data.blobs) || {}, data && data.folders);
    if (lenient) return report(await saveText(text, 'drop'));
    throw new Error('Expected an entries array or a Copyit backup.');
  } catch (err) { toast(`Could not import: ${err.message}`, 'err'); }
}
async function handleDroppedFile(f) {
  const n = f.name || '';
  if (/\.(csv|json)$/i.test(n) || f.type === 'text/csv' || f.type === 'application/json') return importFile(f, { lenient: true });
  if (f.type.startsWith('image/')) return report(await saveImageBlob(f, 'drop'));
  if (f.type.startsWith('video/')) return report(await saveVideoBlob(f, 'drop'));
  if (f.type.startsWith('text/') || /\.(md|txt|svg|html)$/i.test(n)) return report(await saveText(await f.text(), 'drop'));
  toast(`Copyit saves text and images, so ${n || 'that file'} was skipped.`, 'err');
}

function clearAll() {
  const btn = $('clearAll'), all = !!$('clearIncl')?.checked;
  const removable = all ? entries.slice() : entries.filter(x => !x.pinned && !x.favorite);
  if (!removable.length) { toast(all ? 'Nothing to clear.' : 'Nothing to clear — pinned and starred clips are kept.', 'err'); return; }
  if (!btn.classList.contains('arm')) {
    btn.dataset.label = btn.textContent;
    btn.textContent = `Clear ${removable.length}? Tap again`;
    btn.classList.add('arm');
    btn._t = setTimeout(() => { btn.classList.remove('arm'); btn.textContent = btn.dataset.label; }, 3000);
    return;
  }
  clearTimeout(btn._t); btn.classList.remove('arm'); btn.textContent = btn.dataset.label;
  $('settingsDialog')?.open && $('settingsDialog').close();   // so the Undo toast is not hidden behind the modal
  const gone = removable.slice();
  entries = all ? [] : entries.filter(x => x.pinned || x.favorite);
  persist().then(() => { setTimeout(pruneBlobs, 6500); toast(`Cleared ${gone.length} clip${gone.length === 1 ? '' : 's'}${all ? '' : ' · pinned & starred kept'}`, 'ok', {
    label: 'Undo',
    fn: () => { const have = new Set(entries.map(e => e.id)); entries = entries.concat(gone.filter(g => !have.has(g.id))); persist(); }
  }); });
}

/* ───────────── settings (dashboard) ───────────── */
async function openSettings() {
  const d = $('settingsDialog'); if (!d) return;
  $('setBlur').checked = !!settings.blur;
  $('setExcl').checked = !!settings.excludeSensitiveFromExport;
  $('setLink').checked = settings.linkPreview !== false;
  $('setDays').value = String(settings.keepDays);
  $('setMax').value = String(settings.maxEntries);
  const imgs = entries.filter(hasBlob).length;
  let bytes = 0; try { bytes = await chrome.storage.local.getBytesInUse(null); } catch { }
  $('storageText').textContent = `${fmtBytes(bytes)} used · ${plural(entries.length, 'clip')}${imgs ? ` · ${plural(imgs, 'image/video')}` : ''}`;
  d.showModal();
}
async function saveSettings() {
  settings = { blur: $('setBlur').checked, excludeSensitiveFromExport: $('setExcl').checked, linkPreview: $('setLink').checked, keepDays: +$('setDays').value, maxEntries: +$('setMax').value };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  const before = entries.length;
  await autoClean();
  if (entries.length !== before) { toast(`Removed ${plural(before - entries.length, 'old clip')}`); pruneBlobs(); }
  render();
}

/* ───────────── events ───────────── */
$('clearAll')?.addEventListener('click', clearAll);
/* theme palette picker: appearance (light / dark / auto) + 12 gradients */
function reveal(el, apply) {                           // circular colour reveal from the clicked control
  if (document.startViewTransition && !reduce) {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => { });
  } else apply();
}
const MODES = [{ id: 'light', name: 'Light', icon: ICON.sun }, { id: 'dark', name: 'Dark', icon: ICON.moon }, { id: 'auto', name: 'Auto', icon: ICON.auto }];
function buildPalette() {
  const pal = document.createElement('div');
  pal.id = 'palette'; pal.className = 'palette'; pal.hidden = true;
  pal.innerHTML = `<div class="pal-label">Appearance</div>
    <div class="mode"><span class="thumb"></span>${MODES.map(m => `<button data-mode="${m.id}" title="${m.name}">${m.icon}${m.name}</button>`).join('')}</div>
    <div class="pal-label">Theme</div>
    <div class="pal-grid">${THEMES.map((t, i) =>
    `<button class="pal" data-theme-id="${t.id}" title="${t.name}" style="--i:${i};--pg:linear-gradient(180deg,${t.c[0]},${t.c[1]});--pc:${t.c[1]};--pt:${t.t}">${ICON.check}</button>`).join('')}</div><div class="pal-name"></div>`;
  document.body.append(pal);
  const label = pal.querySelector('.pal-name'), thumb = pal.querySelector('.mode .thumb');
  const mark = () => {
    pal.querySelectorAll('.pal').forEach(b => b.classList.toggle('on', b.dataset.themeId === curTheme()));
    const mi = MODES.findIndex(m => m.id === curMode());
    pal.querySelectorAll('.mode button').forEach((b, i) => b.classList.toggle('on', i === mi));
    thumb.style.transform = `translateX(${mi * 100}%)`;
  };
  const showName = () => { label.textContent = THEMES.find(t => t.id === curTheme())?.name || ''; };
  pal.addEventListener('mouseover', e => { const b = e.target.closest('.pal'); if (b) label.textContent = b.title; });
  pal.addEventListener('mouseleave', showName);
  pal.addEventListener('click', e => {
    const mb = e.target.closest('.mode button');
    if (mb) {
      reveal(mb, () => { setMode(mb.dataset.mode); try { localStorage.setItem('vaultMode', mb.dataset.mode); } catch { } mark(); });
      return;
    }
    const b = e.target.closest('.pal'); if (!b) return;
    reveal(b, () => { setTheme(b.dataset.themeId); try { localStorage.setItem('vaultTheme', b.dataset.themeId); } catch { } mark(); showName(); });
  });
  mark(); showName();
  return { pal, mark, showName };
}
const palette = $('themeBtn') ? buildPalette() : null;
$('themeBtn')?.addEventListener('click', e => {
  e.stopPropagation();
  const open = palette.pal.hidden; palette.pal.hidden = !open;
  if (open) { palette.mark(); palette.showName(); }
});
document.addEventListener('click', e => { if (palette && !palette.pal.hidden && !e.target.closest('#palette')) palette.pal.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && palette) palette.pal.hidden = true; });
$('typeChips')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-type]'); if (!b) return;
  typeFilter = b.dataset.type;
  $('typeChips').dataset.sig = '';
  render();
});
$('tagBar')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-tag]'); if (!b) return;
  activeTag = activeTag === b.dataset.tag ? '' : b.dataset.tag; render();
});
$('search')?.addEventListener('input', render);
$('saveClipboard')?.addEventListener('click', saveClipboard);
document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', openAdd));
$('openDashboard')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));
$('exportJson')?.addEventListener('click', exportJson);
$('exportCsv')?.addEventListener('click', exportCsv);
$('exportTxt')?.addEventListener('click', exportTxt);
$('exportMd')?.addEventListener('click', exportMd);
$('importAny')?.addEventListener('click', () => $('anyFile').click());
$('anyFile')?.addEventListener('change', async e => { await importPicked(e.target.files); e.target.value = ''; });
$('importJson')?.addEventListener('click', () => $('jsonFile').click());
$('importCsv')?.addEventListener('click', () => $('csvFile').click());
$('jsonFile')?.addEventListener('change', async e => { await importFile(e.target.files[0]); e.target.value = ''; });
$('csvFile')?.addEventListener('change', async e => { await importFile(e.target.files[0]); e.target.value = ''; });
$('openSettings')?.addEventListener('click', openSettings);
$('settingsClose')?.addEventListener('click', () => $('settingsDialog').close());
['setBlur', 'setExcl', 'setDays', 'setMax', 'setLink'].forEach(id => $(id)?.addEventListener('change', saveSettings));
$('settingsDialog')?.addEventListener('click', e => { if (e.target === $('settingsDialog')) $('settingsDialog').close(); });

$('filterChips')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-filter]'); if (!b) return;
  filter = b.dataset.filter;
  $('filterChips').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  moveThumb(); render();
});
$('sort')?.addEventListener('change', e => { sort = e.target.value; render(); });
$('viewToggle')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-view]'); if (!b) return;
  $('viewToggle').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  $('list').classList.toggle('grid', b.dataset.view === 'grid');
  try { localStorage.setItem('vaultView', b.dataset.view); } catch { }
});
try { if (localStorage.getItem('vaultView') === 'list') $('viewToggle')?.querySelector('[data-view=list]')?.click(); } catch { }

// add dialog
$('addForm')?.addEventListener('submit', e => { e.preventDefault(); submitAdd(); });
$('addCancel')?.addEventListener('click', () => $('addDialog').close());
$('addText')?.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitAdd(); } });
$('addDialog')?.addEventListener('click', e => { if (e.target === $('addDialog')) $('addDialog').close(); });

// keyboard: Alt+1..9 copies the nth visible clip, Enter in search copies the first match
async function quickCopy(n) {
  const el = $('list')?.querySelectorAll('.entry')[n]; if (!el) return;
  const item = entries.find(x => x.id === el.dataset.id); if (!item) return;
  const btn = el.querySelector('[data-action=copy]');
  try {
    await defaultCopy(item, kindOf(item));
    btn.classList.add('done'); btn.querySelector('.lbl').textContent = 'Copied'; burst(btn);
    setTimeout(() => { btn.classList.remove('done'); btn.querySelector('.lbl').textContent = 'Copy'; }, 1500);
    toast(`Copied clip ${n + 1}`);
  } catch (err) { toast(`Could not copy: ${err.message}`, 'err'); }
}
document.addEventListener('keydown', e => {
  const m = /^Digit([1-9])$/.exec(e.code || '');
  if (m && e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); quickCopy(+m[1] - 1); }
  else if (e.key === 'Enter' && e.target === $('search') && $('search').value.trim()) { e.preventDefault(); quickCopy(0); }
  else if (e.key === 'Escape' && e.target === $('search') && $('search').value) { $('search').value = ''; render(); }
});
// keyboard: "/" focuses search
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); $('search')?.focus(); }
});

// drag & drop (dashboard): backups, images, text files
if (isDash) {
  let depth = 0;
  const dz = $('dropzone');
  addEventListener('dragenter', e => { if (e.dataTransfer?.types?.includes('Files')) { depth++; dz.classList.add('show'); } });
  addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) dz.classList.remove('show'); });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', async e => { e.preventDefault(); depth = 0; dz.classList.remove('show'); for (const f of [...e.dataTransfer.files]) await handleDroppedFile(f); });
}

// list interactions
$('list')?.addEventListener('input', e => { if (e.target.matches('textarea')) draft = e.target.value; else if (e.target.matches('.tags-edit input')) draftTags = e.target.value; });
$('list')?.addEventListener('click', async e => {
  const button = e.target.closest('button[data-action]'); if (!button) return;
  const article = button.closest('.entry');
  const item = entries.find(x => x.id === article.dataset.id); if (!item) return;
  const kind = kindOf(item);
  const flash = (id, action) => { const b = document.querySelector(`.entry[data-id="${CSS.escape(id)}"] [data-action="${action}"]`); if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } };

  switch (button.dataset.action) {
    case 'favorite': item.favorite = !item.favorite; await persist(); flash(item.id, 'favorite'); break;
    case 'pin': item.pinned = !item.pinned; await persist(); flash(item.id, 'pin'); break;
    case 'copy':
      try {
        await defaultCopy(item, kind);
        button.classList.add('done'); button.querySelector('.lbl').textContent = 'Copied'; burst(button);
        setTimeout(() => { button.classList.remove('done'); button.querySelector('.lbl').textContent = 'Copy'; }, 1500);
      } catch (err) { toast(`Could not copy: ${err.message}`, 'err'); }
      break;
    case 'menu': openMenu(button, item); break;
    case 'reveal': revealed.add(item.id); render(); break;
    case 'tag': activeTag = activeTag === button.dataset.tag ? '' : button.dataset.tag; render(); break;
    case 'preview': openPreview(item); break;
    case 'share': openShare(item); break;
    case 'open': { const u = item.content.trim(); if (/^https?:\/\//i.test(u)) chrome.tabs.create({ url: u }); break; }
    case 'toggle': {
      const t = article.querySelector('.entry-text'); const open = t.classList.toggle('clamped');
      button.textContent = open ? 'Show more' : 'Show less'; break;
    }
    case 'edit': editingId = item.id; draft = item.content; draftTags = (item.tags || []).join(', '); article.classList.add('editing'); (article.querySelector('textarea') || article.querySelector('.tags-edit input')).focus(); break;
    case 'cancel-edit': editingId = null; draft = ''; draftTags = ''; render(); break;
    case 'save-edit': {
      const tags = cleanTags(article.querySelector('.tags-edit input').value);
      if (!hasBlob(item)) {
        const text = article.querySelector('textarea').value.trim();
        if (!text) { toast('Text cannot be empty.', 'err'); return; }
        if (text !== item.content) {
          item.content = text; item.updatedAt = new Date().toISOString();
          delete item.html; delete item.kind; delete item.lang;          // re-detect the format after an edit
          item.kind = detectKind(text); if (item.kind === 'code') item.lang = languageOf(text);
          kindCache.delete(item);
        }
      }
      if (tags.length) item.tags = tags; else delete item.tags;
      editingId = null; draft = ''; draftTags = '';
      await persist(); toast('Entry updated'); break;
    }
    case 'delete':
      if (!button.classList.contains('arm')) {            // first click arms, second confirms
        button.classList.add('arm');
        button._t = setTimeout(() => button.classList.remove('arm'), 2600);
        break;
      }
      clearTimeout(button._t);
      article.style.height = article.offsetHeight + 'px';
      void article.offsetHeight;
      article.classList.add('removing');
      setTimeout(async () => { entries = entries.filter(x => x.id !== item.id); await persist(); toast('Entry deleted'); pruneBlobs(); }, reduce ? 0 : 330);
      break;
  }
});

function burst(btn) {
  if (reduce) return;
  const colors = ['#ff7a59', '#f2402a', '#fbbf24', '#fb7185', '#34d399', '#a855f7'];
  const r0 = btn.getBoundingClientRect(), cx = r0.left + r0.width / 2 - 3, cy = r0.top + r0.height / 2 - 3;
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('span'), a = (i / 10) * Math.PI * 2 + Math.random() * .5, r = 28 + Math.random() * 20;
    p.className = 'particle';
    p.style.cssText = `left:${cx}px;top:${cy}px;--c:${colors[i % 6]};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px`;
    document.body.append(p);
    setTimeout(() => p.remove(), 750);
  }
}

// keep "5m ago" labels fresh
setInterval(() => document.querySelectorAll('.when[data-t]').forEach(el => { el.textContent = rel(el.dataset.t); }), 30000);
addEventListener('resize', moveThumb);

/* ───────────── support / donation options (rendered from storage) ───────────── */
let donateDlg;
const shortAddr = a => a.length > 22 ? a.slice(0, 10) + '…' + a.slice(-8) : a;
function renderDonate() {
  const live = DONATE_DEFAULTS.map(o => ({ o, url: donateUrl(o) })).filter(({ o, url }) => o.type === 'crypto' ? String(o.value || '').trim() : url);
  donateDlg.querySelector('.dn-body').innerHTML = `<div class="dn-grid">${live.map(({ o, url }) => {
    const p = DONATE_PROVIDERS[o.type], name = o.type === 'crypto' ? (o.label || 'Crypto') : p.name;
    const inner = `<span class="dn-badge" style="--c:${p.color}">${esc(o.glyph || p.glyph)}</span><span class="dn-txt"><b>${esc(name)}</b><small>${esc(o.type === 'crypto' ? shortAddr(o.value.trim()) : url.replace(/^https?:\/\/(www\.)?/, ''))}</small></span>`;
    return o.type === 'crypto'
      ? `<button class="dn" data-copy="${esc(o.value.trim())}" title="Copy ${esc(name)} address">${inner}${ICON.copy}</button>`
      : `<a class="dn" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Open ${esc(name)}">${inner}${ICON.open}</a>`;
  }).join('')}</div>`;
}
function openDonate() {
  if (!donateDlg) {
    donateDlg = document.createElement('dialog'); donateDlg.id = 'donateDialog';
    donateDlg.innerHTML = `<div class="set"><h2>${ICON.heart}Support Copyit</h2><p>Copyit is free and private. If it saves you time, you can chip in. Thank you!</p><div class="dn-body"></div><div class="dlg-foot dn-foot"><span class="spacer"></span><button class="btn primary sm" data-dn="close">Done</button></div></div>`;
    document.body.append(donateDlg);
    donateDlg.addEventListener('click', async e => {
      if (e.target === donateDlg) { donateDlg.close(); return; }
      const c = e.target.closest('[data-copy]');
      if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); toast('Wallet address copied'); } catch { toast('Could not copy', 'err'); } return; }
      if (e.target.closest('[data-dn=close]')) donateDlg.close();
    });
  }
  renderDonate(); donateDlg.showModal();
}
$('donate')?.addEventListener('click', openDonate);
$('popSettings')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html#settings') }));
const boot = () => load().then(() => { if (isDash && location.hash === '#settings') openSettings(); });
document.readyState === 'loading' ? addEventListener('DOMContentLoaded', boot) : boot();   // after share.js has loaded
requestAnimationFrame(moveThumb);
