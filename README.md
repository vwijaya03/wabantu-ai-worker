# WABantu AI Worker

BullMQ worker service dedicated to AI auto-reply jobs.

## What it does

- Consumes queue `ai-auto-reply` from Redis.
- Calls API internal endpoint `POST /api/v1/internal/ai/auto-reply`.
- Lets BullMQ handle retries (default 4 attempts, exponential backoff).
- On terminal failure, calls `POST /api/v1/internal/ai/auto-reply/fallback`.

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
npm run dev
```

## Run with Docker

```bash
cp .env.example .env
docker compose up -d --build
```
