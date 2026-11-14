# Copyit

Free Chrome extension. Save text, links, code, images and videos once. Find them forever. Everything stays on your device. No account, no tracking, no server.

**Website:** [https://Socialmania99.github.io/copyit/ ](https://socialmania99.github.io/Copyit/)

**Download:** [Releases](https://github.com/Socialmania99/copyit/releases/latest) or [Google Drive](https://drive.google.com/file/d/1RxlnzMSdSZsIr42oWVV7r6P7LsoFYRQT/view?usp=sharing)

## Watch the video
<p align="center">
  <video src="https://github.com/Socialmania99/Copyit/raw/main/docs/copyit-demo.mp4" controls muted playsinline width="100%"></video>
</p>

Download, install and every main feature in about 2 minutes. Player not showing? [Watch it on YouTube](https://youtu.be/6jOjqSzReSs) or on the [website](https://socialmania99.github.io/Copyit/#watch).

## Features
- Save, search, tag and sort clips into folders. Filters: All, Links, Code, Multimedia.
- Preview button opens a small viewer window.
- **Scan to open:** QR code for short clips (text or links, up to 5 KB). Offline. Longer text becomes numbered QR codes. Images, videos, files too big.
- Import and export: JSON, CSV, TXT, Markdown.
- Two themes (Multicolor, Black & White), Light / Dark / Auto. No animations.
- Shortcut: `Ctrl+Shift+Y` (`Cmd+Shift+Y` on Mac).

Full list: [FEATURES.md](FEATURES.md).

## Install (short)
Prefer to watch? [Install steps in the video](https://youtu.be/6jOjqSzReSs?t=24) start at 0:24.

1. Get `copyit-v1.0.zip` from Releases (or Drive). Unzip.
2. Chrome: `chrome://extensions`. Turn on **Developer mode**.
3. **Load unpacked**. Pick the `copyit` folder (the one with `manifest.json`).
4. Pin it from the puzzle-piece menu.

Beginner guide with pictures-free steps and fixes: [INSTALL.md](INSTALL.md).

## Run from source
```bash
git clone https://github.com/YOUR-NAME/copyit.git
```
Then in Chrome, **Load unpacked**, pick the `extension` folder. No build step. No dependencies.

## Repo layout
| Path | What |
|---|---|
| `extension/` | The Chrome extension (Manifest V3) |
| `docs/` | Website (GitHub Pages) |
| `INSTALL.md` | Beginner install guide |
| `FEATURES.md` | Full feature notes |
| `.github/workflows/release.yml` | Builds a zip when you push a `v*` tag |

## Privacy
Clips live in Chrome storage on your computer. QR codes are made on your device. Nothing is uploaded.

## Support
Donate links are inside the extension (Donate button) and on the website.

## License
MIT. See [LICENSE](LICENSE) and [THIRD_PARTY.md](THIRD_PARTY.md).
