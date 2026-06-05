/// <reference types="vite/client" />
import type { TestConvex } from 'convex-test'
import type { GenericSchema, SchemaDefinition } from 'convex/server'
import webhookReceiver from 'convex-webhook-receiver/test'
import schema from './component/schema.js'

const modules = import.meta.glob('./component/**/*.ts')

/**
 * Register the `whatsapp` component (and its `webhookReceiver` child) with a
 * `convex-test` instance. Call this once per test file before running tests.
 *
 * @example
 * ```ts
 * import { convexTest } from "convex-test";
 * import whatsapp from "convex-whatsapp/test";
 * import schema from "./schema";
 * const modules = import.meta.glob("./**\/*.ts");
 *
 * function makeT() {
 *   const t = convexTest(schema, modules);
 *   whatsapp.register(t);
 *   return t;
 * }
 * ```
 */
export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name: string = 'whatsapp',
) {
  t.registerComponent(name, schema, modules)
  t.registerComponent('webhookReceiver', webhookReceiver.schema, webhookReceiver.modules)
}

export default { register, schema, modules }
