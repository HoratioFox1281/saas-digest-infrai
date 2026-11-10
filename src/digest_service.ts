import { z } from "zod";
import { infrai } from "./infrai_client.js";

export const subscriberSchema = z.object({ tenant: z.string().min(1), email: z.string().email(), active: z.boolean() });
export type Subscriber = z.infer<typeof subscriberSchema>;

export function selectRecipients(subscribers: Subscriber[]): string[] {
  return subscribers.filter((subscriber) => subscriber.active).map((subscriber) => subscriber.email);
}

export async function scheduleDigest(taskUrl: string): Promise<string> {
  const result = await infrai.cron.create({ cron_expr: "0 9 * * 1-5", task: taskUrl });
  return result.job_id;
}

function digestQueue(): string {
  const queue = process.env.DIGEST_QUEUE;
  if (!queue) throw new Error("DIGEST_QUEUE is required");
  return queue;
}

export async function enqueueDigest(subscribers: Subscriber[]): Promise<string | undefined> {
  const to = selectRecipients(subscribers);
  if (to.length === 0) return undefined;
  const result = await infrai.queue.publish(digestQueue(), { to });
  return result.message_id;
}

export async function deliverOneDigest(): Promise<string | undefined> {
  const batch = await infrai.queue.consume(digestQueue(), 1, 60);
  const message = batch.messages[0];
  if (!message) return undefined;
  const payload = message.payload as { to: string[] };
  const sent = await infrai.email.send({ to: payload.to[0], subject: "Your SaaS weekly digest", html: "<p>Usage and account updates for your team.</p>" });
  await infrai.queue.ack(digestQueue(), message.message_id);
  return sent.message_id;
}

if (process.argv[1]?.endsWith("digest_service.ts")) {
  const subscribers = [subscriberSchema.parse({ tenant: "acme", email: process.env.DIGEST_RECIPIENT, active: true })];
  digestQueue();
  const taskUrl = process.env.DIGEST_TASK_URL ?? "https://example.com/digest/run";
  const jobId = await scheduleDigest(taskUrl);
  await enqueueDigest(subscribers);
  await deliverOneDigest();
  console.log(`scheduled ${jobId}; same INFRAI_API_KEY and base URL cover cron, queue, and email`);
}
