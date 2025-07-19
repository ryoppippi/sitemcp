import { cli, define } from "gunshi";
import { description, name, version } from "../package.json";
import { startServer } from "./server.ts";
import { TOOL_NAME_STRATEGIES, type ToolNameStrategy } from "./types.ts";

const command = define({
	toKebab: true,
	args: {
		url: {
			type: "positional",
			description: "The URL to fetch",
		},
		concurrency: {
			type: "number",
			short: "c",
			default: 3,
			description: "Number of concurrent requests",
		},
		match: {
			type: "string",
			multiple: true,
			short: "m",
			description: "Only fetch matched pages",
		},
		contentSelector: {
			type: "string",
			description: "The CSS selector to find content",
		},
		limit: {
			type: "number",
			description: "Limit the result to this amount of pages",
		},
		cache: {
			type: "boolean",
			negatable: true,
			description: "Disable cache",
			default: true,
		},
		toolNameStrategy: {
			type: "enum",
			short: "t",
			default: "domain",
			choices: TOOL_NAME_STRATEGIES,
			description: "Tool name strategy",
		},
		maxLength: {
			type: "number",
			short: "l",
			default: 2000,
			description: "Maximum length of the content to return",
		},
		sitemap: {
			type: "boolean",
			short: "s",
			description: "Use sitemap.xml to discover URLs (auto-detect)",
		},
		sitemapUrl: {
			type: "string",
			description: "Custom sitemap URL path",
		},
		timeout: {
			type: "number",
			description: "Timeout in seconds for site fetching (default: 60)",
			default: 60,
		},
	},

	examples: `# Basic usage
$ sitemcp https://example.com

# With better concurrency
$ sitemcp https://daisyui.com --concurrency 10

# With a custom tool name strategy
$ sitemcp https://react-tweet.vercel.app/ -t subdomain # tool names would be indexOfReactTweet / getDocumentOfReactTweet

# With matching specific pages
$ sitemcp https://vite.dev -m "/blog/**" -m "/guide/**"

# With a custom content selector
$ sitemcp https://vite.dev --content-selector ".content"

# With a custom content length
$ sitemcp https://vite.dev -l 10000

# Without cache
$ sitemcp https://ryoppippi.com --no-cache

# With sitemap auto-detection
$ sitemcp https://nextjs.org --sitemap

# With custom sitemap URL
$ sitemcp https://example.com --sitemap-url /custom-sitemap.xml`,

	run: async (ctx) => {
		const {
			url,
			concurrency,
			match,
			contentSelector,
			limit,
			cache,
			toolNameStrategy,
			maxLength,
			sitemap,
			sitemapUrl,
			timeout,
		} = ctx.values;

		// Validate toolNameStrategy
		if (
			toolNameStrategy &&
			!TOOL_NAME_STRATEGIES.includes(toolNameStrategy as ToolNameStrategy)
		) {
			throw new Error(`Invalid tool name strategy: ${toolNameStrategy}`);
		}

		// Validate required positional argument
		if (!url) {
			throw new Error("URL is required");
		}

		await startServer({
			concurrency: concurrency ?? 3,
			match: match ?? [],
			contentSelector,
			limit,
			cache,
			toolNameStrategy: (toolNameStrategy as ToolNameStrategy) ?? "domain",
			maxLength: maxLength ?? 2000,
			url,
			sitemap: sitemapUrl !== undefined ? sitemapUrl : sitemap,
			timeout: timeout ?? 25,
		});
	},
});

await cli(process.argv.slice(2), command, {
	name,
	version,
	description,
});
