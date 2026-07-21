# YouTube Live News Multiview

A lightweight, dependency-free dashboard for monitoring multiple YouTube live news feeds. The frontend is plain HTML, CSS and JavaScript. A single Netlify Function protects the YouTube API key and resolves channel URLs into current live or upcoming videos.

Production site: https://youtube-live-news-multiview.netlify.app/

Repository: https://github.com/arun-ks/youtube-live-news-multiview

## Features

- Save up to 12 YouTube channel, handle or video URLs.
- Enable, disable, edit, delete and reorder feeds.
- Starter collections for International, India English/Hindi and Malayalam news.
- Live/upcoming/offline/error status.
- Titles, thumbnails, channel names, start times and viewer counts when YouTube exposes them.
- Responsive multiview grid.
- All players start muted; selecting a viewport unmutes it and mutes the others.
- Economy, Normal and Manual refresh modes.
- Browser-local storage and JSON import/export.
- No accounts, database, scheduled functions or production npm dependencies.

## Free-plan design

The application is intentionally conservative with Netlify and YouTube resources:

- One batch Function request resolves up to 12 enabled feeds.
- YouTube video traffic goes directly from YouTube to the browser, not through Netlify.
- Automatic checks run only while the page is open and visible.
- Economy mode checks every five minutes; Normal every two minutes.
- Channel lookup avoids `search.list`. It checks the channel's 50 most recent uploads, then uses a single `videos.list` call.
- Function responses are cached for two minutes within warm Function instances.
- User configuration remains in `localStorage`; no database is required.

### Discovery limitation

The cheap channel-discovery method scans the 50 most recent uploads. A very old, continuously running 24/7 stream may not appear there. For such a feed, add its direct video URL. This avoids the 100-unit cost of YouTube's `search.list` API operation.

## Requirements

- Node.js 20 or later.
- Netlify CLI installed globally for local development.
- A Google Cloud API key with YouTube Data API v3 enabled.

## Local setup

```bash
# Clone your existing repository
git clone https://github.com/arun-ks/youtube-live-news-multiview.git
cd youtube-live-news-multiview

# Install exactly from package-lock.json. There are no project dependencies.
npm ci

# Install Netlify CLI separately, not as a project dependency
npm install -g netlify-cli

# Create a local environment file
copy .env.example .env
```

On macOS/Linux, use:

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
YOUTUBE_API_KEY=your_new_restricted_key
```

Run locally:

```bash
netlify dev
```

Open the URL printed by Netlify CLI, normally `http://localhost:8888`.

## Validate locally

```bash
npm run check
npm test
npm run build
```

`npm run build` only validates required files because this static application requires no compilation or bundling.

## Push into the existing GitHub repository

If you extracted this ZIP into a fresh folder:

```bash
git init
git branch -M main
git remote add origin https://github.com/arun-ks/youtube-live-news-multiview.git
git add .
git status
git commit -m "Rebuild as minimal Netlify multiview app"
git push -u origin main
```

If the GitHub repository already contains commits, clone it first, copy these files into the clone, then:

```bash
git add .
git status
git commit -m "Rebuild as minimal Netlify multiview app"
git push
```

Confirm that `.env` does **not** appear in `git status`. `.env.example` should be committed.

## Connect or update Netlify

### Netlify UI

1. Open your existing site `youtube-live-news-multiview`.
2. Under **Site configuration → Build & deploy → Continuous deployment**, link the GitHub repository if it is not already linked.
3. Netlify reads these values from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Under **Site configuration → Environment variables**, add:
   - Key: `YOUTUBE_API_KEY`
   - Value: your new API key
   - Scope: Functions/runtime; include all deploy contexts you intend to use.
5. Trigger a new production deployment.

### Netlify CLI

From the repository folder:

```bash
netlify login
netlify link
```

Select the existing site `youtube-live-news-multiview` when prompted.

Set the environment variable without committing it:

```bash
netlify env:set YOUTUBE_API_KEY "YOUR_NEW_KEY"
```

Deploy a preview:

```bash
netlify deploy
```

Deploy production:

```bash
netlify deploy --prod
```

For normal operation after GitHub is connected, pushing to `main` is enough; Netlify deploys automatically.

## API-key restrictions

The API key is used by a server-side Netlify Function. HTTP-referrer restrictions are generally unsuitable for server-to-server Function calls because no browser referrer is sent. At minimum, restrict the key under **API restrictions** to **YouTube Data API v3**. Google Cloud does not offer a stable outbound IP for ordinary Netlify Functions, so IP restriction is not practical here.

Never place the key in frontend JavaScript, `netlify.toml`, committed files or GitHub Actions logs.

## Project structure

```text
public/
  index.html
  css/app.css
  js/app.js
  js/defaults.js
  js/players.js
  js/store.js
netlify/functions/resolve-feeds.mjs
tests/resolve-feeds.test.mjs
scripts/build-check.mjs
.github/workflows/ci.yml
.env.example
.gitignore
netlify.toml
package.json
package-lock.json
```

## Starter-channel maintenance

YouTube handles can change. The starter collections are ordinary browser-local entries after installation, so users can edit them. Update `public/js/defaults.js` when an official channel changes its handle.
