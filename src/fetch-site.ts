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
	options: Options;

	constructor(options: Options) {
		const concurrency = options.concurrency || 3;
		this.#queue = new Queue({ concurrency });
		this.options = options;
	}

	#limitReached() {
		return this.options.limit && this.#pages.size >= this.options.limit;
	}

	#getContentSelector(pathname: string) {
		if (typeof this.options.contentSelector === "function")
			return this.options.contentSelector({ pathname });

		return this.options.contentSelector;
	}

	async fetchSite(url: string) {
		logger.info(
			`Started fetching ${c.green(url)} with a concurrency of ${
				this.#queue.concurrency
			}`,
		);

		await this.#fetchPage(url, {
			skipMatch: true,
		});

		await this.#queue.onIdle();

		return this.#pages;
	}

	async #fetchPage(
		url: string,
		options: {
			skipMatch?: boolean;
		},
	) {
		const { host, pathname } = new URL(url);

		if (this.#fetched.has(pathname) || this.#limitReached()) {
			return;
		}

		this.#fetched.add(pathname);

		// return if not matched
		// we don't need to extract content for this page
		if (
			!options.skipMatch &&
			this.options.match != null &&
			this.options.match.length > 0 &&
			!matchPath(pathname, this.options.match)
		) {
			return;
		}

		logger.info(`Fetching ${c.green(url)}`);

		const res = await (this.options.fetch || fetch)(url, {
			headers: {
				"user-agent": "SiteMCP (https://github.com/ryoppippi/sitemcp)",
			},
		});

		if (!res.ok) {
			logger.warn(`Failed to fetch ${url}: ${res.statusText}`);
			return;
		}

		if (this.#limitReached()) {
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

		if (extraUrls.length > 0) {
			for (const url of extraUrls) {
				this.#queue.add(() =>
					this.#fetchPage(url, { ...options, skipMatch: false }),
				);
			}
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

		const content = toMarkdown(article.content);

		this.#pages.set(pathname, {
			title: article.title || pageTitle,
			url,
			content,
		});
	}
}
