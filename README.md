# WABantu AI Worker

BullMQ worker service dedicated to AI auto-reply jobs.

## What it does

- Consumes queue `ai-auto-reply` from Redis.
- Receives jobs with id format `<tenantId>_<inboundMessageId>`.
- Calls API internal endpoint `POST /api/v1/internal/ai/auto-reply`.
- Lets BullMQ handle retries (default 4 attempts, exponential backoff).
- On terminal failure, calls `POST /api/v1/internal/ai/auto-reply/fallback`.
- Outbound `message.metadata.reason` is assigned by API policy engine (`ai_generated`, `profile_incomplete`, `non_question`, `out_of_scope`).

## Why separate service

- Webhook path in API can acknowledge Meta quickly (avoid timeout).
- AI inference latency/failures are isolated from API request threads.
- Worker can be scaled independently without scaling the API.

## Environment

See `.env.example`.

Critical variables:

- `AI_INTERNAL_TOKEN` must match API's `AI_INTERNAL_TOKEN`.
- `API_INTERNAL_URL` points to API internal base URL.
- `REDIS_*` and `BULLMQ_REDIS_DB` must match queue Redis.

## Run locally

```bash
cp .env.example .env
npm install
npm run start
```

## Expected logs (happy path)

1. `AI worker started and waiting for jobs`
2. `Processing AI auto-reply job`
3. `API call ok` for `/internal/ai/auto-reply`
4. `AI auto-reply job done`

If retries happen you will see `AI auto-reply job failed`; after max retries
worker calls fallback endpoint automatically.

## Run with Docker

```bash
cp .env.example .env
docker compose up -d --build
```
