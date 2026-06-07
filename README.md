# convex-whatsapp

![npm](https://img.shields.io/npm/v/convex-whatsapp)
[![Convex Component](https://www.convex.dev/components/badge/convex-whatsapp)](https://www.convex.dev/components/convex-whatsapp)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)

**WhatsApp Cloud API for Convex** — Send & receive messages • Delivery tracking • Conversations • Templates • Inbound callbacks

[Setup](#setup) • [Usage](#usage) • [API Reference](#api-reference) • [Testing](#testing)

---

A [Convex component](https://www.convex.dev/components) for the **WhatsApp Cloud API** (Meta, direct). Send and receive WhatsApp messages, track delivery status, thread conversations, and manage message templates — all backed by Convex tables with reactive queries. Product-specific logic stays in your app; this component owns transport and state.

## Features

- **Outbound** — text, template (HSM), media (image / document / audio / video), and interactive (buttons / list) messages
- **Inbound** — webhook ingestion with Meta signature verification; every message stored and threaded into a conversation
- **Delivery status** — `queued → sent → delivered → read → failed`, updated automatically from Meta status webhooks
- **Conversations** — auto-created per phone number, with unread counts and last-message previews
- **Templates** — sync approved templates from the Graph API and keep their status current via webhooks
- **Inbound callbacks** — register a function the component schedules whenever a new message arrives

## Installation

```sh
npm install convex-whatsapp
```

## Setup

### 1. Register the component

```ts
// convex/convex.config.ts
import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import whatsapp from 'convex-whatsapp/convex.config'

const app = defineApp({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: v.string(),
    WHATSAPP_ACCESS_TOKEN: v.string(),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: v.string(),
    WHATSAPP_APP_SECRET: v.string(),
    WHATSAPP_WABA_ID: v.optional(v.string()), // required only for template sync
  },
})

// Webhook URL becomes: https://<your-deployment>.convex.site/whatsapp/webhook
app.use(whatsapp, {
  httpPrefix: '/whatsapp',
  env: {
    WHATSAPP_PHONE_NUMBER_ID: app.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN: app.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: app.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: app.env.WHATSAPP_APP_SECRET,
    WHATSAPP_WABA_ID: app.env.WHATSAPP_WABA_ID,
  },
})

export default app
```

### 2. Set environment variables

```sh
bunx convex env set WHATSAPP_PHONE_NUMBER_ID      <your-phone-number-id>
bunx convex env set WHATSAPP_ACCESS_TOKEN         <your-access-token>
bunx convex env set WHATSAPP_WEBHOOK_VERIFY_TOKEN <any-string-you-choose>
bunx convex env set WHATSAPP_APP_SECRET           <your-meta-app-secret>
bunx convex env set WHATSAPP_WABA_ID              <your-waba-id>   # optional
```

| Variable                        | Where to find it                                               |
| ------------------------------- | -------------------------------------------------------------- |
| `WHATSAPP_PHONE_NUMBER_ID`      | Meta Business Manager → WhatsApp → API Setup                   |
| `WHATSAPP_ACCESS_TOKEN`         | System user token (Tech Provider) or temporary token           |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Any string — you enter the same value in Meta's webhook config |
| `WHATSAPP_APP_SECRET`           | Meta App → Settings → Basic → App Secret                       |
| `WHATSAPP_WABA_ID`              | WhatsApp Business Account ID (for template sync)               |

### 3. Register the webhook in Meta

Point Meta's webhook at `https://<your-deployment>.convex.site/whatsapp/webhook` and use your `WHATSAPP_WEBHOOK_VERIFY_TOKEN` for the verification handshake. Subscribe to the `messages` and `message_template_status_update` fields.

## Usage

Instantiate the client with the component reference, then call methods. The same client works from queries, mutations, and actions (each method picks the `ctx` capabilities it needs).

```ts
// convex/whatsapp.ts
import { WhatsApp } from 'convex-whatsapp'
import { components } from './_generated/api'

export const whatsapp = new WhatsApp(components.whatsapp)
```

### Sending messages

`send` is an **action** (it calls the Meta API). It returns the stored message id.

```ts
import { action } from './_generated/server'
import { v } from 'convex/values'
import { whatsapp } from './whatsapp'

export const sendReminder = action({
  args: { to: v.string() },
  handler: async (ctx, { to }) => {
    // Plain text
    await whatsapp.send(ctx, { to, type: 'text', text: { body: 'Your invoice is due.' } })

    // Approved template with variables
    await whatsapp.send(ctx, {
      to,
      type: 'template',
      template: {
        name: 'payment_reminder',
        language: 'en',
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'R500' }] }],
      },
    })

    // Media
    await whatsapp.send(ctx, {
      to,
      type: 'image',
      image: { link: 'https://example.com/invoice.png', caption: 'Invoice #123' },
    })

    // Interactive buttons
    await whatsapp.send(ctx, {
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Confirm your appointment?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'yes', title: 'Confirm' } },
            { type: 'reply', reply: { id: 'no', title: 'Cancel' } },
          ],
        },
      },
    })
  },
})
```

### Receiving messages

Inbound messages are stored automatically. To react to them, register a handler — the component schedules it with the new message's id whenever a message arrives.

```ts
import { internalMutation, mutation } from './_generated/server'
import { createFunctionHandle, type FunctionHandle } from 'convex/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { whatsapp } from './whatsapp'

export const onInboundMessage = internalMutation({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    // Your business logic: parse a command, match a customer, queue a reply…
    console.log('New inbound message:', messageId)
  },
})

// Call this once (e.g. from the dashboard) to wire up the handler.
export const setup = mutation({
  args: {},
  handler: async (ctx) => {
    const handle = await createFunctionHandle(internal.whatsapp.onInboundMessage)
    await whatsapp.registerInboundHandler(ctx, handle as FunctionHandle<'mutation'>)
  },
})
```

### Error handling

`send` throws a `ConvexError` on API failure so you can branch on Meta's numeric error codes. Use `isWhatsAppError` to narrow the type:

```ts
import { isWhatsAppError } from 'convex-whatsapp'
import { action } from './_generated/server'
import { v } from 'convex/values'
import { whatsapp } from './whatsapp'

export const safeSend = action({
  args: { to: v.string(), body: v.string() },
  handler: async (ctx, { to, body }) => {
    try {
      return await whatsapp.send(ctx, { to, type: 'text', text: { body } })
    } catch (e) {
      if (isWhatsAppError(e)) {
        // e.data is typed: { code, message, type, fbtraceId? }
        if (e.data.code === 131030) return { error: 'recipient_not_allowed' }
        if (e.data.code === 130429) return { error: 'rate_limited' }
      }
      throw e
    }
  },
})
```

The message is always stored in the database with `status: 'failed'` before the error is thrown, so you can query it later regardless.

Phone numbers are normalized to E.164 automatically — a missing `+` prefix is added and spaces/dashes are stripped. The country code must already be present (e.g. `27821234567` → `+27821234567`).

### Retries

Retry logic is intentionally not built into this component. There are two reasons:

1. **A blocking retry inside an action is the wrong Convex primitive.** Sleeping and looping inside `send` would hold the function slot and consume the 2-minute action timeout. Convex's model for durable, multi-step work is scheduling — not blocking.

2. **The component cannot know your retry policy.** Some failures are permanent (`131030` — recipient not in allowed list) and should never be retried. Others are transient (`130429` — rate limited) and should back off. Only your app knows which is which, and only your app has the business context to decide whether to retry, notify a user, or escalate.

The right tool for this is [`@convex-dev/workflow`](https://www.convex.dev/components/workflow), which gives you durable multi-step workflows with built-in retry and sleep support. A rate-limit-aware send workflow looks like this:

```ts
import { WorkflowManager } from '@convex-dev/workflow'
import { components, internal } from './_generated/api'
import { isWhatsAppError } from 'convex-whatsapp'
import { whatsapp } from './whatsapp'

const workflow = new WorkflowManager(components.workflow)

export const sendWithRetry = workflow.define({
  args: { to: v.string(), body: v.string() },
  handler: async (step, { to, body }): Promise<string> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await step.runAction(internal.messages.doSend, { to, body })
      } catch (e) {
        if (isWhatsAppError(e) && e.data.code === 130429 && attempt < 3) {
          // Rate limited — wait with exponential backoff before retrying
          await step.sleep(`backoff-${attempt}`, 2 ** attempt * 5_000)
          continue
        }
        throw e
      }
    }
    throw new Error('unreachable')
  },
})
```

### Conversations

```ts
import { query } from './_generated/server'
import { v } from 'convex/values'
import { whatsapp } from './whatsapp'

export const thread = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const conversation = await whatsapp.getConversation(ctx, phoneNumber)
    if (!conversation) return null
    const messages = await whatsapp.getMessages(ctx, conversation._id)
    return { conversation, messages }
  },
})
```

### Templates

```ts
import { action } from './_generated/server'
import { whatsapp } from './whatsapp'

export const refreshTemplates = action({
  args: {},
  handler: async (ctx) => {
    await whatsapp.syncTemplates(ctx) // pull from Meta (needs WHATSAPP_WABA_ID)
    return whatsapp.getTemplates(ctx, 'APPROVED') // read the local cache
  },
})
```

## API Reference

| Method                                              | Ctx      | Description                                          |
| --------------------------------------------------- | -------- | ---------------------------------------------------- |
| `send(ctx, args)`                                   | action   | Send a message; returns the stored message id        |
| `syncTemplates(ctx)`                                | action   | Pull approved templates from the Graph API           |
| `getTemplates(ctx, status?)`                        | query    | Read cached templates, optionally filtered by status |
| `listConversations(ctx, limit?)`                    | query    | List conversations sorted by most recent, default 50 |
| `getConversation(ctx, phoneNumber)`                 | query    | Fetch a conversation by phone number                 |
| `getMessages(ctx, conversationId)`                  | query    | List a conversation's messages, oldest first         |
| `markConversationRead(ctx, conversationId)`         | mutation | Reset `unreadCount` to 0                             |
| `updateConversationMetadata(ctx, conversationId, metadata)` | mutation | Store arbitrary app data on a conversation   |
| `registerInboundHandler(ctx, handle)`               | mutation | Register the function to run on each inbound message |

## Testing

Register the component (and its `webhookReceiver` child) in one call:

```ts
import { convexTest } from 'convex-test'
import whatsapp from 'convex-whatsapp/test'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function makeT() {
  const t = convexTest(schema, modules)
  whatsapp.register(t) // registers "whatsapp" + "webhookReceiver"
  return t
}
```

## Notes

- One component instance = one WhatsApp Business Account / phone number. Multi-tenancy (multiple WABAs in one deployment) is intentionally out of scope — provision a separate Convex deployment per client.
- Inbound webhook ingestion is handled by [`convex-webhook-receiver`](https://github.com/david-potgieter/convex-webhook-receiver), included as a child component.

## License

Apache-2.0

---

Built with ♥ for Convex | [Convex](https://www.convex.dev/) • [Components](https://docs.convex.dev/components) • [GitHub](https://github.com/david-potgieter/convex-whatsapp)
