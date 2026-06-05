import { convexTest } from 'convex-test'
import webhookReceiver from 'convex-webhook-receiver/test'
import { describe, expect, test } from 'vitest'
import schema from './schema.js'

const modules = import.meta.glob('./**/*.ts')

const TEST_VERIFY_TOKEN = 'test-verify-token'
const TEST_APP_SECRET = 'test-app-secret'

async function signBody(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `sha256=${hex}`
}

function makeT() {
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = TEST_VERIFY_TOKEN
  process.env.WHATSAPP_APP_SECRET = TEST_APP_SECRET
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'

  const t = convexTest(schema, modules)
  t.registerComponent('webhookReceiver', webhookReceiver.schema, webhookReceiver.modules)
  return t
}

describe('GET /webhook', () => {
  test('returns challenge when verify token matches', async () => {
    const t = makeT()
    const response = await t.fetch(
      `/webhook?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=abc123`,
      { method: 'GET' },
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('abc123')
  })

  test('returns 403 when verify token is wrong', async () => {
    const t = makeT()
    const response = await t.fetch(
      `/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123`,
      { method: 'GET' },
    )
    expect(response.status).toBe(403)
  })

  test('returns 403 when mode is not subscribe', async () => {
    const t = makeT()
    const response = await t.fetch(
      `/webhook?hub.mode=unsubscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=abc123`,
      { method: 'GET' },
    )
    expect(response.status).toBe(403)
  })
})

describe('POST /webhook', () => {
  test('accepts valid signed payload', async () => {
    const t = makeT()
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    const signature = await signBody(body, TEST_APP_SECRET)

    const response = await t.fetch('/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signature, 'content-type': 'application/json' },
      body,
    })
    expect(response.status).toBe(200)
  })

  test('returns 401 when signature header is missing', async () => {
    const t = makeT()
    const response = await t.fetch('/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(response.status).toBe(401)
  })

  test('returns 401 when signature is invalid', async () => {
    const t = makeT()
    const response = await t.fetch('/webhook', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': 'sha256=deadbeef00000000',
        'content-type': 'application/json',
      },
      body: '{}',
    })
    expect(response.status).toBe(401)
  })
})
