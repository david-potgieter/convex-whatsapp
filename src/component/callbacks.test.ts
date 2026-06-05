import { createFunctionHandle } from 'convex/server'
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
  process.env.WHATSAPP_WABA_ID = 'test-waba-id'

  const t = convexTest(schema, modules)
  t.registerComponent('webhookReceiver', webhookReceiver.schema, webhookReceiver.modules)
  return t
}

afterEach(() => vi.unstubAllGlobals())

const inboundPayload = (from: string, body: string) =>
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
                  id: 'wamid.test',
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

describe('registerInboundHandler', () => {
  test('stores the handle in config', async () => {
    const t = makeT()

    const handle = await t.run(() => createFunctionHandle(internal.config.noopInboundHandler))
    await t.mutation(api.config.registerInboundHandler, { handle })

    const config = await t.run((ctx) => ctx.db.query('config').first())
    expect(config?.inboundHandlerHandle).toBe(handle)
  })

  test('overwrites previous handle — only one config doc exists', async () => {
    const t = makeT()

    const handle1 = await t.run(() => createFunctionHandle(internal.config.noopInboundHandler))
    const handle2 = await t.run(() => createFunctionHandle(internal.config.noopInboundHandler))

    await t.mutation(api.config.registerInboundHandler, { handle: handle1 })
    await t.mutation(api.config.registerInboundHandler, { handle: handle2 })

    const configs = await t.run((ctx) => ctx.db.query('config').collect())
    expect(configs).toHaveLength(1)
    expect(configs[0].inboundHandlerHandle).toBe(handle2)
  })
})

describe('inbound callback scheduling', () => {
  test('no-op when no handler registered — inbound message stored without error', async () => {
    const t = makeT()

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: inboundPayload('+27821234567', 'Hello'),
      headers: {},
    })

    const messages = await t.run((ctx) => ctx.db.query('messages').collect())
    expect(messages).toHaveLength(1)
    expect(messages[0].direction).toBe('inbound')

    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    expect(scheduled).toHaveLength(0)
  })

  test('schedules the registered handler when inbound message arrives', async () => {
    const t = makeT()

    const handle = await t.run(() => createFunctionHandle(internal.config.noopInboundHandler))
    await t.mutation(api.config.registerInboundHandler, { handle })

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: inboundPayload('+27821234567', 'Hello'),
      headers: {},
    })

    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    expect(scheduled).toHaveLength(1)
  })

  test('scheduled callback carries the correct messageId', async () => {
    const t = makeT()

    const handle = await t.run(() => createFunctionHandle(internal.config.noopInboundHandler))
    await t.mutation(api.config.registerInboundHandler, { handle })

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: inboundPayload('+27821234567', 'Hello'),
      headers: {},
    })

    const [message] = await t.run((ctx) => ctx.db.query('messages').collect())
    const [scheduled] = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())

    const args = scheduled.args as [{ messageId: string }]
    expect(args[0].messageId).toBe(message._id.toString())
  })
})
