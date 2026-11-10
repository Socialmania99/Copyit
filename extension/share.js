/* Copyit "Scan to open": every short clipboard gets its own QR code.
 * Fully offline: no server, no account, no expiry. Nothing leaves this device.
 *   link  -> the QR is the URL itself (the phone opens it in its browser)
 *   text  -> the QR holds the text itself (any camera app shows it); up to 5 KB, split into numbered pages
 * QR codes are drawn locally (qrcode.js, MIT). */
qrcode.stringToBytes = s => Array.from(new TextEncoder().encode(s));        // UTF-8 payloads

const SH_ICON = {
  share: '<svg class="i" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  qr: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/></svg>'
};

function qrSvg(text) {
  let qr; for (const ecc of ['M', 'L']) { try { qr = qrcode(0, ecc); qr.addData(text); qr.make(); break; } catch (e) { qr = null; if (ecc === 'L') throw e; } }
  const n = qr.getModuleCount(); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code"><path d="${d}" fill="#161616"/></svg>`;
}

const SCAN_MAX_BYTES = 5 * 1024, SCAN_PAGE = 700, SCAN_LINK_MAX = 1800;
const byteLen = s => new TextEncoder().encode(s).length;
const kb = n => (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
function scanPlan(x) {
  if (hasBlob(x)) return { mode: 'none', why: 'Scan to open works for short text and links only. Images, videos and files are too big for a QR code.' };
  const t = String(x.content || '').trim();
  if (!t) return { mode: 'none', why: 'This clipboard is empty.' };
  const size = byteLen(t);
  if (/^https?:\/\/\S+$/i.test(t) && size <= SCAN_LINK_MAX) return { mode: 'link', pages: [t], size };
  if (size > SCAN_MAX_BYTES) return { mode: 'none', why: `Scan to open works for clips up to 5 KB. This one is ${kb(size)}. Shorten it, or use Copy and Export instead.` };
  const pages = []; let cur = '', n = 0;
  for (const ch of Array.from(t)) { const b = byteLen(ch); if (n + b > SCAN_PAGE) { pages.push(cur); cur = ''; n = 0; } cur += ch; n += b; }
  if (cur) pages.push(cur);
  return { mode: 'text', size, pages: pages.length > 1 ? pages.map((p, i) => `(${i + 1}/${pages.length}) ${p}`) : pages };
}

let shDlg, shItem, shPage = 0;
function shFrame() {
  if (shDlg) return;
  shDlg = document.createElement('dialog'); shDlg.id = 'shareDialog';
  document.body.append(shDlg);
  shDlg.addEventListener('click', e => {
    if (e.target === shDlg) { shDlg.close(); return; }
    const b = e.target.closest('[data-sh]'); if (!b) return;
    const a = b.dataset.sh;
    if (a === 'close') shDlg.close();
    else if (a === 'prev') { shPage--; shRender(); }
    else if (a === 'next') { shPage++; shRender(); }
  });
}
function shRender() {
  const pl = scanPlan(shItem);
  let h = `<div class="sh-card"><div class="sh-top"><span class="sh-pill">${SH_ICON.share}Share clipboard</span><button class="ib sh-x" data-sh="close" title="Close (Esc)">${ICON.close}</button></div>`;
  if (pl.mode === 'none') h += `<div class="sh-qrbox empty"><div class="sh-ph">${SH_ICON.qr}</div></div><h3>Can't make a QR code</h3><p>${esc(pl.why)}</p>`;
  else {
    shPage = Math.min(Math.max(0, shPage), pl.pages.length - 1);
    const many = pl.pages.length > 1;
    h += `<div class="sh-qrbox">${qrSvg(pl.pages[shPage])}</div>`;
    if (pl.mode === 'link') h += `<h3>Scan to open</h3><p>Instantly open this link on your mobile device. The phone needs internet to load the page.</p>`;
    else h += `<h3>${many ? `Scan page ${shPage + 1} of ${pl.pages.length}` : 'Scan to open'}</h3><p>${many ? 'Scan the pages in order. Each one is plain text that any camera app can read.' : 'Instantly open this clipboard on your mobile device. Any camera app can read it.'}</p>`;
    if (many) h += `<div class="sh-pg"><button class="btn sm" data-sh="prev" ${shPage ? '' : 'disabled'}>‹ Prev</button><span>${shPage + 1} / ${pl.pages.length}</span><button class="btn sm" data-sh="next" ${shPage < pl.pages.length - 1 ? '' : 'disabled'}>Next ›</button></div>`;
    h += `<div class="sh-exp">${kb(pl.size)} of 5 KB · works offline · never leaves this device</div>`;
  }
  shDlg.innerHTML = h + '</div>';
}
function openShare(x) { shFrame(); shItem = x; shPage = 0; shRender(); if (!shDlg.open) shDlg.showModal(); }
