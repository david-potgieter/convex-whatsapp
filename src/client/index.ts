import type {
  FunctionHandle,
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
} from 'convex/server'
import type { ComponentApi } from '../component/_generated/component.js'

// ---------------------------------------------------------------------------
// Ctx types — Pick only what each method needs so callers can use mutation
// or action ctx interchangeably where both work.
// ---------------------------------------------------------------------------

type RunQuery = Pick<GenericMutationCtx<GenericDataModel>, 'runQuery'>
type RunMutation = Pick<GenericMutationCtx<GenericDataModel>, 'runMutation'>
type RunAction = Pick<GenericActionCtx<GenericDataModel>, 'runAction'>

// ---------------------------------------------------------------------------
// Infer return types straight from the ComponentApi so they stay in sync.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type FunctionArgs<F> = F extends FunctionReference<any, any, infer A, any, any> ? A : never

type FunctionReturn<F> = F extends FunctionReference<any, any, any, infer R, any> ? R : never
/* eslint-enable @typescript-eslint/no-explicit-any */

type ConversationDoc = NonNullable<FunctionReturn<ComponentApi['conversations']['getConversation']>>
type MessageDoc = FunctionReturn<ComponentApi['conversations']['getMessages']>[number]
type TemplateDoc = FunctionReturn<ComponentApi['templates']['getTemplates']>[number]

// ---------------------------------------------------------------------------
// Send arg types — discriminated union for good DX (stricter than the
// component's bag-of-optional-fields validator).
// ---------------------------------------------------------------------------

type InteractiveButton = {
  type: 'button'
  body: { text: string }
  header?: { type: 'text'; text: string }
  footer?: { text: string }
  action: {
    buttons: Array<{ type: 'reply'; reply: { id: string; title: string } }>
  }
}

type InteractiveList = {
  type: 'list'
  body: { text: string }
  header?: { type: 'text'; text: string }
  footer?: { text: string }
  action: {
    button: string
    sections: Array<{
      title?: string
      rows: Array<{ id: string; title: string; description?: string }>
    }>
  }
}

export type SendArgs =
  | { to: string; type: 'text'; text: { body: string; previewUrl?: boolean } }
  | {
      to: string
      type: 'template'
      template: { name: string; language: string; components?: unknown[] }
    }
  | { to: string; type: 'image'; image: { link?: string; id?: string; caption?: string } }
  | {
      to: string
      type: 'document'
      document: { link?: string; id?: string; caption?: string; filename?: string }
    }
  | { to: string; type: 'audio'; audio: { link?: string; id?: string } }
  | { to: string; type: 'video'; video: { link?: string; id?: string; caption?: string } }
  | { to: string; type: 'interactive'; interactive: InteractiveButton | InteractiveList }

export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'FLAGGED' | 'DISABLED'

// ---------------------------------------------------------------------------
// WhatsApp client
// ---------------------------------------------------------------------------

export class WhatsApp {
  constructor(public component: ComponentApi) {}

  // --- Outbound messaging (actions only) ---

  async send(ctx: RunAction, args: SendArgs): Promise<string> {
    type ComponentSendArgs = FunctionArgs<ComponentApi['messages']['send']>
    return ctx.runAction(this.component.messages.send, args as unknown as ComponentSendArgs)
  }

  // --- Template management (action for sync, query for read) ---

  async syncTemplates(ctx: RunAction): Promise<null> {
    return ctx.runAction(this.component.templates.syncTemplates, {})
  }

  async getTemplates(ctx: RunQuery, status?: TemplateStatus): Promise<TemplateDoc[]> {
    return ctx.runQuery(this.component.templates.getTemplates, { status })
  }

  // --- Conversations (queries) ---

  async getMessage(ctx: RunQuery, messageId: string): Promise<MessageDoc | null> {
    return ctx.runQuery(this.component.conversations.getMessage, { messageId })
  }

  async getConversation(ctx: RunQuery, phoneNumber: string): Promise<ConversationDoc | null> {
    return ctx.runQuery(this.component.conversations.getConversation, {
      phoneNumber,
    })
  }

  async getMessages(ctx: RunQuery, conversationId: string): Promise<MessageDoc[]> {
    return ctx.runQuery(this.component.conversations.getMessages, {
      conversationId,
    })
  }

  async listConversations(ctx: RunQuery, limit?: number): Promise<ConversationDoc[]> {
    return ctx.runQuery(this.component.conversations.listConversations, { limit })
  }

  async markConversationRead(ctx: RunMutation, conversationId: string): Promise<null> {
    return ctx.runMutation(this.component.conversations.markConversationRead, {
      conversationId,
    })
  }

  async updateConversationMetadata(
    ctx: RunMutation,
    conversationId: string,
    metadata: unknown,
  ): Promise<null> {
    return ctx.runMutation(this.component.conversations.updateConversationMetadata, {
      conversationId,
      metadata,
    })
  }

  // --- Inbound callback registration (mutation) ---

  async registerInboundHandler(
    ctx: RunMutation,
    handle: FunctionHandle<'mutation'>,
  ): Promise<null> {
    return ctx.runMutation(this.component.config.registerInboundHandler, {
      handle: handle as string,
    })
  }
}
