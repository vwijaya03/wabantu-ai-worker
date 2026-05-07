require('dotenv').config();
const axios = require('axios');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.BULLMQ_REDIS_DB || 1),
  maxRetriesPerRequest: null,
});

const apiBase = (process.env.API_INTERNAL_URL || 'http://localhost:3001/api/v1').replace(
  /\/$/,
  '',
);
const internalToken = process.env.AI_INTERNAL_TOKEN || '';
const queueName = process.env.AI_REPLY_QUEUE || 'ai-auto-reply';
const concurrency = Math.max(1, Number(process.env.AI_REPLY_CONCURRENCY || 4));
const configuredAttempts = Math.max(1, Number(process.env.AI_REPLY_ATTEMPTS || 4));

if (!internalToken) {
  throw new Error('AI_INTERNAL_TOKEN is required');
}

async function callApi(path, payload) {
  const url = `${apiBase}${path}`;
  const start = Date.now();
  try {
    const res = await axios.post(url, payload, {
    timeout: 25000,
    headers: {
      'content-type': 'application/json',
      'x-ai-internal-token': internalToken,
    },
    });
    logger.info(
      {
        path,
        status: res.status,
        ms: Date.now() - start,
        tenantId: payload.tenantId,
        convoId: payload.conversationId,
        inboundId: payload.inboundMessageId,
      },
      `API call ok`,
    );
    return res;
  } catch (err) {
    const status = err?.response?.status;
    const dataMsg =
      typeof err?.response?.data === 'string'
        ? err.response.data.slice(0, 200)
        : err?.response?.data?.message;
    logger.error(
      {
        path,
        status,
        ms: Date.now() - start,
        tenantId: payload.tenantId,
        convoId: payload.conversationId,
        inboundId: payload.inboundMessageId,
        err: err?.message,
        apiError: dataMsg,
      },
      `API call failed`,
    );
    throw err;
  }
}

const worker = new Worker(
  queueName,
  async (job) => {
    logger.info(
      {
        queue: queueName,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts || configuredAttempts,
        tenantId: job.data.tenantId,
        conversationId: job.data.conversationId,
      },
      'Processing AI auto-reply job',
    );
    await callApi('/internal/ai/auto-reply', job.data);
    logger.info(
      {
        jobId: job.id,
        tenantId: job.data.tenantId,
        conversationId: job.data.conversationId,
        inboundId: job.data.inboundMessageId,
      },
      'AI auto-reply job done',
    );
  },
  {
    connection: redis,
    concurrency,
  },
);

worker.on('failed', async (job, err) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts || configuredAttempts;
  const willRetry = job.attemptsMade < maxAttempts;
  const status = err?.response?.status;
  logger.warn(
    {
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts,
      willRetry,
      error: err?.message,
      status,
      apiError:
        typeof err?.response?.data === 'string'
          ? err.response.data.slice(0, 200)
          : err?.response?.data?.message,
    },
    'AI auto-reply job failed',
  );
  if (willRetry) return;
  try {
    logger.warn(
      {
        jobId: job.id,
        tenantId: job.data.tenantId,
        convoId: job.data.conversationId,
      },
      'Calling fallback after max retries',
    );
    await callApi('/internal/ai/auto-reply/fallback', job.data);
    logger.warn({ jobId: job.id }, 'Fallback message sent after max retries');
  } catch (fallbackErr) {
    logger.error(
      { jobId: job.id, error: fallbackErr.message },
      'Fallback delivery failed',
    );
  }
});

worker.on('ready', () => {
  logger.info(
    { queueName, concurrency, configuredAttempts, apiBase },
    'AI worker started and waiting for jobs',
  );
});

worker.on('error', (err) => {
  logger.error({ error: err.message }, 'AI worker runtime error');
});
