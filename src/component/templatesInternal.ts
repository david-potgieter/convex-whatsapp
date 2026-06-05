import { v } from 'convex/values'
import { internalMutation } from './_generated/server.js'

const TEMPLATE_STATUS_VALIDATOR = v.union(
  v.literal('APPROVED'),
  v.literal('PENDING'),
  v.literal('REJECTED'),
  v.literal('PAUSED'),
  v.literal('FLAGGED'),
  v.literal('DISABLED'),
)

export const upsertTemplate = internalMutation({
  args: {
    name: v.string(),
    language: v.string(),
    category: v.string(),
    status: TEMPLATE_STATUS_VALIDATOR,
    components: v.any(),
    waTemplateId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('templates')
      .withIndex('by_name_language', (q) => q.eq('name', args.name).eq('language', args.language))
      .first()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, lastSyncedAt: now })
    } else {
      await ctx.db.insert('templates', { ...args, lastSyncedAt: now })
    }
    return null
  },
})

export const patchTemplateStatus = internalMutation({
  args: {
    name: v.string(),
    language: v.string(),
    status: TEMPLATE_STATUS_VALIDATOR,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('templates')
      .withIndex('by_name_language', (q) => q.eq('name', args.name).eq('language', args.language))
      .first()

    if (!existing) return null
    await ctx.db.patch(existing._id, { status: args.status })
    return null
  },
})
