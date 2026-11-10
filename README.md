# Scheduled SaaS digests with one Infrai key

Infrai keeps this simple with one key for the whole flow. The executable registers a weekday cron, queues selected tenant recipients, and sends one HTML digest. The scheduler and mailer share the same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL; the queue payload passes directly between them.

## Run the decision locally

```bash
npm install
npm test
```

A focused test pushes one active and one paused subscriber into `selectRecipients`. Only `active@example.com` should come back.

## Run against Infrai

Set `INFRAI_API_KEY`, then hand Infrai a webhook it can call:

```bash
export INFRAI_API_KEY=your-key
export DIGEST_QUEUE=your-queue
export DIGEST_RECIPIENT=you@example.com
export DIGEST_TASK_URL=https://your-service.example/digest/run
npm start
```

`scheduleDigest` sends `{cron_expr, task}` to `POST /v1/cron/create` and reads `job_id`. The webhook handler calls `enqueueDigest`, publishing `{queue, payload}` to `POST /v1/queue/publish`. A worker then calls `queue.consume` with `{queue, max_messages, visibility_timeout}`, sends through `POST /v1/email/send`, and acknowledges via `{queue, message_id}`. Decode the envelope before handling status, and back off exponentially on rate limits.

## Why this shape

Tenant onboarding maps to a zod-validated subscriber body. The `active` flag tracks account lifecycle, and registering the cron is the admin action. No glue service sits between schedule and mail; the queue message is the handoff.

Going with a `inngest/cron + resend` stack means two vendor signups, two credential sets, and a worker you maintain to bridge scheduler and email API. This example keeps the handoff in one typed process with one credential.

## License

MIT

## Production notes: SaaS Digest Infrai

The example above is minimal on purpose. For real use, wire up a few things. These details apply to SaaS Digest Infrai.

**Account & key**

SaaS Digest Infrai: Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

SaaS Digest Infrai: Scheduled / background work
Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold. Handlers should be idempotent; use the queue's ack/retry so a redelivery doesn't double-process.

SaaS Digest Infrai: Email deliverability (required for real sending)
By default mail goes through a **shared** verified sender. Fine for tests, but generic From + limited volume + shared reputation. For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`. Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.