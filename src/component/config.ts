import { v } from 'convex/values'
import { internalMutation, mutation } from './_generated/server.js'

export const registerInboundHandler = mutation({
  args: { handle: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('config').first()
    if (existing) {
      await ctx.db.patch(existing._id, { inboundHandlerHandle: args.handle })
    } else {
      await ctx.db.insert('config', { inboundHandlerHandle: args.handle })
    }
    return null
  },
})

// No-op handler — useful as a placeholder during development.
export const noopInboundHandler = internalMutation({
  args: { messageId: v.string() },
  returns: v.null(),
  handler: async () => null,
})
