import * as fs from "node:fs";
import * as path from "node:path";
import { Worker } from "node:worker_threads";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { stringify } from "@std/yaml";
import { z } from "zod";
import { version } from "../package.json";
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

	let pages: FetchSiteResult = new Map();
	let isFetching = false;
	let fetchingPromise: Promise<void> | null = null;
	let worker: Worker | null = null;

	// Load from cache if available
	if (cache && fs.existsSync(cacheFile)) {
		logger.info("Using cache file", cacheFile);
		const json = fs.readFileSync(cacheFile, "utf-8");
		try {
			pages = new Map(Object.entries(JSON.parse(json)));
			logger.info(`Loaded ${pages.size} pages from cache`);
		} catch (e) {
			logger.warn("Cache file is invalid, ignoring");
			pages = new Map();
		}
	}

	// Start background fetching (don't wait for completion)
	const startBackgroundFetching = async () => {
		if (isFetching) return fetchingPromise;

		isFetching = true;
		fetchingPromise = (async () => {
			try {
				const timeoutMs = (timeout ?? 60) * 1000;

				// Create worker for background fetching
				const isDev = import.meta.dirname.includes("src");
				const workerFile = isDev ? "worker.ts" : "worker.mjs";
				const workerPath = path.join(import.meta.dirname, workerFile);
				worker = new Worker(workerPath);

				const workerPromise = new Promise<FetchSiteResult>(
					(resolve, reject) => {
						worker?.on("message", (message) => {
							switch (message.type) {
								case "complete":
									resolve(new Map(message.data));
									break;
								case "error":
									reject(new Error(message.error));
									break;
								case "progress":
									// Handle progress updates if needed
									break;
							}
						});

						worker?.on("error", reject);
						worker?.on("exit", (code) => {
							if (code !== 0) {
								reject(new Error(`Worker stopped with exit code ${code}`));
							}
						});
					},
				);

				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => {
						worker?.terminate();
						reject(
							new Error(
								`Site fetching timed out after ${timeout ?? 60} seconds`,
							),
						);
					}, timeoutMs);
				});

				// Start worker
				worker.postMessage({
					type: "start",
					url,
					options: {
						concurrency,
						match: (match && ensureArray(match)) as string[],
						contentSelector,
						limit,
						sitemap,
						timeout,
					},
				});

				const freshPages = await Promise.race([workerPromise, timeoutPromise]);

				// Merge fresh pages with existing pages
				for (const [key, value] of freshPages) {
					pages.set(key, value);
				}

				if (cache) {
					// create cache dir if not exists
					if (!fs.existsSync(catchDir)) {
						await fs.promises.mkdir(catchDir, { recursive: true });
					}
					// write to cache file
					const json = JSON.stringify(Object.fromEntries(pages), null, 2);
					await fs.promises.writeFile(cacheFile, json, "utf-8");
					logger.info("Cache file written to", cacheFile);
				}

				logger.info(
					`Background fetching completed. Total pages: ${pages.size}`,
				);
			} catch (error) {
				logger.warn(
					`Background site fetching failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			} finally {
				// Clean up worker
				if (worker) {
					worker.terminate();
					worker = null;
				}
				isFetching = false;
				fetchingPromise = null;
			}
		})();

		return fetchingPromise;
	};

	// Start background fetching but don't wait for it
	startBackgroundFetching().catch(() => {
		// Error already logged in startBackgroundFetching
	});

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

			const status = isFetching ? "fetching" : "ready";

			if (index.length === 0) {
				const message = isFetching
					? "Site is being fetched in the background. Please try again in a moment."
					: "No pages found";
				logger.warn(message);
				return {
					content: [
						{
							type: "text",
							text: stringify({
								status,
								message,
								totalPages: pages.size,
							}),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text",
						text: stringify({
							status,
							index,
							remainingIndexLength,
							startIndex: start_index,
							totalPages: pages.size,
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
				const status = isFetching ? "fetching" : "ready";
				const message = isFetching
					? `Page ${subpath} is being fetched in the background. Please try again in a moment.`
					: `Page ${subpath} not found`;

				// If we're not fetching and the page doesn't exist, trigger background fetch
				if (!isFetching) {
					logger.info(
						`Triggering background fetch for missing page: ${subpath}`,
					);
					startBackgroundFetching().catch(() => {
						// Error already logged in startBackgroundFetching
					});
				}

				logger.warn(message);
				return {
					content: [
						{
							type: "text",
							text: stringify({
								status,
								message,
								subpath,
								totalPages: pages.size,
							}),
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
