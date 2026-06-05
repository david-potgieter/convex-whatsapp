/**
 * Example functions demonstrating convex-whatsapp usage.
 * Run any of these from the Convex dashboard or CLI.
 */
import type { FunctionHandle } from 'convex/server'
import { WhatsApp } from '../src/client/index.js'
import { createFunctionHandle } from 'convex/server'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { action, internalMutation, mutation } from './_generated/server'

const whatsapp = new WhatsApp(components.whatsapp)

// ---------------------------------------------------------------------------
// Outbound messaging
// ---------------------------------------------------------------------------

export const sendText = action({
  args: { to: v.string() },
  handler: async (ctx, { to }) => {
    return whatsapp.send(ctx, {
      to,
      type: 'text',
      text: { body: 'Hello from convex-whatsapp!' },
    })
  },
})

export const sendTemplate = action({
  args: { to: v.string() },
  handler: async (ctx, { to }) => {
    return whatsapp.send(ctx, {
      to,
      type: 'template',
      template: {
        name: 'hello_world',
        language: 'en',
        components: [],
      },
    })
  },
})

export const sendImage = action({
  args: { to: v.string(), imageUrl: v.string() },
  handler: async (ctx, { to, imageUrl }) => {
    return whatsapp.send(ctx, {
      to,
      type: 'image',
      image: { link: imageUrl, caption: 'Check this out!' },
    })
  },
})

export const sendButtons = action({
  args: { to: v.string() },
  handler: async (ctx, { to }) => {
    return whatsapp.send(ctx, {
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Confirm your appointment?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'confirm', title: 'Yes, confirm' } },
            { type: 'reply', reply: { id: 'cancel', title: 'Cancel' } },
          ],
        },
      },
    })
  },
})

// ---------------------------------------------------------------------------
// Template management
// ---------------------------------------------------------------------------

export const syncTemplates = action({
  args: {},
  handler: async (ctx) => {
    await whatsapp.syncTemplates(ctx)
  },
})

export const listApprovedTemplates = action({
  args: {},
  handler: async (ctx) => {
    return whatsapp.getTemplates(ctx, 'APPROVED')
  },
})

// ---------------------------------------------------------------------------
// Inbound message handling
// ---------------------------------------------------------------------------

/**
 * Register this as your inbound handler to react to incoming messages.
 * The component passes the new message's id (a string, since component ids
 * are opaque strings to the app). Use it to drive your own business logic —
 * e.g. parse a command, look up a customer, enqueue a reply.
 */
export const onInboundMessage = internalMutation({
  args: { messageId: v.string() },
  returns: v.null(),
  handler: async (_ctx, { messageId }) => {
    console.log('New inbound WhatsApp message:', messageId)
    return null
  },
})

export const registerInboundHandler = mutation({
  args: {},
  handler: async (ctx) => {
    const handle = await createFunctionHandle(internal.examples.onInboundMessage)
    await whatsapp.registerInboundHandler(ctx, handle as FunctionHandle<'mutation'>)
  },
})

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export const getConversation = action({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    return whatsapp.getConversation(ctx, phoneNumber)
  },
})

export const getMessages = action({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    return whatsapp.getMessages(ctx, conversationId)
  },
})
