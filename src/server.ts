import * as fs from "node:fs";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { stringify } from "@std/yaml";
import { z } from "zod";
import { version } from "../package.json";
import { fetchSite } from "./fetch-site.ts";
import { logger } from "./logger.ts";
import type { FetchSiteResult, StartServerOptions } from "./types.ts";
import {
	cacheDirectory,
	ensureArray,
	sanitiseToolName,
	sanitiseUrl,
} from "./utils.ts";

export async function startServer(
	options: StartServerOptions,
): Promise<McpServer> {
	const {
		url,
		concurrency,
		contentSelector,
		cache,
		toolNameStrategy,
		maxLength,
		match,
		limit,
		sitemap,
		timeout,
	} = options;

	// create server instance
	const server = new McpServer({
		name: `mcp server for ${url}`,
		version,
	});

	// use console.error because stdout cannot be used in MCP server
	logger.setLevel("warn");

	const sanitisedUrl = sanitiseUrl(url);
	const catchDir = cacheDirectory();
	const cacheFile = path.join(catchDir, `${sanitisedUrl}.json`);

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
		// Add timeout to prevent hanging during site fetching
		const timeoutMs = (timeout ?? 300) * 1000; // Convert seconds to milliseconds
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(
				() =>
					reject(
						new Error(
							`Site fetching timed out after ${timeout ?? 300} seconds`,
						),
					),
				timeoutMs,
			);
		});

		try {
			pages = await Promise.race([
				fetchSite(url, {
					concurrency,
					match: (match && ensureArray(match)) as string[],
					contentSelector,
					limit,
					sitemap,
				}),
				timeoutPromise,
			]);
		} catch (error) {
			logger.warn(
				`Site fetching failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			pages = new Map(); // Continue with empty pages to allow server to start
		}
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

	const indexServerName =
		`indexOf${sanitiseToolName(url, toolNameStrategy)}` as const;
	const getDocumentServerName =
		`getDocumentOf${sanitiseToolName(url, toolNameStrategy)}` as const;

	/** create server for index of the site */
	server.tool(
		indexServerName,
		`
	Get index of ${url}.
	Before accessing the ${getDocumentServerName} tool, please call this tool first to get the list of pages.
	If the content is too long, you can use the \`max_length\` and \`start_index\` parameters to limit the content.
	`,
		{
			max_length: z
				.number()
				.default(maxLength)
				.describe("The max length of the index to return"),
			start_index: z
				.number()
				.default(0)
				.describe("The starting index of the index to return"),
		},
		async ({ start_index, max_length }) => {
			let index = Array.from(pages).map(([key, page]) => ({
				subpath: key,
				title: page.title,
			}));
			let remainingIndexLength = 0;

			if (start_index > 0) {
				index = index.slice(start_index);
			}

			if (max_length > 0) {
				const newIndex = index.slice(0, max_length);
				if (newIndex !== index) {
					remainingIndexLength = index.length - newIndex.length;
				}
				index = newIndex;
			}

			if (index.length === 0) {
				logger.warn("No pages found");
				return {
					content: [
						{
							type: "text",
							text: "No pages found",
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text",
						text: stringify({
							index,
							remainingIndexLength,
							startIndex: start_index,
						}),
					},
				],
			};
		},
	);

	/** create server to return the selected page */
	server.tool(
		getDocumentServerName,
		`
	Get page contents belonging to ${url}.
	Before accessing this tool, please call the ${indexServerName} tool first to get the list of pages.
	This tool will return the content of the page from subpath.
	If the content is too long, you can use the \`max_length\` and \`start_index\` parameters to limit the content.
	`,
		{
			subpath: z.string().describe("The subpath of the page to return"),
			max_length: z
				.number()
				.default(maxLength)
				.describe("The max length of the content to return"),
			start_index: z
				.number()
				.default(0)
				.describe("The starting index of content to return"),
		},
		async ({ subpath, start_index, max_length }) => {
			const page = pages.get(subpath);

			if (!page) {
				logger.warn(`Page ${subpath} not found`);
				return {
					content: [
						{
							type: "text",
							text: `Page ${subpath} not found`,
						},
					],
				};
			}

			let { content, title } = page;
			let remainingContentLength = 0;

			if (start_index > 0) {
				content = content?.slice(start_index);
			}

			if (max_length > 0) {
				const newContent = content?.slice(0, max_length);
				if (newContent !== content) {
					remainingContentLength = content.length - newContent.length;
				}
				content = newContent;
			}

			return {
				content: [
					{
						type: "text",
						text: stringify({
							subpath,
							content,
							title,
							remainingContentLength,
							startIndex: start_index,
						}),
					},
				],
			};
		},
	);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	logger.info("MCP Server running on stdio");

	return server;
}
