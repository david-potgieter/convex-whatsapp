import { convexTest } from 'convex-test'
import webhookReceiver from 'convex-webhook-receiver/test'
import { afterEach, describe, expect, test, vi } from 'vitest'
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

const metaSuccess = () =>
  new Response(JSON.stringify({ messages: [{ id: 'wamid.abc' }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

afterEach(() => vi.unstubAllGlobals())

const inboundPayload = (from: string, body: string, waId = 'wamid.inbound1') =>
  JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              messages: [
                {
                  from,
                  id: waId,
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  })

describe('conversation auto-create', () => {
  test('outbound send creates a conversation', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => metaSuccess())

    await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'text',
      text: { body: 'Hello!' },
    })

    const conv = await t.query(api.conversations.getConversation, {
      phoneNumber: '+27821234567',
    })
    expect(conv).not.toBeNull()
    expect(conv?.phoneNumber).toBe('+27821234567')
    expect(conv?.lastMessagePreview).toBe('Hello!')
    expect(conv?.unreadCount).toBe(0)
  })

  test('inbound message creates a conversation with unreadCount 1', async () => {
    const t = makeT()

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: inboundPayload('+27829999999', 'Hey there'),
      headers: {},
    })

    const conv = await t.query(api.conversations.getConversation, {
      phoneNumber: '+27829999999',
    })
    expect(conv).not.toBeNull()
    expect(conv?.unreadCount).toBe(1)
    expect(conv?.lastMessagePreview).toBe('Hey there')
  })
})

describe('conversation deduplication', () => {
  test('second outbound to same number reuses conversation', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => metaSuccess())

    await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'text',
      text: { body: 'First' },
    })
    await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'text',
      text: { body: 'Second' },
    })

    const convs = await t.run((ctx) => ctx.db.query('conversations').collect())
    expect(convs).toHaveLength(1)
    expect(convs[0].lastMessagePreview).toBe('Second')
  })

  test('second inbound from same number increments unreadCount', async () => {
    const t = makeT()

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: inboundPayload('+27821234567', 'First', 'wamid.1'),
      headers: {},
    })
    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: inboundPayload('+27821234567', 'Second', 'wamid.2'),
      headers: {},
    })

    const conv = await t.query(api.conversations.getConversation, {
      phoneNumber: '+27821234567',
    })
    expect(conv?.unreadCount).toBe(2)
    expect(conv?.lastMessagePreview).toBe('Second')
  })
})

describe('getMessages', () => {
  test('returns messages in chronological order', async () => {
    const t = makeT()

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: inboundPayload('+27821234567', 'First', 'wamid.1'),
      headers: {},
    })
    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: inboundPayload('+27821234567', 'Second', 'wamid.2'),
      headers: {},
    })

    const conv = await t.query(api.conversations.getConversation, {
      phoneNumber: '+27821234567',
    })
    const messages = await t.query(api.conversations.getMessages, {
      conversationId: conv!._id,
    })

    expect(messages).toHaveLength(2)
    expect((messages[0].payload as { body: string }).body).toBe('First')
    expect((messages[1].payload as { body: string }).body).toBe('Second')
  })

  test('outbound message appears in conversation messages', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => metaSuccess())

    await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'text',
      text: { body: 'Hi from us' },
    })

    const conv = await t.query(api.conversations.getConversation, {
      phoneNumber: '+27821234567',
    })
    const messages = await t.query(api.conversations.getMessages, {
      conversationId: conv!._id,
    })

    expect(messages).toHaveLength(1)
    expect(messages[0].direction).toBe('outbound')
  })
})
