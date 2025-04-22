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
	help: {
		examples: [
			"# Basic usage",
			"$ sitemcp https://example.com",
			"",
			"# With better concurrency",
			"$ sitemcp https://daisyui.com --concurrency 10",
			"",
			"# With a custom tool name strategy",
			"$ sitemcp https://react-tweet.vercel.app/ -t subdomain # tool names would be indexOfReactTweet / getDocumentOfReactTweet",
			"",
			"# With matching specific pages",
			'$ sitemcp https://vite.dev -m "/blog/**" -m "/guide/**"',
			"",
			"# With a custom content selector",
			'$ sitemcp https://vite.dev --content-selector ".content"',
			"",
			"# With a custom content length",
			"$ sitemcp https://vite.dev -l 10000",
			"",
			"# Without cache",
			"$ sitemcp https://ryoppippi.com --no-cache",
		],
	},
});

await startServer({
	...argv.flags,
	cache: !argv.flags.noCache,
	url: argv._.url,
});
