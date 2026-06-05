/**
 * Verifies that the exported `register` test helper works correctly for
 * consumers who install convex-whatsapp as a dependency.
 */
import { convexTest } from 'convex-test'
import { describe, expect, test, vi, afterEach } from 'vitest'
import { api, internal } from './_generated/api.js'
import schema from './schema.js'
import { register } from '../test.js'

afterEach(() => vi.unstubAllGlobals())

function makeT() {
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token'
  process.env.WHATSAPP_APP_SECRET = 'test-app-secret'
  process.env.WHATSAPP_WABA_ID = 'test-waba-id'

  const modules = import.meta.glob('./**/*.ts')
  const t = convexTest(schema, modules)
  register(t)
  return t
}

describe('register() test helper', () => {
  test('registers the component so send works end-to-end', async () => {
    const t = makeT()
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ messages: [{ id: 'wamid.abc' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'text',
      text: { body: 'Hello via test helper' },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.status).toBe('sent')
  })

  test('registers the component so inbound webhook works', async () => {
    const t = makeT()

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: JSON.stringify({
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
                      from: '+27829999999',
                      id: 'wamid.inbound',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Reply via helper test' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
      headers: {},
    })

    const conv = await t.query(api.conversations.getConversation, {
      phoneNumber: '+27829999999',
    })
    expect(conv?.unreadCount).toBe(1)
  })
})
