import { v } from 'convex/values'
import { internal } from './_generated/api.js'
import { internalAction } from './_generated/server.js'

type WhatsAppMessage = {
  from: string
  id: string
  timestamp: string
  type: string
  [key: string]: unknown
}

type WhatsAppStatus = {
  id: string
  status: string
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string; message: string }>
}

type TemplateStatusEvent = {
  event: string
  message_template_name: string
  message_template_language: string
}

type WhatsAppPayload = {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product?: string
        messages?: WhatsAppMessage[]
        statuses?: WhatsAppStatus[]
      } & TemplateStatusEvent
      field: string
    }>
  }>
}

const TEMPLATE_STATUS_MAP: Record<
  string,
  'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'FLAGGED' | 'DISABLED'
> = {
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
  FLAGGED: 'FLAGGED',
  DISABLED: 'DISABLED',
}

const META_STATUS_MAP: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
}

const VALID_TYPES = new Set([
  'text',
  'template',
  'image',
  'document',
  'audio',
  'video',
  'interactive',
])

type MessageType = 'text' | 'template' | 'image' | 'document' | 'audio' | 'video' | 'interactive'

export const processEvent = internalAction({
  args: {
    provider: v.string(),
    rawBody: v.string(),
    headers: v.record(v.string(), v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const payload = JSON.parse(args.rawBody) as WhatsAppPayload

    if (payload.object !== 'whatsapp_business_account') return null

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'message_template_status_update') {
          const ev = change.value
          const tplStatus = TEMPLATE_STATUS_MAP[ev.event]
          if (tplStatus) {
            await ctx.runMutation(internal.templatesInternal.patchTemplateStatus, {
              name: ev.message_template_name,
              language: ev.message_template_language,
              status: tplStatus,
            })
          }
          continue
        }

        if (change.field !== 'messages') continue

        for (const msg of change.value.messages ?? []) {
          const type: MessageType = VALID_TYPES.has(msg.type) ? (msg.type as MessageType) : 'text'

          await ctx.runMutation(internal.messagesInternal.insertInbound, {
            from: msg.from,
            waMessageId: msg.id,
            type,
            payload: (msg[msg.type] as unknown) ?? {},
            timestamp: parseInt(msg.timestamp, 10) * 1000,
          })
        }

        for (const status of change.value.statuses ?? []) {
          const mapped = META_STATUS_MAP[status.status]
          if (!mapped) continue

          const errorDetails = status.errors?.[0]
            ? `${status.errors[0].title}: ${status.errors[0].message}`
            : undefined

          await ctx.runMutation(internal.messagesInternal.patchStatusByWaId, {
            waMessageId: status.id,
            status: mapped,
            errorDetails,
          })
        }
      }
    }

    return null
  },
})
