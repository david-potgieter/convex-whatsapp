import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/client/index.ts',
    'convex.config': 'convex.config.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['convex'],
})
