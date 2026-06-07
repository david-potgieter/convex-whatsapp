import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  messages: defineTable({
    direction: v.union(v.literal('inbound'), v.literal('outbound')),
    type: v.union(
      v.literal('text'),
      v.literal('template'),
      v.literal('image'),
      v.literal('document'),
      v.literal('audio'),
      v.literal('video'),
      v.literal('interactive'),
    ),
    status: v.union(
      v.literal('queued'),
      v.literal('sent'),
      v.literal('delivered'),
      v.literal('read'),
      v.literal('failed'),
    ),
    waMessageId: v.optional(v.string()),
    from: v.string(),
    to: v.string(),
    payload: v.any(),
    timestamp: v.number(),
    errorDetails: v.optional(v.string()),
    conversationId: v.optional(v.id('conversations')),
  })
    .index('by_waMessageId', ['waMessageId'])
    .index('by_conversation', ['conversationId', 'timestamp']),

  config: defineTable({
    inboundHandlerHandle: v.optional(v.string()),
  }),

  templates: defineTable({
    name: v.string(),
    language: v.string(),
    category: v.string(),
    status: v.union(
      v.literal('APPROVED'),
      v.literal('PENDING'),
      v.literal('REJECTED'),
      v.literal('PAUSED'),
      v.literal('FLAGGED'),
      v.literal('DISABLED'),
    ),
    components: v.any(),
    waTemplateId: v.string(),
    lastSyncedAt: v.number(),
  })
    .index('by_name_language', ['name', 'language'])
    .index('by_status', ['status']),

  conversations: defineTable({
    phoneNumber: v.string(),
    lastMessageAt: v.number(),
    lastMessagePreview: v.string(),
    unreadCount: v.number(),
    metadata: v.optional(v.any()),
  })
    .index('by_phoneNumber', ['phoneNumber'])
    .index('by_lastMessageAt', ['lastMessageAt']),
})
