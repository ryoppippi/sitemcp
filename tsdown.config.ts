import { nodeExternals } from "rollup-plugin-node-externals";
import { defineConfig } from "tsdown";

const config: ReturnType<typeof defineConfig> = defineConfig({
	outDir: "dist",
	entry: "src/cli.ts",
	fixedExtension: true,
	publint: true,
	dts: false,
	clean: true,
	unused: { level: "error" },
	outputOptions: {
		banner: "#!/usr/bin/env node\n",
	},
	plugins: [
		// @ts-expect-error type definitions for unplugin-macros are not available
		nodeExternals(),
	],
});

export default config;
