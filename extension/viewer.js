/* Copyit small-window preview: viewer.html?id=<clip id>. Renders images, vectors, videos, PDFs and links. */
const { KEY, BLOB_PREFIX, videoEmbed, esc, svgDataUri, dataUriMime, domainOf, kindOfEntry } = CopyitLib;
const $ = id => document.getElementById(id);
try {                                                  // same theme as the dashboard
  const t = localStorage.getItem('vaultTheme'), m = localStorage.getItem('vaultMode');
  if (t && t !== 'coral') document.documentElement.dataset.theme = t;
  if (m === 'light' || m === 'dark') document.documentElement.dataset.mode = m;
} catch { }

const VIDEO_URL = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const urlKind = u => videoEmbed(u) ? 'embed' : /\.pdf(\?|#|$)/i.test(u) ? 'pdf' : VIDEO_URL.test(u) ? 'video' : /\.svg(\?|#|$)/i.test(u) ? 'svg' : /\.(png|jpe?g|gif|webp|avif|bmp|ico)(\?|#|$)/i.test(u) ? 'image' : 'web';
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
function dataUrlToBlob(u) {
  const i = u.indexOf(','), head = u.slice(0, i), body = u.slice(i + 1), mime = /^data:([^;,]+)/.exec(head)?.[1] || 'application/octet-stream';
  if (/;base64/i.test(head)) { const bin = atob(body.replace(/\s/g, '')); const a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k); return new Blob([a], { type: mime }); }
  return new Blob([decodeURIComponent(body)], { type: mime });
}
function toast(msg) { const t = $('vToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); }
const sizeText = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

async function describe(x) {
  const kind = kindOfEntry(x), c = String(x.content || '').trim();
  const blob = async () => (await chrome.storage.local.get(BLOB_PREFIX + x.id))[BLOB_PREFIX + x.id] || '';
  if (kind === 'link') { const url = safeUrl(c.split(/\s+/)[0]); if (!url) return null; const em = videoEmbed(url); return { type: urlKind(url), src: em ? em.embed : url, thumb: em && em.thumb, provider: em && em.provider, openUrl: em ? em.watch : url, title: domainOf(url) || url, sub: url, copy: url }; }
  if (kind === 'image') { const u = await blob(); if (!u) throw new Error('The full-size image is missing.'); return { type: 'image', src: u, blob: () => dataUrlToBlob(u), name: `copyit-image.${(x.image.mime.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, title: 'Image', sub: `${x.image.w}×${x.image.h} · ${sizeText(x.image.size)}`, png: true }; }
  if (kind === 'video') { const u = await blob(); if (!u) throw new Error('The video data is missing.'); const b = dataUrlToBlob(u); return { type: 'video', src: URL.createObjectURL(b), blob: () => b, name: `copyit-video.${(x.image.mime.split('/')[1] || 'mp4').replace('quicktime', 'mov')}`, title: 'Video', sub: `${x.image.w}×${x.image.h} · ${sizeText(x.image.size)}` }; }
  if (kind === 'svg') return { type: 'svg', src: svgDataUri(c), blob: () => new Blob([c], { type: 'image/svg+xml' }), name: 'copyit-vector.svg', title: 'Vector (SVG)', sub: sizeText(new Blob([c]).size), copy: c };
  if (kind === 'datauri') {
    const m = dataUriMime(c), b = dataUrlToBlob(c), t = m.startsWith('video/') ? 'video' : m === 'application/pdf' ? 'pdf' : m === 'image/svg+xml' ? 'svg' : 'image';
    return { type: t, src: t === 'image' || t === 'svg' ? c : URL.createObjectURL(b), blob: () => b, name: `copyit-data.${(m.split('/')[1] || 'bin').split('+')[0]}`, title: 'Data URI', sub: m, copy: c };
  }
  return null;
}
async function toPng(src) {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
  return await new Promise(r => c.toBlob(r, 'image/png'));
}
function probe(url) {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const im = new Image(); im.referrerPolicy = 'no-referrer'; im.onload = () => fin('image'); im.src = url;
    const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.onloadedmetadata = () => fin('video'); v.src = url;
    setTimeout(() => fin(null), 5000);
  });
}
function wire(d) {
    $('vOpen').onclick = () => chrome.tabs.create({ url: d.openUrl || URL.createObjectURL(d.blob()) });
    $('vDl').onclick = () => { if (d.blob) { const u = URL.createObjectURL(d.blob()), a = document.createElement('a'); a.href = u; a.download = d.name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); toast('Download started'); } else chrome.tabs.create({ url: d.openUrl }); };
    $('vCopy').onclick = async () => {
      try {
        if (d.png) { const b = d.blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b.type === 'image/png' ? b : await toPng(d.src) })]); }
        else await navigator.clipboard.writeText(d.copy || d.openUrl || '');
        toast('Copied');
      } catch (err) { toast('Could not copy: ' + err.message); }
    };
}
(async () => {
  const body = $('vBody'), id = new URLSearchParams(location.search).get('id');
  try {
    const items = (await chrome.storage.local.get(KEY))[KEY] || [];
    const x = items.find(i => i.id === id);
    if (!x) { body.innerHTML = '<p class="v-msg">This clip no longer exists.</p>'; return; }
    const d = await describe(x);
    if (!d) { body.innerHTML = '<p class="v-msg">Nothing to preview for this clip.</p>'; return; }
    document.title = `${d.title} · Copyit`; $('vTitle').textContent = d.title; $('vSub').textContent = d.sub || '';
    body.className = 'lb-body t-' + d.type + (d.type === 'svg' ? ' checker' : '');
    if (d.type === 'embed') {                              // poster first; the click (a user gesture) starts the real player
      body.innerHTML = `<div class="yt">${d.thumb ? `<img class="yt-thumb" alt="" src="${esc(d.thumb)}">` : ''}<button class="yt-play" title="Play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button><div class="lb-note">Plays in Copyit through the ${d.provider === 'vimeo' ? 'Vimeo' : 'YouTube'} player. If it does not start, use “Open in new tab”.</div></div>`;
      body.querySelector('.yt-thumb')?.addEventListener('error', e => e.target.remove());
      body.querySelector('.yt-play').onclick = () => { body.querySelector('.yt').innerHTML = `<iframe src="${esc(d.src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`; };
      $('vOpen').hidden = false; $('vDl').hidden = true; $('vCopy').hidden = false; wire(d); return;
    }
    body.innerHTML = d.type === 'video' ? `<video src="${esc(d.src)}" controls autoplay loop playsinline></video>`
      : d.type === 'pdf' ? `<iframe src="${esc(d.src)}"></iframe>`
      : d.type === 'web' ? `<iframe sandbox="allow-same-origin" referrerpolicy="no-referrer" src="${esc(d.src)}"></iframe><div class="lb-note">Some sites block being shown here. Use “Open in new tab”.</div>`
      : `<img alt="" src="${esc(d.src)}">`;
    const vid = body.querySelector('video');                  // sound autoplay can be blocked in a fresh window: fall back to muted autoplay
    if (vid) vid.play().catch(() => { vid.muted = true; vid.play().catch(() => { }); });
    if (d.type === 'web') probe(d.src).then(k => {          // extension-less image/video URLs: show them as media instead of an empty frame
      if (!k || !body.querySelector('iframe')) return;
      d.type = k; body.className = 'lb-body t-' + k;
      body.innerHTML = k === 'image' ? `<img alt="" src="${esc(d.src)}">` : `<video src="${esc(d.src)}" controls autoplay muted loop playsinline></video>`;
      body.querySelector('img')?.addEventListener('click', () => body.classList.toggle('zoom'));
      $('vSub').textContent = (k === 'image' ? 'Image' : 'Video') + ' · ' + d.sub;
    });
    body.querySelector('img')?.addEventListener('error', () => { body.innerHTML = '<p class="v-msg">Could not load this file.</p>'; });
    body.querySelector('img')?.addEventListener('click', e => body.classList.toggle('zoom'));
    $('vOpen').hidden = false; $('vDl').hidden = d.type === 'web' || (!d.blob && !d.openUrl); $('vCopy').hidden = !(d.png || d.copy || d.openUrl);
    wire(d);
  } catch (err) { body.innerHTML = `<p class="v-msg">${esc(err.message)}</p>`; }
})();
addEventListener('keydown', e => { if (e.key === 'Escape') window.close(); });
