import process from "node:process";
import { cli } from "cleye";
import { version } from "../package.json";
import { startServer } from "./server.ts";
import { TOOL_NAME_STRATEGIES, type ToolNameStrategy } from "./types.ts";

const argv = cli({
	name: "sitemcp",
	version,
	parameters: [
		"<url>", // The URL to fetch
	],
	flags: {
		concurrency: {
			type: Number,
			default: 3,
			alias: "c",
			description: "Number of concurrent requests",
		},
		match: {
			type: [String],
			alias: "m",
			description: "Only fetch matched pages",
		},
		contentSelector: {
			type: String,
			description: "The CSS selector to find content",
		},
		limit: {
			type: Number,
			description: "Limit the result to this amount of pages",
		},
		noCache: {
			type: Boolean,
			default: false,
			description: "Use cache",
		},
		toolNameStrategy: {
			type: (type: ToolNameStrategy): ToolNameStrategy => {
				if (!TOOL_NAME_STRATEGIES.includes(type)) {
					throw new Error(`Invalid tool name strategy: ${type}`);
				}
				return type;
			},
			default: "domain" as const,
			alias: "t",
			description: `Tool name strategy (${TOOL_NAME_STRATEGIES.join(", ")})`,
		},
		maxLength: {
			type: Number,
			default: 2000,
			alias: "l",
			description: "Maximum length of the content to return",
		},
	},
});

await startServer({
	...argv.flags,
	cache: !argv.flags.noCache,
	url: argv._.url,
});
