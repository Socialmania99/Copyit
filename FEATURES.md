# Copyit 1.0.0 features

## Saving
- Save text, links, code, images and videos. Right-click selected text: "Save selected text to Copyit".
- Open with the toolbar icon or `Ctrl+Shift+Y` (`Cmd+Shift+Y` on Mac).
- Popup for quick use. Dashboard for the full view.

## Finding
- Search clips and `#tags`.
- Filters: All, Links, Code, Multimedia.
- Folders. Favorite star.

## Copying
- Copy a clip in the format you need.
- **Preview** button opens links, videos and pages in a small viewer window. Some sites (YouTube, Vimeo, many others) block being shown inside another page; the viewer then opens them directly.

## Scan to open (QR)
- Each clip card has a QR button. Built on your device. No server, no short code, no expiry.
- **Links:** QR holds the URL. Phone opens it in its browser (internet needed to load the page).
- **Text:** QR holds the text. Works with no internet. Up to **5 KB**. Longer text is split into numbered QR codes (page i of n). Scan in order.
- **Not supported:** images, videos, files, empty clips, anything over 5 KB. The dialog says so.

## Settings
- **Import and export:** JSON backup (full, with images and videos), CSV, TXT, Markdown. Import many files at once. JSON merges without duplicates.
- **Themes:** Multicolor (flat) and Black & White (gradient). Light, Dark or Auto.
- **Donate:** PayPal, Ko-fi, Bitcoin, Ethereum, Solana. Fixed list.
- Danger zone for clearing data.

## Design
- Clean and still. No animations. Plain background.

## Privacy
- No account, no analytics, no server. Clips stay in Chrome storage on your computer.
- Permissions are only what saving and previewing need. Copyit does not read pages you do not ask it to.

## Tested
Automated browser tests with a mocked Chrome API and a QR decoder: core, settings, previews, folders, donate, import/export, Scan to open (exact URL, UTF-8 text, numbered pages, 5 KB limit).
**Not tested:** real Chrome install, real phone camera.
