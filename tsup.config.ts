import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/client/index.ts',
    'convex.config': 'src/component/convex.config.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['convex'],
})
