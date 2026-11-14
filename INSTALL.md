# Install Copyit (beginner guide)

Copyit is not on the Chrome Web Store yet. You install it by hand with Chrome Developer mode. About five minutes.

<p align="center">
  <video src="https://github.com/Socialmania99/Copyit/raw/main/docs/copyit-demo.mp4" controls muted playsinline width="100%"></video>
</p>

Video: download and install steps start at 0:24. [Watch on YouTube](https://youtu.be/6jOjqSzReSs?t=24).

**Need:** Google Chrome on a computer (Windows, Mac, Linux, Chromebook). Edge and Brave work too: use `edge://extensions` or `brave://extensions`.

## Get the files (pick one)
- **A. Google Drive:** https://drive.google.com/file/d/1RxlnzMSdSZsIr42oWVV7r6P7LsoFYRQT/view?usp=sharing
- **B. GitHub Release:** https://github.com/Socialmania99/copyit/releases/tag/v1.0.0
- **C. GitHub code:** click green **Code** button, **Download ZIP**. Then use the `extension` folder inside it.

## Steps
1. **Download** the zip (see above).
2. **Unzip.** Windows: right-click the zip, Extract All, Extract. Mac: double-click the zip. Linux/Chromebook: right-click, Extract here. You get a folder named `copyit`. Open it once: it must contain `manifest.json` and `popup.html` directly. If it only holds another `copyit` folder, use that inner one.
3. **Move the folder somewhere permanent**, for example Documents. Chrome reads the files from there every time it starts. If you delete or move the folder, Copyit stops working.
4. **Open the extensions page.** Type `chrome://extensions` in the address bar and press Enter (or menu ⋮, Extensions, Manage Extensions).
5. **Turn on Developer mode.** Use the switch at the top right. Three buttons appear at the top left: Load unpacked, Pack extension, Update.
6. **Click Load unpacked.**
7. **Choose the `copyit` folder** (the one with `manifest.json` directly inside) and press Select Folder. A Copyit card appears, version 1.0.0, switched on.
8. **Pin it.** Click the puzzle-piece icon at the top right of Chrome and pin Copyit. Open it any time with Ctrl+Shift+Y (Command+Shift+Y on Mac).
9. **Try it.** Select some text on a page, right-click, choose "Save selected text to Copyit", then click the Copyit icon and press Copy.

## If something goes wrong
| Problem | Fix |
|---|---|
| "Manifest file is missing or unreadable" | Wrong folder. Pick the folder that has `manifest.json` directly inside. Not the zip, not a parent folder. |
| No "Load unpacked" button | Developer mode is off. Turn it on (top right). |
| Copyit vanished or shows an error | The folder was moved, renamed or deleted. Put it back, or load it again from its new place. |
| Chrome warns about developer-mode extensions at startup | Normal for extensions installed outside the Web Store. Dismiss it. |
| Shortcut does nothing | Another extension uses it. Set your own at `chrome://extensions/shortcuts`. |
| No toolbar icon | Click the puzzle piece and pin Copyit. |

## Updating
Back up first: Copyit, Settings, Import & export, JSON backup. Replace the files inside the **same folder** with the new version, then click the circular reload arrow on the Copyit card at `chrome://extensions`. Loading from a different folder makes Chrome treat it as a new extension, so your clips would not carry over. You can restore them with Import files and your backup.

## Removing
`chrome://extensions`, then Remove on the Copyit card. This deletes your clips, so export a backup first.
