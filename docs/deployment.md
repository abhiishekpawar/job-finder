# Deployment Notes

## Environment variables

- `DATABASE_URL`: Postgres connection string
- `NEXT_PUBLIC_APP_URL`: Base URL used for redirects
- `SESSION_COOKIE_NAME`: Cookie name for the current MVP auth layer
- `APIFY_TOKEN`: Token for calling Apify actors
- `APIFY_INDEED_ACTOR_ID`: Actor ID for Indeed extraction
- `APIFY_LINKEDIN_ACTOR_ID`: Actor ID for LinkedIn extraction
- `APIFY_NAUKRI_ACTOR_ID`: Actor ID for Naukri extraction
- `WORKER_POLL_INTERVAL_MS`: How often the worker checks for due schedules
- `DEFAULT_RESULTS_PER_SOURCE`: Default results cap for new schedules

## Recommended deployment split

### Web

- Deploy `apps/web` to Vercel.
- Provide the shared root `.env` values in the Vercel project.
- Run `npm run prisma:generate` during build if needed by your platform.

### Worker

- Deploy `apps/worker` on a container-friendly service such as Render or Cloud Run.
- Run a single long-lived worker instance for the MVP to avoid duplicate polling.
- If horizontal scaling is required later, add a DB-backed locking strategy per schedule.

## Operational knobs

- `timeOfDay`: User-controlled daily execution time
- `maxResults`: Cost-control lever per schedule and per source
- `WORKER_POLL_INTERVAL_MS`: Scheduler responsiveness vs. API cost
- Provider concurrency: currently sequential for safety; parallelize only after rate-limit behavior is known

## Production follow-ups

- Replace cookie auth with a real auth provider
- Add structured logging and alerting around failed runs
- Add retry/backoff per provider
- Add observability around actor latency and result counts
