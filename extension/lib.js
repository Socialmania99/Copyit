/* Copyit shared library: format detection, parsing, rendering helpers and retention rules.
   Loaded by the popup and dashboard with <script> and by the background worker with importScripts. No DOM needed. */
var CopyitLib = (() => {
  const KEY = 'savedTexts', BLOB_PREFIX = 'copyitBlob:', SETTINGS = 'copyitSettings';
  const DEFAULT_SETTINGS = { blur: true, keepDays: 0, maxEntries: 1000, excludeSensitiveFromExport: false, linkPreview: true };
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
  const FOLDERS = 'copyitFolders';
  const BLOB_KINDS = ['image', 'video'];
  // PayPal donation link (the heart icon opens it).

  // ---- Video sites that must be shown through their embed player (YouTube pages refuse to be framed) ----
  const ytTime = v => { if (!v) return 0; if (/^\d+$/.test(v)) return +v; const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
  const videoEmbed = u => {
    let x; try { x = new URL(String(u).trim()); } catch { return null; }
    if (!/^https?:$/.test(x.protocol)) return null;
    const h = x.hostname.replace(/^(www|m|music)\./, '');
    let id = '';
    if (h === 'youtu.be') id = x.pathname.slice(1).split('/')[0];
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if (x.pathname === '/watch') id = x.searchParams.get('v') || '';
      else { const m = /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(x.pathname); if (m) id = m[1]; }
    }
    if (/^[\w-]{11}$/.test(id)) {
      const t = ytTime(x.searchParams.get('t') || x.searchParams.get('start'));
      return { provider: 'youtube', label: 'YouTube video', id, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, watch: `https://www.youtube.com/watch?v=${id}${t ? '&t=' + t + 's' : ''}`,
        embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1${t ? '&start=' + t : ''}` };
    }
    if (h === 'vimeo.com' || h === 'player.vimeo.com') {
      const m = /\/(\d{5,12})(?:\/|$)/.exec(x.pathname);
      if (m) return { provider: 'vimeo', label: 'Vimeo video', id: m[1], thumb: '', watch: `https://vimeo.com/${m[1]}`, embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1` };
    }
    return null;
  };

  // ---- Donation options (rendered dynamically; users/owner can edit them in the Support dialog, stored in chrome.storage.local) ----
  const DONATE_KEY = 'copyitDonate';
  const DONATE_PROVIDERS = {
    paypal:  { name: 'PayPal',          base: 'https://www.paypal.me/',          color: '#0070ba', glyph: 'P', hint: 'PayPal.Me name or full link' },
    bmc:     { name: 'Buy Me a Coffee', base: 'https://buymeacoffee.com/',       color: '#f5b800', glyph: '☕', hint: 'username or full link' },
    patreon: { name: 'Patreon',         base: 'https://www.patreon.com/',        color: '#ff424d', glyph: 'P', hint: 'creator name or full link' },
    kofi:    { name: 'Ko-fi',           base: 'https://ko-fi.com/',              color: '#29abe0', glyph: 'K', hint: 'username or full link' },
    github:  { name: 'GitHub Sponsors', base: 'https://github.com/sponsors/',    color: '#8250df', glyph: '♥', hint: 'GitHub username or full link' },
    custom:  { name: 'Other link',      base: '',                                color: '#64748b', glyph: '↗', hint: 'full https:// link' },
    crypto:  { name: 'Crypto wallet',   base: '',                                color: '#f7931a', glyph: '₿', hint: 'wallet address' }
  };
  // Edit these defaults to ship your own links. A blank value is hidden from supporters until you fill it in.
  const DONATE_DEFAULTS = [
    { id: 'paypal', type: 'paypal', value: 'Adityak3' },
    { id: 'kofi',   type: 'kofi',   value: 'socialmania99' },
    { id: 'btc',    type: 'crypto', label: 'Bitcoin (BTC)',  value: 'bc1pewuprnfcjuazmhrtuqsv2t7gxj2xxd5zxjrxtrhfaxu34q3jlsxq2nehtt' },
    { id: 'eth',    type: 'crypto', label: 'Ethereum (ETH)', glyph: 'Ξ', value: '0xAccdd7DBb0a79E49115B3a8efDad817e8E5AECd9' },
    { id: 'sol',    type: 'crypto', label: 'Solana (SOL)',   glyph: '◎', value: 'H8NsgqfJH53YjwVmcPuMeAJ4qxHnuaRVb7rDnAo24z5J' }
  ];
  const donateUrl = o => {                       // handle or https link -> safe https URL ('' when unset/invalid)
    const v = String((o && o.value) || '').trim(); if (!v || !o || o.type === 'crypto') return '';
    if (/^https?:\/\//i.test(v)) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } }
    const p = DONATE_PROVIDERS[o.type]; if (!p || !p.base || !/^@?[\w.\-]{1,60}$/.test(v)) return '';
    return p.base + encodeURIComponent(v.replace(/^@/, ''));
  };
  const DONATE_URL = donateUrl(DONATE_DEFAULTS[0]);

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  const stamp = x => new Date(x.copiedAt || x.createdAt).getTime() || 0;

  /* ---------- CSV ---------- */
  function parseCsvRows(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
      else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    return rows;
  }
  function csvInfo(text) {
    const t = String(text).trim();
    if (t.length > 400000 || t.indexOf('\n') < 0 || t.indexOf(',') < 0) return null;
    const rows = parseCsvRows(t).filter(r => r.some(c => c.trim() !== ''));
    if (rows.length < 2) return null;
    const cols = rows[0].length;
    if (cols < 2) return null;
    if (rows[0].some(h => h.length > 40 || /[.!?]\s*$/.test(h.trim()) && h.trim().split(/\s+/).length > 4)) return null;
    const same = rows.filter(r => r.length === cols).length;
    if (same / rows.length < 0.8) return null;
    return { rows, cols, count: rows.length - 1 };
  }

  /* ---------- JSON ---------- */
  function jsonInfo(text) {
    const t = String(text).trim();
    if (t.length > 1000000 || !/^[\[{][\s\S]*[\]}]$/.test(t)) return null;
    try {
      const v = JSON.parse(t);
      if (v === null || typeof v !== 'object') return null;
      const isArr = Array.isArray(v);
      return { pretty: JSON.stringify(v, null, 2), mini: JSON.stringify(v), isArray: isArr, count: isArr ? v.length : Object.keys(v).length, value: v };
    } catch { return null; }
  }

  /* ---------- SVG / data URIs / links ---------- */
  const SVG_RE = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?<svg[\s>][\s\S]*<\/svg>\s*$/i;
  const DATA_RE = /^data:([a-z]+\/[a-z0-9.+-]+)?((?:;[a-z0-9=.+-]+)*),[\s\S]+$/i;
  const URL_RE = /^https?:\/\/\S+$/i;
  const isSvg = t => SVG_RE.test(t);
  const dataUriMime = t => { const m = DATA_RE.exec(String(t).trim()); return m ? (m[1] || 'text/plain').toLowerCase() : ''; };
  const svgDataUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(String(svg).trim());
  const domainOf = t => { try { return new URL(String(t).trim()).hostname.replace(/^www\./, ''); } catch { return ''; } };

  /* ---------- markdown ---------- */
  function isMarkdown(t) {
    const s = String(t);
    if (s.length < 3) return false;
    const heading = /^#{1,6}\s+\S/m.test(s);
    const fence = /^```/m.test(s);
    const task = /^\s*[-*+]\s+\[[ xX]\]\s/m.test(s);
    const list = (s.match(/^\s*([-*+]|\d+\.)\s+\S/gm) || []).length >= 2;
    const bold = /\*\*[^*\n]+\*\*/.test(s);
    const link = /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/.test(s);
    const quote = /^>\s+\S/m.test(s);
    const strong = heading || fence || task;
    const weak = [list, bold, link, quote].filter(Boolean).length;
    return strong || weak >= 2;
  }
  function mdToHtml(src) {
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const inline = s => {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return s;
    };
    const out = []; let list = null, para = [], quote = [];
    const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const flushQuote = () => { if (quote.length) { out.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>'); quote = []; } };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line)) {
        flushAll(); const code = [];
        for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i]);
        out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); continue;
      }
      let m;
      if (!line.trim()) { flushAll(); continue; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { flushAll(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
      if ((m = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line))) {
        flushPara(); flushQuote(); if (list !== 'ul') { flushList(); out.push('<ul class="tasks">'); list = 'ul'; }
        out.push(`<li><input type="checkbox" disabled${m[1] !== ' ' ? ' checked' : ''}> ${inline(m[2])}</li>`); continue;
      }
      if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) {
        flushPara(); flushQuote(); if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; }
        out.push(`<li>${inline(m[1])}</li>`); continue;
      }
      if ((m = /^\s*\d+\.\s+(.*)$/.exec(line))) {
        flushPara(); flushQuote(); if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; }
        out.push(`<li>${inline(m[1])}</li>`); continue;
      }
      if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); quote.push(m[1]); continue; }
      flushList(); flushQuote(); para.push(line.trim());
    }
    flushAll();
    return out.join('');
  }

  /* ---------- code / language ---------- */
  const CODE_RE = /(=>|[{};]\s*$|^\s*(npm|npx|yarn|pnpm|git|pip|sudo|docker|curl|cd|ls|brew|apt|chmod)\s|^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s|^\s*(const|let|var|function|class|import|export|def|return|if|for|async|await)\b|<\/?[a-z][\w-]*[^>]*>|\b[a-z-]+\s*:\s*[^;]+;)/im;
  function languageOf(t) {
    const s = String(t);
    if (/^\s*(<\?xml|<!doctype|<(html|head|body|div|span|p|ul|ol|li|a|section|main|nav|table|form|button|input|img)\b)/i.test(s)) return 'html';
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(s)) return 'sql';
    if (/^\s*(npm|npx|yarn|pnpm|git|pip|sudo|docker|curl|cd|ls|brew|apt|chmod|export)\s|^\s*\$\s/m.test(s)) return 'shell';
    if (/^\s*(def\s+\w+\(|class\s+\w+(\(.*\))?:|from\s+\w+\s+import|import\s+\w+\s*$|print\()/m.test(s)) return 'python';
    if (/(^|\n)\s*[.#]?[\w-]+([\s>+~,][\s\w.#>+~-]*)?\{[^}]*:[^}]*\}/.test(s) || (/^\s*[\w-]+\s*:\s*[^;]+;\s*$/m.test(s) && !/(=>|\bconst\b|\blet\b|\bvar\b|\bfunction\b)/.test(s))) return 'css';
    if (/(=>|\bconst\b|\blet\b|\bvar\b|\bfunction\b|\bconsole\.|\bimport\s.+\sfrom\b|\bexport\b|\bawait\b|\basync\b|;\s*$)/m.test(s)) return 'js';
    return 'code';
  }
  const LANG_LABEL = { js: 'JavaScript', python: 'Python', sql: 'SQL', shell: 'Shell', html: 'HTML', css: 'CSS', code: 'Code' };

  /* ---------- kind detection ---------- */
  function detectKind(content) {
    const t = String(content ?? '').trim();
    if (!t) return 'text';
    if (isSvg(t)) return 'svg';
    if (DATA_RE.test(t) && !/\s{2,}/.test(t.slice(0, 200)) && t.length > 20) return 'datauri';
    if (URL_RE.test(t)) return 'link';
    if (jsonInfo(t)) return 'json';
    if (csvInfo(t)) return 'csv';
    if (isMarkdown(t)) return 'markdown';
    if (CODE_RE.test(t)) return 'code';
    return 'text';
  }

  /* ---------- sensitive data ---------- */
  function luhn(d) { let sum = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return sum % 10 === 0; }
  function sensitiveOf(content) {
    const t = String(content ?? '');
    if (t.length > 20000) return '';
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) return 'Private key';
    if (/^\s*eyJ[\w-]{5,}\.eyJ[\w-]{5,}\.[\w-]{5,}\s*$/.test(t)) return 'JWT token';
    if (/\b(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_\w{20,}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})\b/.test(t)) return 'API key';
    const digits = t.replace(/[ -]/g, '');
    if (/^\d{13,19}$/.test(digits) && /^\s*(\d[ -]?){13,19}\s*$/.test(t) && luhn(digits)) return 'Card number';
    if (/\b(pass(word)?|pwd|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"']{6,}/i.test(t) && t.length < 300) return 'Password or secret';
    return '';
  }

  /* ---------- rich text ---------- */
  function htmlFeatures(html) {
    const h = String(html || ''), f = [];
    if (/<(b|strong)\b/i.test(h)) f.push('Bold');
    if (/<(i|em)\b/i.test(h)) f.push('Italic');
    if (/<u\b/i.test(h)) f.push('Underline');
    if (/<a\s[^>]*href/i.test(h)) f.push('Links');
    if (/<h[1-6]\b/i.test(h)) f.push('Headings');
    if (/<(ul|ol|li)\b/i.test(h)) f.push('Lists');
    if (/<table\b/i.test(h)) f.push('Table');
    if (/<(pre|code)\b/i.test(h)) f.push('Code');
    if (/<img\b/i.test(h)) f.push('Images');
    if (/<blockquote\b/i.test(h)) f.push('Quote');
    return f;
  }
  const isRichHtml = (html, plain) => htmlFeatures(html).length > 0 && String(plain || '').trim().length > 0;

  /* ---------- tags ---------- */
  function cleanTags(v) {
    const list = Array.isArray(v) ? v : String(v || '').split(/[,;\n]/);
    const out = [];
    for (let t of list) { t = String(t).trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24); if (t && !out.includes(t)) out.push(t); if (out.length >= 8) break; }
    return out;
  }

  /* ---------- entries ---------- */
  async function sha(buf) { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(''); }
  const hashText = s => sha(new TextEncoder().encode(s));

  function kindOfEntry(x, cache) {
    if (x.kind) return x.kind;
    let k = cache && cache.get(x);
    if (!k) { k = detectKind(x.content); cache && cache.set(x, k); }
    return k;
  }

  /* Retention: drop old / excess clips but never pinned or starred ones. */
  function applyRetention(items, s) {
    const settings = { ...DEFAULT_SETTINGS, ...(s || {}) };
    const now = Date.now(), removed = [];
    let kept = items.filter(x => {
      if (x.pinned || x.favorite) return true;
      if (settings.keepDays > 0 && now - stamp(x) > settings.keepDays * 864e5) { removed.push(x); return false; }
      return true;
    });
    if (settings.maxEntries > 0) {
      const loose = kept.filter(x => !x.pinned && !x.favorite);
      if (loose.length > settings.maxEntries) {
        const drop = new Set(loose.sort((a, b) => stamp(a) - stamp(b)).slice(0, loose.length - settings.maxEntries).map(x => x.id));
        kept = kept.filter(x => { if (drop.has(x.id)) { removed.push(x); return false; } return true; });
      }
    }
    return { kept, removed };
  }

  return { KEY, BLOB_PREFIX, SETTINGS, DEFAULT_SETTINGS, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, FOLDERS, BLOB_KINDS, videoEmbed, DONATE_URL, DONATE_KEY, DONATE_PROVIDERS, DONATE_DEFAULTS, donateUrl, esc, norm, stamp, parseCsvRows, csvInfo, jsonInfo, isSvg, dataUriMime, svgDataUri, domainOf, isMarkdown, mdToHtml, languageOf, LANG_LABEL, detectKind, sensitiveOf, htmlFeatures, isRichHtml, cleanTags, sha, hashText, kindOfEntry, applyRetention };
})();
