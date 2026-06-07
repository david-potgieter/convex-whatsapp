/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    config: {
      registerInboundHandler: FunctionReference<
        "mutation",
        "internal",
        { handle: string },
        null,
        Name
      >;
    };
    conversations: {
      getConversation: FunctionReference<
        "query",
        "internal",
        { phoneNumber: string },
        {
          _creationTime: number;
          _id: string;
          lastMessageAt: number;
          lastMessagePreview: string;
          metadata?: any;
          phoneNumber: string;
          unreadCount: number;
        } | null,
        Name
      >;
      getMessage: FunctionReference<
        "query",
        "internal",
        { messageId: string },
        {
          _creationTime: number;
          _id: string;
          conversationId?: string;
          direction: "inbound" | "outbound";
          errorDetails?: string;
          from: string;
          payload: any;
          status: "queued" | "sent" | "delivered" | "read" | "failed";
          timestamp: number;
          to: string;
          type:
            | "text"
            | "template"
            | "image"
            | "document"
            | "audio"
            | "video"
            | "interactive";
          waMessageId?: string;
        } | null,
        Name
      >;
      getMessages: FunctionReference<
        "query",
        "internal",
        { conversationId: string },
        Array<{
          _creationTime: number;
          _id: string;
          conversationId?: string;
          direction: "inbound" | "outbound";
          errorDetails?: string;
          from: string;
          payload: any;
          status: "queued" | "sent" | "delivered" | "read" | "failed";
          timestamp: number;
          to: string;
          type:
            | "text"
            | "template"
            | "image"
            | "document"
            | "audio"
            | "video"
            | "interactive";
          waMessageId?: string;
        }>,
        Name
      >;
      listConversations: FunctionReference<
        "query",
        "internal",
        { limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          lastMessageAt: number;
          lastMessagePreview: string;
          metadata?: any;
          phoneNumber: string;
          unreadCount: number;
        }>,
        Name
      >;
      markConversationRead: FunctionReference<
        "mutation",
        "internal",
        { conversationId: string },
        null,
        Name
      >;
      updateConversationMetadata: FunctionReference<
        "mutation",
        "internal",
        { conversationId: string; metadata: any },
        null,
        Name
      >;
    };
    messages: {
      send: FunctionReference<
        "action",
        "internal",
        {
          audio?: { id?: string; link?: string };
          document?: {
            caption?: string;
            filename?: string;
            id?: string;
            link?: string;
          };
          image?: { caption?: string; id?: string; link?: string };
          interactive?:
            | {
                action: {
                  buttons: Array<{
                    reply: { id: string; title: string };
                    type: "reply";
                  }>;
                };
                body: { text: string };
                footer?: { text: string };
                header?: { text: string; type: "text" };
                type: "button";
              }
            | {
                action: {
                  button: string;
                  sections: Array<{
                    rows: Array<{
                      description?: string;
                      id: string;
                      title: string;
                    }>;
                    title?: string;
                  }>;
                };
                body: { text: string };
                footer?: { text: string };
                header?: { text: string; type: "text" };
                type: "list";
              };
          template?: {
            components?: Array<any>;
            language: string;
            name: string;
          };
          text?: { body: string; previewUrl?: boolean };
          to: string;
          type:
            | "text"
            | "template"
            | "image"
            | "document"
            | "audio"
            | "video"
            | "interactive";
          video?: { caption?: string; id?: string; link?: string };
        },
        string,
        Name
      >;
    };
    templates: {
      getTemplates: FunctionReference<
        "query",
        "internal",
        {
          status?:
            | "APPROVED"
            | "PENDING"
            | "REJECTED"
            | "PAUSED"
            | "FLAGGED"
            | "DISABLED";
        },
        Array<{
          _creationTime: number;
          _id: string;
          category: string;
          components: any;
          language: string;
          lastSyncedAt: number;
          name: string;
          status:
            | "APPROVED"
            | "PENDING"
            | "REJECTED"
            | "PAUSED"
            | "FLAGGED"
            | "DISABLED";
          waTemplateId: string;
        }>,
        Name
      >;
      syncTemplates: FunctionReference<"action", "internal", {}, null, Name>;
    };
  };
