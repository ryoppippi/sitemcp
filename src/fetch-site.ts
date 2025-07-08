import { Readability } from "@mozilla/readability";
import { load } from "cheerio";
import { Window } from "happy-dom";
import Queue from "p-queue";
import c from "picocolors";
import { logger } from "./logger.ts";
import { toMarkdown } from "./to-markdown.ts";
import type { FetchSiteResult, Options } from "./types.ts";
import { matchPath } from "./utils.ts";

export async function fetchSite(
	url: string,
	options: Options,
): Promise<FetchSiteResult> {
	const fetcher = new Fetcher(options);

	return fetcher.fetchSite(url);
}

class Fetcher {
	#pages: FetchSiteResult = new Map();
	#fetched: Set<string> = new Set();
	#queue: Queue;
	#startTime = 0;
	#globalTimeoutMs: number;
	options: Options;

	constructor(options: Options) {
		const concurrency = options.concurrency || 3;
		this.#queue = new Queue({ concurrency });
		this.options = options;
		this.#globalTimeoutMs = (options.timeout || 60) * 1000; // default 60 seconds
	}

	#limitReached() {
		return this.options.limit && this.#pages.size >= this.options.limit;
	}

	#shouldTerminateEarly() {
		const elapsed = Date.now() - this.#startTime;
		return elapsed >= this.#globalTimeoutMs;
	}

	#getContentSelector(pathname: string) {
		if (typeof this.options.contentSelector === "function")
			return this.options.contentSelector({ pathname });

		return this.options.contentSelector;
	}

	async #fetchFromSitemap(baseUrl: string) {
		const { host } = new URL(baseUrl);
		const sitemapUrls = await this.#discoverSitemapUrls(baseUrl);

		logger.info(`Found ${sitemapUrls.length} sitemap(s) to process`);

		for (const sitemapUrl of sitemapUrls) {
			try {
				const urls = await this.#parseSitemap(sitemapUrl);
				logger.info(`Extracted ${urls.length} URLs from ${sitemapUrl}`);

				for (const url of urls) {
					// Only process URLs from the same host
					try {
						const urlObj = new URL(url);
						if (urlObj.host === host) {
							this.#queue.add(() => this.#fetchPage(url, { skipMatch: false }));
						}
					} catch {
						logger.warn(`Invalid URL from sitemap: ${url}`);
					}
				}
			} catch (error) {
				logger.warn(`Failed to parse sitemap ${sitemapUrl}: ${error}`);
			}
		}
	}

	async #discoverSitemapUrls(baseUrl: string): Promise<string[]> {
		const sitemapUrls: string[] = [];
		const { origin } = new URL(baseUrl);

		// If sitemap is a custom URL, use it directly
		if (typeof this.options.sitemap === "string") {
			const customSitemapUrl = new URL(this.options.sitemap, origin).href;
			sitemapUrls.push(customSitemapUrl);
			return sitemapUrls;
		}

		// Try common sitemap locations
		const commonSitemapPaths = ["/sitemap.xml", "/sitemap_index.xml"];

		for (const path of commonSitemapPaths) {
			const sitemapUrl = `${origin}${path}`;
			try {
				const res = await (this.options.fetch || fetch)(sitemapUrl, {
					headers: {
						"user-agent": "SiteMCP (https://github.com/ryoppippi/sitemcp)",
					},
				});

				if (res.ok && res.headers.get("content-type")?.includes("xml")) {
					sitemapUrls.push(sitemapUrl);
					logger.info(`Found sitemap at ${sitemapUrl}`);
				}
			} catch {
				// Ignore errors for sitemap discovery
			}
		}

		// Check robots.txt for sitemap references only if no sitemaps found in common locations
		if (sitemapUrls.length === 0) {
			try {
				const robotsUrl = `${origin}/robots.txt`;
				const robotsRes = await (this.options.fetch || fetch)(robotsUrl, {
					headers: {
						"user-agent": "SiteMCP (https://github.com/ryoppippi/sitemcp)",
					},
				});

				if (robotsRes.ok) {
					const robotsText = await robotsRes.text();
					const sitemapMatches = robotsText.match(/^sitemap:\s*(.+)$/gim);

					if (sitemapMatches) {
						for (const match of sitemapMatches) {
							const sitemapUrl = match.replace(/^sitemap:\s*/i, "").trim();
							if (sitemapUrl && !sitemapUrls.includes(sitemapUrl)) {
								sitemapUrls.push(sitemapUrl);
								logger.info(`Found sitemap in robots.txt: ${sitemapUrl}`);
							}
						}
					}
				}
			} catch {
				// Ignore robots.txt errors
			}
		}

		return sitemapUrls;
	}

	async #parseSitemap(sitemapUrl: string): Promise<string[]> {
		const urls: string[] = [];

		try {
			const res = await (this.options.fetch || fetch)(sitemapUrl, {
				headers: {
					"user-agent": "SiteMCP (https://github.com/ryoppippi/sitemcp)",
				},
			});

			if (!res.ok) {
				throw new Error(`Failed to fetch sitemap: ${res.statusText}`);
			}

			const xmlContent = await res.text();
			const $ = load(xmlContent, { xmlMode: true });

			// Check if this is a sitemap index
			if ($("sitemapindex").length > 0) {
				// This is a sitemap index, parse sub-sitemaps
				$("sitemap loc").each((_, el) => {
					const loc = $(el).text().trim();
					if (loc) {
						urls.push(loc);
					}
				});

				// Recursively parse sub-sitemaps
				const subSitemapUrls: string[] = [];
				for (const subSitemapUrl of urls) {
					try {
						const subUrls = await this.#parseSitemap(subSitemapUrl);
						subSitemapUrls.push(...subUrls);
					} catch (error) {
						logger.warn(
							`Failed to parse sub-sitemap ${subSitemapUrl}: ${error}`,
						);
					}
				}

				return subSitemapUrls;
			}
			// This is a regular sitemap
			$("url loc").each((_, el) => {
				const loc = $(el).text().trim();
				if (loc) {
					// Apply pattern matching if match patterns are specified
					if (this.options.match && this.options.match.length > 0) {
						try {
							const urlObj = new URL(loc);
							if (matchPath(urlObj.pathname, this.options.match)) {
								urls.push(loc);
							}
						} catch {
							// Skip invalid URLs
						}
					} else {
						urls.push(loc);
					}
				}
			});
		} catch (error) {
			logger.warn(`Error parsing sitemap ${sitemapUrl}: ${error}`);
		}

		return urls;
	}

	async fetchSite(url: string) {
		this.#startTime = Date.now();
		logger.info(
			`Started fetching ${c.green(url)} with a concurrency of ${this.#queue.concurrency}`,
		);

		// Try to fetch from sitemap first if enabled
		if (this.options.sitemap && !this.#shouldTerminateEarly()) {
			await this.#fetchFromSitemap(url);
		}

		if (!this.#shouldTerminateEarly()) {
			await this.#fetchPage(url, {
				skipMatch: true,
			});
		}

		// Wait for queue to empty or timeout
		const maxWaitTime = Math.max(
			0,
			this.#globalTimeoutMs - (Date.now() - this.#startTime),
		);

		if (maxWaitTime > 0) {
			await Promise.race([
				this.#queue.onIdle(),
				new Promise((resolve) => setTimeout(resolve, maxWaitTime)),
			]);
		}

		if (this.#shouldTerminateEarly()) {
			logger.warn(
				`Fetching terminated early after ${this.#globalTimeoutMs}ms. Fetched ${this.#pages.size} pages.`,
			);
		}

		return this.#pages;
	}

	async #fetchPage(
		url: string,
		options: {
			skipMatch?: boolean;
		},
	) {
		const { host, pathname } = new URL(url);

		if (
			this.#fetched.has(pathname) ||
			this.#limitReached() ||
			this.#shouldTerminateEarly()
		) {
			return;
		}

		this.#fetched.add(pathname);

		// return if not matched
		// we don't need to extract content for this page
		if (
			!options.skipMatch &&
			this.options.match &&
			this.options.match.length > 0 &&
			!matchPath(pathname, this.options.match)
		) {
			return;
		}

		logger.info(`Fetching ${c.green(url)}`);

		// Add timeout to prevent hanging on slow pages - use shorter timeout for faster processing
		const controller = new AbortController();
		const remainingTime = Math.max(
			5000,
			Math.max(0, this.#globalTimeoutMs - (Date.now() - this.#startTime)),
		);
		const pageTimeout = Math.min(15000, remainingTime); // Max 15 seconds per page
		const timeoutId = setTimeout(() => controller.abort(), pageTimeout);

		let res: Response;
		try {
			res = await (this.options.fetch || fetch)(url, {
				headers: {
					"user-agent": "SiteMCP (https://github.com/ryoppippi/sitemcp)",
				},
				signal: controller.signal,
			});
			clearTimeout(timeoutId);

			if (!res.ok) {
				logger.warn(`Failed to fetch ${url}: ${res.statusText}`);
				return;
			}
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === "AbortError") {
				logger.warn(`Timeout fetching ${url}`);
			} else {
				logger.warn(
					`Failed to fetch ${url}: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
			return;
		}

		if (this.#limitReached() || this.#shouldTerminateEarly()) {
			return;
		}

		const contentType = res.headers.get("content-type");

		if (!contentType?.includes("text/html")) {
			logger.warn(`Not a HTML page: ${url}`);
			return;
		}

		const resUrl = new URL(res.url);

		// redirected to other site, ignore
		if (resUrl.host !== host) {
			logger.warn(`Redirected from ${host} to ${resUrl.host}`);
			return;
		}
		const extraUrls: string[] = [];

		const $ = load(await res.text());
		$("script,style,link,img,video").remove();

		// Only process links if we have time remaining
		if (!this.#shouldTerminateEarly()) {
			$("a").each((_, el) => {
				const href = $(el).attr("href");

				if (!href) {
					return;
				}

				try {
					const thisUrl = new URL(href, url);
					if (thisUrl.host !== host) {
						return;
					}

					extraUrls.push(thisUrl.href);
				} catch {
					logger.warn(`Failed to parse URL: ${href}`);
				}
			});

			if (extraUrls.length > 0 && !this.#shouldTerminateEarly()) {
				for (const url of extraUrls) {
					this.#queue.add(() =>
						this.#fetchPage(url, { ...options, skipMatch: false }),
					);
				}
			}
		}

		// Skip content processing if we're running out of time
		if (this.#shouldTerminateEarly()) {
			logger.info(`Skipping content processing for ${pathname} due to timeout`);
			return;
		}

		const window = new Window({
			url,
			settings: {
				disableJavaScriptFileLoading: true,
				disableJavaScriptEvaluation: true,
				disableCSSFileLoading: true,
			},
		});

		const pageTitle = $("title").text();
		const contentSelector = this.#getContentSelector(pathname);
		const html = contentSelector
			? $(contentSelector).prop("outerHTML")
			: $.html();

		if (!html) {
			logger.warn(`No readable content on ${pathname}`);
			return;
		}

		window.document.write(html);

		await window.happyDOM.waitUntilComplete();

		const article = new Readability(window.document as unknown).parse();

		await window.happyDOM.close();

		if (!article) {
			return;
		}

		// Final check before processing content
		if (this.#shouldTerminateEarly()) {
			logger.info(`Skipping content conversion for ${pathname} due to timeout`);
			return;
		}

		const content = toMarkdown(article.content);

		this.#pages.set(pathname, {
			title: article.title || pageTitle,
			url,
			content,
		});
	}
}
