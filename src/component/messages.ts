import type { Id } from './_generated/dataModel.js'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api.js'
import { action, env } from './_generated/server.js'

const META_API_VERSION = 'v18.0'

// ---------------------------------------------------------------------------
// Payload validators (mirror Meta's field names)
// ---------------------------------------------------------------------------

const textPayload = v.object({
  body: v.string(),
  previewUrl: v.optional(v.boolean()),
})

const templatePayload = v.object({
  name: v.string(),
  language: v.string(),
  components: v.optional(v.array(v.any())),
})

const imagePayload = v.object({
  link: v.optional(v.string()),
  id: v.optional(v.string()),
  caption: v.optional(v.string()),
})

const documentPayload = v.object({
  link: v.optional(v.string()),
  id: v.optional(v.string()),
  caption: v.optional(v.string()),
  filename: v.optional(v.string()),
})

const audioPayload = v.object({
  link: v.optional(v.string()),
  id: v.optional(v.string()),
})

const videoPayload = v.object({
  link: v.optional(v.string()),
  id: v.optional(v.string()),
  caption: v.optional(v.string()),
})

const interactiveHeader = v.optional(v.object({ type: v.literal('text'), text: v.string() }))
const interactiveFooter = v.optional(v.object({ text: v.string() }))

const interactivePayload = v.union(
  v.object({
    type: v.literal('button'),
    body: v.object({ text: v.string() }),
    header: interactiveHeader,
    footer: interactiveFooter,
    action: v.object({
      buttons: v.array(
        v.object({
          type: v.literal('reply'),
          reply: v.object({ id: v.string(), title: v.string() }),
        }),
      ),
    }),
  }),
  v.object({
    type: v.literal('list'),
    body: v.object({ text: v.string() }),
    header: interactiveHeader,
    footer: interactiveFooter,
    action: v.object({
      button: v.string(),
      sections: v.array(
        v.object({
          title: v.optional(v.string()),
          rows: v.array(
            v.object({
              id: v.string(),
              title: v.string(),
              description: v.optional(v.string()),
            }),
          ),
        }),
      ),
    }),
  }),
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePhone(phone: string): string {
  const stripped = phone.replace(/[\s\-().]/g, '')
  return stripped.startsWith('+') ? stripped : `+${stripped}`
}

type MetaErrorShape = {
  error?: { code?: number; message?: string; type?: string; fbtrace_id?: string }
}

function parseMetaError(body: string): { code: number; message: string; type: string; fbtraceId?: string } {
  try {
    const parsed = JSON.parse(body) as MetaErrorShape
    const e = parsed.error ?? {}
    return {
      code: e.code ?? 0,
      message: e.message ?? body,
      type: e.type ?? 'Unknown',
      ...(e.fbtrace_id ? { fbtraceId: e.fbtrace_id } : {}),
    }
  } catch {
    return { code: 0, message: body, type: 'Unknown' }
  }
}

// ---------------------------------------------------------------------------
// send action
// ---------------------------------------------------------------------------

// Convex requires args to be a PropertyValidators (plain object), not v.union().
// Type-specific fields are optional; callers must supply the field matching `type`.
export const send = action({
  args: {
    to: v.string(),
    type: v.union(
      v.literal('text'),
      v.literal('template'),
      v.literal('image'),
      v.literal('document'),
      v.literal('audio'),
      v.literal('video'),
      v.literal('interactive'),
    ),
    text: v.optional(textPayload),
    template: v.optional(templatePayload),
    image: v.optional(imagePayload),
    document: v.optional(documentPayload),
    audio: v.optional(audioPayload),
    video: v.optional(videoPayload),
    interactive: v.optional(interactivePayload),
  },
  returns: v.id('messages'),
  handler: async (ctx, args): Promise<Id<'messages'>> => {
    const to = normalizePhone(args.to)

    const payload =
      args.type === 'text'
        ? args.text
        : args.type === 'template'
          ? args.template
          : args.type === 'image'
            ? args.image
            : args.type === 'document'
              ? args.document
              : args.type === 'audio'
                ? args.audio
                : args.type === 'video'
                  ? args.video
                  : args.interactive

    let metaTypeField: object
    if (args.type === 'text') {
      metaTypeField = {
        text: { body: args.text!.body, preview_url: args.text!.previewUrl ?? false },
      }
    } else if (args.type === 'template') {
      metaTypeField = {
        template: {
          name: args.template!.name,
          language: { code: args.template!.language },
          components: args.template!.components ?? [],
        },
      }
    } else if (args.type === 'image') {
      metaTypeField = { image: args.image! }
    } else if (args.type === 'document') {
      metaTypeField = { document: args.document! }
    } else if (args.type === 'audio') {
      metaTypeField = { audio: args.audio! }
    } else if (args.type === 'video') {
      metaTypeField = { video: args.video! }
    } else {
      metaTypeField = { interactive: args.interactive! }
    }

    const messageId: Id<'messages'> = await ctx.runMutation(
      internal.messagesInternal.insertQueued,
      { to, type: args.type, payload },
    )

    let response: Response
    try {
      response = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: args.type,
            ...metaTypeField,
          }),
        },
      )
    } catch (networkError) {
      const errorDetails = String(networkError)
      await ctx.runMutation(internal.messagesInternal.updateStatus, {
        messageId,
        status: 'failed',
        errorDetails,
      })
      throw new ConvexError({ code: 0, message: errorDetails, type: 'NetworkError' })
    }

    if (!response.ok) {
      const errorDetails = await response.text()
      await ctx.runMutation(internal.messagesInternal.updateStatus, {
        messageId,
        status: 'failed',
        errorDetails,
      })
      throw new ConvexError(parseMetaError(errorDetails))
    }

    const data = (await response.json()) as { messages: Array<{ id: string }> }
    await ctx.runMutation(internal.messagesInternal.updateStatus, {
      messageId,
      status: 'sent',
      waMessageId: data.messages?.[0]?.id,
    })

    return messageId
  },
})
