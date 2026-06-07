import { v } from 'convex/values'
import { mutation, query } from './_generated/server.js'
import schema from './schema.js'
import type { Id } from './_generated/dataModel.js'

const conversationDoc = schema.tables.conversations.validator.extend({
  _id: v.id('conversations'),
  _creationTime: v.number(),
})

const messageDoc = schema.tables.messages.validator.extend({
  _id: v.id('messages'),
  _creationTime: v.number(),
})

export const getConversation = query({
  args: { phoneNumber: v.string() },
  returns: v.nullable(conversationDoc),
  handler: async (ctx, args) => {
    return ctx.db
      .query('conversations')
      .withIndex('by_phoneNumber', (q) => q.eq('phoneNumber', args.phoneNumber))
      .first()
  },
})

export const getMessages = query({
  args: { conversationId: v.id('conversations') },
  returns: v.array(messageDoc),
  handler: async (ctx, args) => {
    return ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .order('asc')
      .collect()
  },
})

export const getMessage = query({
  args: { messageId: v.string() },
  returns: v.nullable(messageDoc),
  handler: async (ctx, args) => {
    return ctx.db.get(args.messageId as Id<'messages'>)
  },
})

export const listConversations = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(conversationDoc),
  handler: async (ctx, args) => {
    return ctx.db
      .query('conversations')
      .withIndex('by_lastMessageAt')
      .order('desc')
      .take(args.limit ?? 50)
  },
})

export const markConversationRead = mutation({
  args: { conversationId: v.id('conversations') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, { unreadCount: 0 })
    return null
  },
})

export const updateConversationMetadata = mutation({
  args: { conversationId: v.id('conversations'), metadata: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, { metadata: args.metadata })
    return null
  },
})
