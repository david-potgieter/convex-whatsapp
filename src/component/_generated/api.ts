/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as config from "../config.js";
import type * as conversations from "../conversations.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as messagesInternal from "../messagesInternal.js";
import type * as templates from "../templates.js";
import type * as templatesInternal from "../templatesInternal.js";
import type * as webhook from "../webhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  config: typeof config;
  conversations: typeof conversations;
  http: typeof http;
  messages: typeof messages;
  messagesInternal: typeof messagesInternal;
  templates: typeof templates;
  templatesInternal: typeof templatesInternal;
  webhook: typeof webhook;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {
  webhookReceiver: import("convex-webhook-receiver/_generated/component.js").ComponentApi<"webhookReceiver">;
};
