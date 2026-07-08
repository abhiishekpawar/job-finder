# Job Hunter (search on demand)

This is a monorepo MVP for a job-hunter web app that searches across multiple job sources **whenever you open the app and submit your skills + experience**.

## What it does (MVP)

- UI input: **skills/keyword**, **experience (years)**, **location**
- On submit: calls managed job scrapers (Apify actors) for **Naukri, Indeed, LinkedIn**
- Shows aggregated results in the same page

## Structure

- `apps/web`: Next.js App Router UI + `/api/search`
- `apps/worker`: (optional) scheduled ingestion worker (not required for the on-demand MVP)

## Setup

1. Copy `apps/web/.env.example` to `apps/web/.env.local`
2. Fill `APIFY_TOKEN` in `apps/web/.env.local` (Next.js does **not** read the root `.env` file)
3. Install dependencies:

```bash
npm install
```

4. Start the web app:

```bash
npm run dev:web
```

5. Open the app, enter your skills + experience, and click **Search**

## Notes

- No database is required for this on-demand MVP (the UI runs searches and returns results directly).
- Actor IDs are configurable via env vars (`APIFY_INDEED_ACTOR_ID`, `APIFY_NAUKRI_ACTOR_ID`).
- **LinkedIn** uses LinkedIn's free public guest API first (no Apify rental). Apify actors are only used if the guest API fails.
- **Naukri** tries fast HTTP Apify actors in order: `jungle_synthesizer/naukri-com-scraper` → `logiover/naukri-job-scraper` → `trakk/naukri-job-scraper`.
- **Others** (one combined card) searches **Shine** and **Foundit** via `dp862/india-jobs-suite`, with individual fallbacks.
- Old paid actors (`bebity/linkedin-jobs-scraper`, `codingfrontend/naukri-jobs-scraper`) are blocked by default.

## Deploy to Render (free)

This app uses long-running API routes (job scraping). Render’s free **Web Service** fits better than Vercel Hobby (10s serverless limit).

### 1. Push to GitHub

```bash
git add .
git commit -m "Add Render deployment config"
git push origin main
```

### 2. Create the service on Render

**Option A — Blueprint (recommended)**

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. **New** → **Blueprint**
3. Connect your GitHub repo
4. Render reads `render.yaml` at the repo root and creates the web service

**Option B — Manual**

1. **New** → **Web Service** → connect repo
2. **Build command:** `npm install && npm run build:web`
3. **Start command:** `npm run start:web`
4. **Plan:** Free

### 3. Set environment variables

In Render → your service → **Environment**, add:

| Variable | Required | Example |
|----------|----------|---------|
| `APIFY_TOKEN` | Yes | your Apify API token |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://job-hunter-xxxx.onrender.com` |

Use your actual Render URL for `NEXT_PUBLIC_APP_URL` after the first deploy.

Other vars (`APIFY_*_ACTOR_ID`, `APIFY_RUN_TIMEOUT_MS`, etc.) are pre-filled in `render.yaml` or match `apps/web/.env.example`.

### 4. Deploy

Render builds and deploys on every push to `main`. First deploy takes a few minutes.

### Notes

- **Free tier:** service sleeps after ~15 minutes idle; first request after sleep may take 30–60s (cold start).
- **Apify:** free plan includes ~$5/month credits; heavy use may need a paid Apify plan.
- **Region:** `render.yaml` defaults to `singapore` (good for India). Change in the YAML if you prefer another region.
- **Secrets:** never commit `apps/web/.env.local` — it is gitignored.
