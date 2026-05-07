# AI Worker Production Checklist

## Runtime config

- `AI_INTERNAL_TOKEN` match with API.
- `API_INTERNAL_URL` reachable from worker runtime network.
- `REDIS_HOST/PORT/PASSWORD/BULLMQ_REDIS_DB` valid.
- `AI_REPLY_QUEUE` same as API queue name.

## Redis/BullMQ safety

- Redis eviction policy = `noeviction`.
- Retry policy active (attempts + exponential backoff).
- Queue depth and failed jobs monitored.

## Logging & observability

- Startup log appears once:
  - `AI worker started and waiting for jobs`
- Per job logs present:
  - processing, API call outcome, completion/failure.
- Alerts on repeated `API call failed` and fallback spikes.

## Operational guardrails

- Run at least 2 worker replicas in production.
- Graceful restarts (avoid dropping active jobs).
- Keep host clock synced (NTP) for log/event ordering.

## Incident checks

1. No AI replies coming through:
   - verify API enqueue log exists
   - verify worker processing log exists
   - verify API internal call status
2. Too many fallback messages:
   - check Anthropic/API outage
   - check token mismatch / auth failure
   - inspect recent deployment changes
