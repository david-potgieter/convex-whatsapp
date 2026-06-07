import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/client/index.ts',
    'convex.config': 'src/component/convex.config.ts',
    http: 'src/component/http.ts',
    schema: 'src/component/schema.ts',
    'conversations': 'src/component/conversations.ts',
    'messages': 'src/component/messages.ts',
    'messagesInternal': 'src/component/messagesInternal.ts',
    'templates': 'src/component/templates.ts',
    'templatesInternal': 'src/component/templatesInternal.ts',
    'webhook': 'src/component/webhook.ts',
    'config': 'src/component/config.ts',
  },
  format: ['esm'],
  dts: { entry: { index: 'src/client/index.ts', 'convex.config': 'src/component/convex.config.ts' } },
  sourcemap: true,
  clean: true,
  external: ['convex'],
})
