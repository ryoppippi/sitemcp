import { defineConfig } from "tsdown";

const config: ReturnType<typeof defineConfig> = defineConfig({
	outDir: "dist",
	entry: "src/cli.ts",
	fixedExtension: true,
	publint: true,
	dts: false,
	clean: true,
	unused: { level: "error" },
	nodeProtocol: true,
	outputOptions: {
		banner: "#!/usr/bin/env node\n",
	},
});

export default config;
