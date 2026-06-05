import type { FunctionHandle } from 'convex/server'
import type { Id } from './_generated/dataModel.js'
import type { MutationCtx } from './_generated/server.js'
import { v } from 'convex/values'
import { env, internalMutation } from './_generated/server.js'

const MESSAGE_TYPE_VALIDATOR = v.union(
  v.literal('text'),
  v.literal('template'),
  v.literal('image'),
  v.literal('document'),
  v.literal('audio'),
  v.literal('video'),
  v.literal('interactive'),
)

export const insertQueued = internalMutation({
  args: {
    to: v.string(),
    type: MESSAGE_TYPE_VALIDATOR,
    payload: v.any(),
  },
  returns: v.id('messages'),
  handler: async (ctx, args) => {
    const now = Date.now()
    const preview = messagePreview(args.type, args.payload)
    const conversationId = await upsertConversation(ctx, args.to, preview, now, false)

    return ctx.db.insert('messages', {
      direction: 'outbound',
      type: args.type,
      status: 'queued',
      to: args.to,
      from: env.WHATSAPP_PHONE_NUMBER_ID,
      payload: args.payload,
      timestamp: now,
      conversationId,
    })
  },
})

export const insertInbound = internalMutation({
  args: {
    from: v.string(),
    waMessageId: v.string(),
    type: MESSAGE_TYPE_VALIDATOR,
    payload: v.any(),
    timestamp: v.number(),
  },
  returns: v.id('messages'),
  handler: async (ctx, args) => {
    const preview = messagePreview(args.type, args.payload)
    const conversationId = await upsertConversation(ctx, args.from, preview, args.timestamp, true)

    const messageId = await ctx.db.insert('messages', {
      direction: 'inbound',
      type: args.type,
      status: 'delivered',
      waMessageId: args.waMessageId,
      from: args.from,
      to: env.WHATSAPP_PHONE_NUMBER_ID,
      payload: args.payload,
      timestamp: args.timestamp,
      conversationId,
    })

    const config = await ctx.db.query('config').first()
    if (config?.inboundHandlerHandle) {
      await ctx.scheduler.runAfter(0, config.inboundHandlerHandle as FunctionHandle<'mutation'>, {
        messageId: messageId as string,
      })
    }

    return messageId
  },
})

export const updateStatus = internalMutation({
  args: {
    messageId: v.id('messages'),
    status: v.union(v.literal('sent'), v.literal('failed')),
    waMessageId: v.optional(v.string()),
    errorDetails: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      status: args.status,
      ...(args.waMessageId !== undefined ? { waMessageId: args.waMessageId } : {}),
      ...(args.errorDetails !== undefined ? { errorDetails: args.errorDetails } : {}),
    })
    return null
  },
})

export const patchStatusByWaId = internalMutation({
  args: {
    waMessageId: v.string(),
    status: v.union(
      v.literal('sent'),
      v.literal('delivered'),
      v.literal('read'),
      v.literal('failed'),
    ),
    errorDetails: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query('messages')
      .withIndex('by_waMessageId', (q) => q.eq('waMessageId', args.waMessageId))
      .first()

    if (!message) return null

    await ctx.db.patch(message._id, {
      status: args.status,
      ...(args.errorDetails !== undefined ? { errorDetails: args.errorDetails } : {}),
    })
    return null
  },
})

async function upsertConversation(
  ctx: MutationCtx,
  phoneNumber: string,
  preview: string,
  timestamp: number,
  isInbound: boolean,
): Promise<Id<'conversations'>> {
  const existing = await ctx.db
    .query('conversations')
    .withIndex('by_phoneNumber', (q) => q.eq('phoneNumber', phoneNumber))
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, {
      lastMessageAt: timestamp,
      lastMessagePreview: preview,
      ...(isInbound ? { unreadCount: existing.unreadCount + 1 } : {}),
    })
    return existing._id
  }

  return ctx.db.insert('conversations', {
    phoneNumber,
    lastMessageAt: timestamp,
    lastMessagePreview: preview,
    unreadCount: isInbound ? 1 : 0,
  })
}

function messagePreview(type: string, payload: unknown): string {
  if (type === 'text' && typeof payload === 'object' && payload !== null && 'body' in payload) {
    const body = String((payload as { body: string }).body)
    return body.length > 80 ? body.slice(0, 80) + '…' : body
  }
  const previews: Record<string, string> = {
    image: 'Image',
    document: 'Document',
    audio: 'Audio',
    video: 'Video',
    template: 'Template message',
    interactive: 'Interactive message',
  }
  return previews[type] ?? 'Message'
}
