import { convexTest } from 'convex-test'
import webhookReceiver from 'convex-webhook-receiver/test'
import { describe, expect, test, vi, afterEach } from 'vitest'
import { api, internal } from './_generated/api.js'
import schema from './schema.js'

const modules = import.meta.glob('./**/*.ts')

function makeT() {
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token'
  process.env.WHATSAPP_APP_SECRET = 'test-app-secret'

  const t = convexTest(schema, modules)
  t.registerComponent('webhookReceiver', webhookReceiver.schema, webhookReceiver.modules)
  return t
}

afterEach(() => vi.unstubAllGlobals())

const metaSuccess = (waMessageId = 'wamid.test') =>
  new Response(JSON.stringify({ messages: [{ id: waMessageId }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

function statusPayload(
  waMessageId: string,
  status: string,
  errors?: Array<{ code: number; title: string; message: string }>,
) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              statuses: [
                {
                  id: waMessageId,
                  status,
                  timestamp: '1700000000',
                  recipient_id: '+27821234567',
                  ...(errors ? { errors } : {}),
                },
              ],
            },
          },
        ],
      },
    ],
  })
}

async function sendAndGetId(t: ReturnType<typeof makeT>, waMessageId = 'wamid.test') {
  vi.stubGlobal('fetch', async () => metaSuccess(waMessageId))
  const msgId = await t.action(api.messages.send, {
    to: '+27821234567',
    type: 'text',
    text: { body: 'Hello!' },
  })
  vi.unstubAllGlobals()
  return msgId
}

describe('message status webhook handling', () => {
  test('delivered status updates message', async () => {
    const t = makeT()
    const msgId = await sendAndGetId(t, 'wamid.test')

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: statusPayload('wamid.test', 'delivered'),
      headers: {},
    })

    const msg = await t.run((ctx) => ctx.db.get(msgId))
    expect(msg?.status).toBe('delivered')
  })

  test('read status updates message', async () => {
    const t = makeT()
    const msgId = await sendAndGetId(t, 'wamid.test')

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: statusPayload('wamid.test', 'read'),
      headers: {},
    })

    const msg = await t.run((ctx) => ctx.db.get(msgId))
    expect(msg?.status).toBe('read')
  })

  test('failed status stores errorDetails from Meta payload', async () => {
    const t = makeT()
    const msgId = await sendAndGetId(t, 'wamid.test')

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: statusPayload('wamid.test', 'failed', [
        { code: 131047, title: 'Re-engagement message', message: 'Message failed to send' },
      ]),
      headers: {},
    })

    const msg = await t.run((ctx) => ctx.db.get(msgId))
    expect(msg?.status).toBe('failed')
    expect(msg?.errorDetails).toContain('Re-engagement message')
  })

  test('no-op when waMessageId is not found', async () => {
    const t = makeT()
    const msgId = await sendAndGetId(t, 'wamid.known')

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: statusPayload('wamid.unknown', 'delivered'),
      headers: {},
    })

    const msg = await t.run((ctx) => ctx.db.get(msgId))
    expect(msg?.status).toBe('sent')
  })

  test('sent status updates message', async () => {
    const t = makeT()
    const msgId = await sendAndGetId(t, 'wamid.test')

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: statusPayload('wamid.test', 'sent'),
      headers: {},
    })

    const msg = await t.run((ctx) => ctx.db.get(msgId))
    expect(msg?.status).toBe('sent')
  })

  test('unknown status value is ignored', async () => {
    const t = makeT()
    const msgId = await sendAndGetId(t, 'wamid.test')

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: statusPayload('wamid.test', 'pending'),
      headers: {},
    })

    const msg = await t.run((ctx) => ctx.db.get(msgId))
    expect(msg?.status).toBe('sent')
  })
})
