# YouTube Live News Multiview

A Netlify Free-plan-oriented dashboard for monitoring 2–12 YouTube live news feeds. All videos start muted. Selecting a feed header unmutes it and mutes every other player.

## Features

- User-specific feeds stored locally in the browser; no account or database required.
- Enable/disable, edit, reorder, delete, import, and export feeds.
- Three starter collections: International, India English/Hindi, and Malayalam.
- Accepts YouTube `@handle`, `/channel/`, `/watch`, `/live`, `/shorts`, `/embed`, and `youtu.be` URLs.
- Netlify Function protects the YouTube Data API key.
- Low-quota live discovery: resolves a channel's uploads playlist, checks its 15 newest videos in one batched `videos.list` call, and avoids `search.list`.
- Economy, Normal, and Manual refresh modes. Polling pauses while the tab is hidden.
- Responsive 1–4 column multiview.

## Free-plan design

The frontend is static. YouTube serves iframe video traffic directly, not Netlify. There are no scheduled functions, server-side user sessions, database, image proxy, or background polling. A status refresh performs one Netlify Function invocation for up to 12 feeds. The function uses in-memory best-effort caching; channel metadata is cached for 24 hours and live resolution for 5 minutes per warm function instance.

The included defaults are editable starter data. YouTube handles and broadcaster live-stream practices can change, so review `public/js/defaults.js` periodically.

## Requirements

- Node.js 20 or later
- A Google Cloud project with **YouTube Data API v3** enabled
- A YouTube Data API key
- A Netlify account
- Optional: Git and GitHub

## Google Cloud setup

1. Open Google Cloud Console and create or select a project.
2. Go to **APIs & Services → Library**.
3. Enable **YouTube Data API v3**.
4. Go to **APIs & Services → Credentials**.
5. Create an API key.
6. For production, restrict the key to the YouTube Data API. Do not put it in frontend code.

## Run locally

```bash
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set:

```text
YOUTUBE_API_KEY=your_key_here
```

Then run:

```bash
npm run dev
```

Open `http://localhost:8888`.

## Validate JavaScript

```bash
npm run check
```

## Create a GitHub repository

```bash
git init
git add .
git commit -m "Initial YouTube live news multiview"
git branch -M main
git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
git push -u origin main
```

## Deploy through Netlify UI

1. Sign in to Netlify.
2. Select **Add new project → Import an existing project**.
3. Choose GitHub and select the repository.
4. Netlify reads `netlify.toml`; the publish directory is `public` and functions directory is `netlify/functions`.
5. Under **Project configuration → Environment variables**, add `YOUTUBE_API_KEY`.
6. Trigger a deploy.

## Deploy with Netlify CLI

Install dependencies and authenticate:

```bash
npm install
npx netlify login
```

Create/link the Netlify project:

```bash
npx netlify init
```

Set the production secret:

```bash
npx netlify env:set YOUTUBE_API_KEY "YOUR_API_KEY"
```

Test locally using Netlify's environment:

```bash
npx netlify dev
```

Deploy a preview:

```bash
npx netlify deploy
```

Deploy production:

```bash
npx netlify deploy --prod
```

When the site is linked to GitHub, normal production deployment should be done by pushing to `main`:

```bash
git add .
git commit -m "Describe the change"
git push
```

## API endpoint

Frontend request:

```http
POST /api/resolve-feeds
Content-Type: application/json

{
  "sources": [
    { "id": "local-feed-id", "url": "https://www.youtube.com/@BBCNews" }
  ],
  "force": false
}
```

Maximum: 12 sources per request.

## Known limitations

- A broadcaster may disable embedding or impose country, age, login, copyright, or membership restrictions.
- Some channels run multiple simultaneous streams. The resolver prioritises live over upcoming, then viewer count and start time.
- The low-quota resolver checks the 15 newest uploads. An unusual channel with many rapid uploads could have a live stream outside that window.
- Viewer counts are not always provided by YouTube.
- Browser autoplay rules may require clicking **Start enabled feeds**.
- Browser-local settings do not synchronise across devices. Use Export/Import JSON.
- Function in-memory cache is best-effort; serverless instances can be recycled. Persistent shared caching was intentionally excluded to keep version 1 simple and free-plan friendly.

## Security notes

- Never commit `.env` or the API key.
- The function accepts only recognised YouTube URL forms and caps batches at 12.
- The API key is read only from Netlify's server-side environment.
