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

const fakePage = (templates: object[], nextUrl?: string) =>
  new Response(
    JSON.stringify({
      data: templates,
      ...(nextUrl ? { paging: { next: nextUrl } } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

const sampleTemplate = (overrides: object = {}) => ({
  id: 'tpl-001',
  name: 'payment_reminder',
  language: 'en',
  category: 'UTILITY',
  status: 'APPROVED',
  components: [{ type: 'body', text: 'Your payment of {{1}} is due.' }],
  ...overrides,
})

function templateStatusWebhook(name: string, language: string, event: string) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'message_template_status_update',
            value: {
              event,
              message_template_id: 123,
              message_template_name: name,
              message_template_language: language,
              reason: null,
            },
          },
        ],
      },
    ],
  })
}

describe('syncTemplates', () => {
  test('upserts templates from Meta API', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => fakePage([sampleTemplate()]))

    await t.action(api.templates.syncTemplates, {})

    const templates = await t.query(api.templates.getTemplates, {})
    expect(templates).toHaveLength(1)
    expect(templates[0].name).toBe('payment_reminder')
    expect(templates[0].status).toBe('APPROVED')
    expect(templates[0].language).toBe('en')
    expect(templates[0].waTemplateId).toBe('tpl-001')
  })

  test('is idempotent — second sync updates existing records, no duplicates', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => fakePage([sampleTemplate()]))

    await t.action(api.templates.syncTemplates, {})
    await t.action(api.templates.syncTemplates, {})

    const templates = await t.query(api.templates.getTemplates, {})
    expect(templates).toHaveLength(1)
  })

  test('handles pagination by following next URL', async () => {
    const t = makeT()
    let callCount = 0
    vi.stubGlobal('fetch', async () => {
      callCount++
      if (callCount === 1) {
        return fakePage(
          [sampleTemplate({ id: 'tpl-001', name: 'reminder_1' })],
          'https://graph.facebook.com/next-page',
        )
      }
      return fakePage([sampleTemplate({ id: 'tpl-002', name: 'reminder_2', language: 'af' })])
    })

    await t.action(api.templates.syncTemplates, {})

    const templates = await t.query(api.templates.getTemplates, {})
    expect(templates).toHaveLength(2)
    expect(callCount).toBe(2)
  })

  test('throws if WHATSAPP_WABA_ID is not set', async () => {
    const t = makeT()
    process.env.WHATSAPP_WABA_ID = ''

    await expect(t.action(api.templates.syncTemplates, {})).rejects.toThrow('WHATSAPP_WABA_ID')
  })
})

describe('template status webhook', () => {
  test('PAUSED event updates template status', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => fakePage([sampleTemplate()]))
    await t.action(api.templates.syncTemplates, {})

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: templateStatusWebhook('payment_reminder', 'en', 'PAUSED'),
      headers: {},
    })

    const templates = await t.query(api.templates.getTemplates, {})
    expect(templates[0].status).toBe('PAUSED')
  })

  test('APPROVED event updates template status', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => fakePage([sampleTemplate({ status: 'PAUSED' })]))
    await t.action(api.templates.syncTemplates, {})

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: templateStatusWebhook('payment_reminder', 'en', 'APPROVED'),
      headers: {},
    })

    const templates = await t.query(api.templates.getTemplates, {})
    expect(templates[0].status).toBe('APPROVED')
  })

  test('no-op when template not found in registry', async () => {
    const t = makeT()

    await t.action(internal.webhook.processEvent, {
      provider: 'whatsapp',
      rawBody: templateStatusWebhook('unknown_template', 'en', 'REJECTED'),
      headers: {},
    })

    const templates = await t.query(api.templates.getTemplates, {})
    expect(templates).toHaveLength(0)
  })
})

describe('getTemplates', () => {
  test('returns all templates when no status filter', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () =>
      fakePage([
        sampleTemplate({ id: '1', name: 'tpl_a', status: 'APPROVED' }),
        sampleTemplate({ id: '2', name: 'tpl_b', language: 'af', status: 'REJECTED' }),
      ]),
    )
    await t.action(api.templates.syncTemplates, {})

    const all = await t.query(api.templates.getTemplates, {})
    expect(all).toHaveLength(2)
  })

  test('filters by APPROVED status', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () =>
      fakePage([
        sampleTemplate({ id: '1', name: 'tpl_a', status: 'APPROVED' }),
        sampleTemplate({ id: '2', name: 'tpl_b', language: 'af', status: 'REJECTED' }),
      ]),
    )
    await t.action(api.templates.syncTemplates, {})

    const approved = await t.query(api.templates.getTemplates, { status: 'APPROVED' })
    expect(approved).toHaveLength(1)
    expect(approved[0].name).toBe('tpl_a')
  })
})
