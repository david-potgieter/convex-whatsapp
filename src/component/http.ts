import { createFunctionHandle, httpRouter } from 'convex/server'
import { components, internal } from './_generated/api.js'
import { env, httpAction } from './_generated/server.js'

const http = httpRouter()

http.route({
  path: '/webhook',
  method: 'GET',
  handler: httpAction(async (_ctx, req) => {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }),
})

http.route({
  path: '/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256') ?? ''

    if (!(await verifyMetaSignature(rawBody, signature, env.WHATSAPP_APP_SECRET))) {
      return new Response('Unauthorized', { status: 401 })
    }

    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
    })

    const handlerHandle = await createFunctionHandle(internal.webhook.processEvent)

    await ctx.runAction(components.webhookReceiver.event.actions.receive, {
      provider: 'whatsapp',
      rawBody,
      headers,
      handlerFunctionHandle: handlerHandle,
      maxAttempts: 3,
      expiresInMs: 30 * 24 * 60 * 60 * 1000,
    })

    return new Response('OK', { status: 200 })
  }),
})

async function verifyMetaSignature(
  rawBody: string,
  signature: string,
  appSecret: string,
): Promise<boolean> {
  if (!signature.startsWith('sha256=')) return false

  const expectedHex = signature.slice(7)
  const match = expectedHex.match(/.{1,2}/g)
  if (!match) return false

  const expectedBytes = new Uint8Array(match.map((byte) => parseInt(byte, 16)))
  const encoder = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  return crypto.subtle.verify('HMAC', key, expectedBytes, encoder.encode(rawBody))
}

export default http
