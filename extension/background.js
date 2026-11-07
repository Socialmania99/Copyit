importScripts('lib.js');
const { KEY, BLOB_PREFIX, BLOB_KINDS, SETTINGS, DEFAULT_SETTINGS, norm, detectKind, languageOf, isRichHtml, applyRetention } = CopyitLib;
const MAX_TEXT = 2000000, MAX_HTML = 300000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'save-selected-text', title: 'Save selected text to Copyit', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'save-link', title: 'Save link address to Copyit', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'save-image-url', title: 'Save image address to Copyit', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'save-page-url', title: 'Save page address to Copyit', contexts: ['page'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = { 'save-selected-text': info.selectionText, 'save-link': info.linkUrl, 'save-image-url': info.srcUrl, 'save-page-url': info.pageUrl || tab?.url }[info.menuItemId];
  if (!text) return;
  await enqueue(() => saveEntry({ content: text, source: 'context-menu' }));
  flashBadge();
});

// Brief "saved" tick on the toolbar icon after a right-click save.
function flashBadge() {
  chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
  chrome.action.setBadgeText({ text: '✓' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1800);
}

// Saves run one at a time so two quick saves cannot overwrite each other.
let chain = Promise.resolve();
const enqueue = fn => (chain = chain.then(fn, fn));

async function saveEntry(input, blob) {
  const data = await chrome.storage.local.get([KEY, SETTINGS]);
  const items = Array.isArray(data[KEY]) ? data[KEY] : [];
  const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS] || {}) };
  const now = new Date().toISOString();
  const isImg = BLOB_KINDS.includes(input.kind) && input.image && typeof blob === 'string' && blob.startsWith('data:');
  let content = String(input.content ?? '');
  if (!isImg) {
    content = content.trim();
    if (!content) return { ok: false, error: 'Nothing to save.' };
    if (content.length > MAX_TEXT) return { ok: false, error: 'That text is too large to save (over 2 MB).' };
  }
  const existing = isImg ? items.find(x => x.hash && x.hash === input.hash) : items.find(x => !BLOB_KINDS.includes(x.kind) && norm(x.content) === norm(content));
  let id, duplicate = false;
  if (existing) {
    existing.copiedAt = now; existing.copies = (existing.copies || 1) + 1; existing.source = input.source || existing.source;
    id = existing.id; duplicate = true;
  } else {
    id = crypto.randomUUID();
    const e = { id, content, createdAt: now, copiedAt: now, updatedAt: null, favorite: false, pinned: false, copies: 1, source: input.source || 'manual' };
    if (isImg) {
      e.kind = input.kind; e.image = input.image; e.hash = input.hash || '';
      await chrome.storage.local.set({ [BLOB_PREFIX + id]: blob });
    } else {
      let kind = detectKind(content);
      const html = typeof input.html === 'string' ? input.html : '';
      if (html && html.length <= MAX_HTML && isRichHtml(html, content)) { kind = 'rich'; e.html = html; }
      e.kind = kind;
      if (kind === 'code') e.lang = languageOf(content);
    }
    items.unshift(e);
  }
  const { kept, removed } = applyRetention(items, settings);
  await chrome.storage.local.set({ [KEY]: kept });
  const gone = removed.filter(x => BLOB_KINDS.includes(x.kind)).map(x => BLOB_PREFIX + x.id);
  if (gone.length) await chrome.storage.local.remove(gone);
  return { ok: true, id, duplicate };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SAVE_ENTRY') {
    enqueue(() => saveEntry(message.entry || {}, message.blob)).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'SAVE_TEXT') {            // kept for older callers
    enqueue(() => saveEntry({ content: message.text, source: message.source || 'manual' })).then(r => sendResponse(r)).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
