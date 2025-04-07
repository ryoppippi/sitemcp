import { defineConfig } from 'tsdown'

const config: ReturnType<typeof defineConfig> = defineConfig({
  outDir: 'dist',
  entry: 'src/cli.ts',
  dts: true,
  clean: true,
  bundleDts: true
})

export default config
