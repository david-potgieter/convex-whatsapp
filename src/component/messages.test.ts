import { convexTest } from 'convex-test'
import webhookReceiver from 'convex-webhook-receiver/test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { api } from './_generated/api.js'
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
  new Response(
    JSON.stringify({
      messaging_product: 'whatsapp',
      contacts: [{ input: '+27821234567', wa_id: '27821234567' }],
      messages: [{ id: 'wamid.test123' }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

afterEach(() => vi.unstubAllGlobals())

describe('messages.send text', () => {
  test('persists queued then transitions to sent with waMessageId', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => metaSuccess())

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'text',
      text: { body: 'Hello!' },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.status).toBe('sent')
    expect(msg?.waMessageId).toBe('wamid.test123')
    expect(msg?.direction).toBe('outbound')
    expect(msg?.type).toBe('text')
    expect(msg?.from).toBe('123456789')
    expect(msg?.to).toBe('+27821234567')
    expect(msg?.payload).toEqual({ body: 'Hello!' }) // stored payload = text field
    expect(msg?.timestamp).toBeTypeOf('number')
  })

  test('throws and marks failed with parsed error code on non-2xx response', async () => {
    const t = makeT()
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 131030, message: 'Recipient not in allowed list', type: 'OAuthException' },
          }),
          { status: 400 },
        ),
    )

    await expect(
      t.action(api.messages.send, { to: '+27821234567', type: 'text', text: { body: 'Hello!' } }),
    ).rejects.toThrow()

    const messages = await t.run((ctx) => ctx.db.query('messages').collect())
    expect(messages[0].status).toBe('failed')
    expect(messages[0].errorDetails).toContain('131030')
  })

  test('throws and marks failed on network error', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => {
      throw new Error('Network error')
    })

    await expect(
      t.action(api.messages.send, { to: '+27821234567', type: 'text', text: { body: 'Hello!' } }),
    ).rejects.toThrow()

    const messages = await t.run((ctx) => ctx.db.query('messages').collect())
    expect(messages[0].status).toBe('failed')
    expect(messages[0].errorDetails).toContain('Network error')
  })

  test('calls Meta API with correct payload', async () => {
    const t = makeT()
    let capturedBody: unknown
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return metaSuccess()
    })

    await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'text',
      text: { body: 'Test message', previewUrl: true },
    })

    expect(capturedBody).toMatchObject({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '+27821234567',
      type: 'text',
      text: { body: 'Test message', preview_url: true }, // camelCase → snake_case mapping
    })
  })
})

describe('messages.send template (#80)', () => {
  test('sends template message with correct Meta body', async () => {
    const t = makeT()
    let capturedBody: unknown
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return metaSuccess()
    })

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'template',
      template: {
        name: 'payment_reminder',
        language: 'en',
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'R500' }] }],
      },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.status).toBe('sent')
    expect(msg?.type).toBe('template')
    expect(capturedBody).toMatchObject({
      type: 'template',
      template: { name: 'payment_reminder', language: { code: 'en' } },
    })
  })

  test('validator rejects missing template name', async () => {
    const t = makeT()
    await expect(
      t.action(api.messages.send, {
        to: '+27821234567',
        type: 'template',
        template: { language: 'en' } as never,
      }),
    ).rejects.toThrow()
  })
})

describe('messages.send media (#81)', () => {
  test('sends image message with link', async () => {
    const t = makeT()
    let capturedBody: unknown
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return metaSuccess()
    })

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'image',
      image: { link: 'https://example.com/photo.jpg', caption: 'Check this out' },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.type).toBe('image')
    expect(msg?.status).toBe('sent')
    expect(capturedBody).toMatchObject({
      type: 'image',
      image: { link: 'https://example.com/photo.jpg' },
    })
  })

  test('sends document with filename', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => metaSuccess())

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'document',
      document: { link: 'https://example.com/report.pdf', filename: 'report.pdf' },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.type).toBe('document')
    expect(msg?.status).toBe('sent')
  })

  test('sends audio message', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => metaSuccess())

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'audio',
      audio: { link: 'https://example.com/audio.ogg' },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.type).toBe('audio')
  })

  test('sends video message', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => metaSuccess())

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'video',
      video: { link: 'https://example.com/clip.mp4', caption: 'Watch this' },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.type).toBe('video')
  })
})

describe('messages.send interactive (#82)', () => {
  test('sends button message with correct Meta body', async () => {
    const t = makeT()
    let capturedBody: unknown
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return metaSuccess()
    })

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Confirm your appointment?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'yes', title: 'Yes' } },
            { type: 'reply', reply: { id: 'no', title: 'No' } },
          ],
        },
      },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.type).toBe('interactive')
    expect(msg?.status).toBe('sent')
    expect(capturedBody).toMatchObject({
      type: 'interactive',
      interactive: { type: 'button', body: { text: 'Confirm your appointment?' } },
    })
  })

  test('sends list picker message', async () => {
    const t = makeT()
    vi.stubGlobal('fetch', async () => metaSuccess())

    const messageId = await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'Choose a service' },
        action: {
          button: 'View options',
          sections: [
            {
              title: 'Services',
              rows: [
                { id: 'svc1', title: 'Tax return', description: 'Annual filing' },
                { id: 'svc2', title: 'Payroll', description: 'Monthly payroll' },
              ],
            },
          ],
        },
      },
    })

    const msg = await t.run((ctx) => ctx.db.get(messageId))
    expect(msg?.type).toBe('interactive')
    expect(msg?.status).toBe('sent')
  })

  test('validator rejects malformed button (missing reply)', async () => {
    const t = makeT()
    await expect(
      t.action(api.messages.send, {
        to: '+27821234567',
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Choose' },
          action: { buttons: [{ type: 'reply' } as never] },
        },
      }),
    ).rejects.toThrow()
  })
})

describe('phone normalization', () => {
  test('adds + prefix when missing', async () => {
    const t = makeT()
    let capturedBody: unknown
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return metaSuccess()
    })

    await t.action(api.messages.send, {
      to: '27821234567',
      type: 'text',
      text: { body: 'Hi' },
    })

    expect((capturedBody as { to: string }).to).toBe('+27821234567')
    const messages = await t.run((ctx) => ctx.db.query('messages').collect())
    expect(messages[0].to).toBe('+27821234567')
  })

  test('leaves already-normalized number unchanged', async () => {
    const t = makeT()
    let capturedBody: unknown
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return metaSuccess()
    })

    await t.action(api.messages.send, {
      to: '+27821234567',
      type: 'text',
      text: { body: 'Hi' },
    })

    expect((capturedBody as { to: string }).to).toBe('+27821234567')
  })

  test('strips spaces and dashes', async () => {
    const t = makeT()
    let capturedBody: unknown
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return metaSuccess()
    })

    await t.action(api.messages.send, {
      to: '+27 82 123-4567',
      type: 'text',
      text: { body: 'Hi' },
    })

    expect((capturedBody as { to: string }).to).toBe('+27821234567')
  })
})

describe('error handling', () => {
  test('ConvexError carries parsed Meta error code', async () => {
    const t = makeT()
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 131030,
              message: 'Recipient phone number not in allowed list',
              type: 'OAuthException',
              fbtrace_id: 'abc123',
            },
          }),
          { status: 400 },
        ),
    )

    let caught: unknown
    try {
      await t.action(api.messages.send, { to: '+27821234567', type: 'text', text: { body: 'Hi' } })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeDefined()
    // ConvexError wraps the structured data
    expect((caught as { data?: { code: number } }).data?.code).toBe(131030)
  })
})
