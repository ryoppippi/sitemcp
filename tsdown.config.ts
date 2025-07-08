import { defineConfig } from "tsdown";

const config: ReturnType<typeof defineConfig> = defineConfig({
	outDir: "dist",
	entry: {
		cli: "src/cli.ts",
		worker: "src/worker.ts",
	},
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
