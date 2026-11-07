# Put Copyit on GitHub: step by step

## 1. Make the repo
1. Sign in at https://github.com.
2. Top right **+**, **New repository**.
3. Name: `copyit`. Public. **Do not** tick README, .gitignore or license (this folder has them).
4. Click **Create repository**.

## 2. Upload the files
**Easy way (no tools):**
1. Unzip `copyit-repo.zip`. Open the `copyit-repo` folder.
2. On the new repo page click **uploading an existing file**.
3. Select everything inside `copyit-repo` (including the hidden `.github` folder) and drag it in. Folders upload with it.
4. Click **Commit changes**.

If `.github` will not drag in (hidden folder), skip it. Releases still work by hand (step 4B).

**Git way:**
```bash
cd copyit-repo
git init
git add .
git commit -m "Copyit v1.0.0"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/copyit.git
git push -u origin main
```

## 3. Turn on the website (GitHub Pages)
1. Repo **Settings**, **Pages** (left menu).
2. Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/docs`. **Save**.
4. Wait one minute. Site is at `https://YOUR-NAME.github.io/copyit/`.

## 4. Make a Release (the download button)
**A. Automatic** (needs the `.github` folder):
```bash
git tag v1.0.0
git push origin v1.0.0
```
Action builds `copyit-v1.0.0.zip` and attaches it to a Release.

**B. By hand:**
1. Repo **Releases**, **Create a new release**.
2. Tag `v1.0.0`, title `Copyit 1.0.0`.
3. Zip the `extension` folder as `copyit-v1.0.zip` (folder name inside the zip: `copyit`). Drag it into the release box.
4. **Publish release**.

## 5. Fix the links
- In `README.md` replace `YOUR-NAME` with your GitHub name.
- In `docs/index.html` the download button points to Google Drive. To use GitHub instead, replace that link with `https://github.com/YOUR-NAME/copyit/releases/latest`.

## 6. Update later
1. Change files in `extension/`. Raise `"version"` in `extension/manifest.json`.
2. Add a line to `CHANGELOG.md`.
3. Commit, push, tag a new version.
4. Users: back up (Settings, Import & export), replace files in the same folder, click reload on `chrome://extensions`.
