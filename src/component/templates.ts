import { v } from 'convex/values'
import { internal } from './_generated/api.js'
import { action, env, query } from './_generated/server.js'
import schema from './schema.js'

const META_API_VERSION = 'v18.0'

type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'FLAGGED' | 'DISABLED'
const VALID_STATUSES = new Set<string>([
  'APPROVED',
  'PENDING',
  'REJECTED',
  'PAUSED',
  'FLAGGED',
  'DISABLED',
])

const templateDoc = schema.tables.templates.validator.extend({
  _id: v.id('templates'),
  _creationTime: v.number(),
})

export const getTemplates = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('APPROVED'),
        v.literal('PENDING'),
        v.literal('REJECTED'),
        v.literal('PAUSED'),
        v.literal('FLAGGED'),
        v.literal('DISABLED'),
      ),
    ),
  },
  returns: v.array(templateDoc),
  handler: async (ctx, args) => {
    if (args.status) {
      return ctx.db
        .query('templates')
        .withIndex('by_status', (q) => q.eq('status', args.status!))
        .collect()
    }
    return ctx.db.query('templates').collect()
  },
})

export const syncTemplates = action({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    if (!env.WHATSAPP_WABA_ID) {
      throw new Error(
        'WHATSAPP_WABA_ID env var is required for template sync. Set it in the Convex dashboard.',
      )
    }

    let nextUrl: string | null =
      `https://graph.facebook.com/${META_API_VERSION}/${env.WHATSAPP_WABA_ID}/message_templates` +
      `?fields=name,language,category,status,components&limit=200`

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      })

      if (!response.ok) {
        throw new Error(`Template sync failed: ${await response.text()}`)
      }

      const data = (await response.json()) as {
        data: Array<{
          name: string
          language: string
          category: string
          status: string
          components: unknown
          id: string
        }>
        paging?: { next?: string }
      }

      for (const tpl of data.data) {
        const status: TemplateStatus = VALID_STATUSES.has(tpl.status)
          ? (tpl.status as TemplateStatus)
          : 'PENDING'

        await ctx.runMutation(internal.templatesInternal.upsertTemplate, {
          name: tpl.name,
          language: tpl.language,
          category: tpl.category,
          status,
          components: tpl.components ?? [],
          waTemplateId: tpl.id,
        })
      }

      nextUrl = data.paging?.next ?? null
    }

    return null
  },
})
