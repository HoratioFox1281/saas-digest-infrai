import assert from "node:assert/strict";
import { selectRecipients, subscriberSchema } from "../src/digest_service.js";

const subscribers = [
  subscriberSchema.parse({ tenant: "a", email: "active@example.com", active: true }),
  subscriberSchema.parse({ tenant: "b", email: "paused@example.com", active: false })
];
assert.deepEqual(selectRecipients(subscribers), ["active@example.com"]);
console.log("digest recipient decision: ok");
