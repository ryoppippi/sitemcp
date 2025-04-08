import * as fs from "node:fs";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { version } from "../package.json";
import { fetchSite } from "./fetch-site.ts";
import { logger } from "./logger.ts";
import type { FetchSiteResult } from "./types.ts";
import {
	cacheDirectory,
	ensureArray,
	sanitizeToolName,
	sanitizeUrl,
} from "./utils.ts";

interface StartServerOptions {
	url: string;
	concurrency?: number;
	match?: string | string[];
	contentSelector?: string;
	limit?: number;
	cache?: boolean;
	silent?: boolean;
}

export async function startServer(
	options: StartServerOptions,
): Promise<McpServer> {
	const {
		url,
		concurrency = 3,
		match,
		contentSelector,
		limit,
		cache = false,
	} = options;

	// create server instance
	const server = new McpServer({
		name: `mcp server for ${url}`,
		version,
	});

	// use console.error because stdout cannot be used in MCP server
	logger.setLevel("warn");

	const sanitizedUrl = sanitizeUrl(url);
	const catchDir = cacheDirectory();
	const cacheFile = path.join(catchDir, `${sanitizedUrl}.json`);

	let pages: FetchSiteResult | undefined = undefined;

	if (cache) {
		// check if cache exists
		if (fs.existsSync(cacheFile)) {
			logger.info("Using cache file", cacheFile);
			const json = fs.readFileSync(cacheFile, "utf-8");
			try {
				pages = new Map(Object.entries(JSON.parse(json)));
			} catch (e) {
				logger.warn("Cache file is invalid, ignoring");
				pages = undefined;
			}
		}
	}

	if (pages == null) {
		pages = await fetchSite(url, {
			concurrency,
			match: (match && ensureArray(match)) as string[],
			contentSelector,
			limit,
		});
	}

	if (pages.size === 0) {
		logger.warn("No pages found");
		return server;
	}

	if (cache) {
		// create cache dir if not exists
		if (!fs.existsSync(catchDir)) {
			fs.promises.mkdir(catchDir, { recursive: true });
		}
		// write to cache file
		const json = JSON.stringify(Object.fromEntries(pages), null, 2);
		await fs.promises.writeFile(cacheFile, json, "utf-8");
		logger.info("Cache file written to", cacheFile);
	}

	for (const page of pages.values()) {
		const name = sanitizeToolName(page.url);
		const description = `get page content: ${page.title}` as const;

		logger.info(`Registering tool ${name} (${description})`);

		try {
			server.tool(name, description, async () => {
				return {
					content: [
						{
							type: "text",
							text: page.content,
						},
					],
				};
			});
		} catch (_e) {
			const e = _e as Error;
			if (e.message.includes("already registered")) {
				logger.warn(`Tool ${name} already registered, skipping`);
			}
		}
	}

	const transport = new StdioServerTransport();
	await server.connect(transport);
	logger.info("MCP Server running on stdio");

	return server;
}
