export type Options = {
	/** How many requests can be made at the same time */
	concurrency?: number;

	/**
	 * Match pathname by specific patterns, powered by micromatch
	 * Only pages matched by this will be fetched
	 */
	match?: string[];

	/**
	 * The CSS selector to find content
	 */
	contentSelector?:
		| string
		| ((ctx: { pathname: string }) => string | undefined | undefined);

	/**
	 * Limit the result to this amount of pages
	 */
	limit?: number;

	/**
	 * A custom function to fetch URL
	 */
	fetch?: (url: string, init: RequestInit) => Promise<Response>;

	/**
	 * Use sitemap.xml to discover URLs
	 * Can be boolean (auto-detect) or string (custom sitemap URL)
	 */
	sitemap?: boolean | string;

	/**
	 * Timeout in seconds for site fetching
	 */
	timeout?: number;

	/**
	 * Abort signal for cancelling fetch operations
	 */
	signal?: AbortSignal;
};

export type Page = {
	title: string;
	url: string;
	content: string;
};

export type FetchSiteResult = Map<string, Page>;

export const TOOL_NAME_STRATEGIES = [
	"subdomain",
	"domain",
	"pathname",
] as const;
export type ToolNameStrategy = (typeof TOOL_NAME_STRATEGIES)[number];

export interface StartServerOptions {
	url: string;
	concurrency: number;
	contentSelector?: string;
	cache: boolean;
	toolNameStrategy: ToolNameStrategy;
	maxLength: number;
	match?: string | string[];
	limit?: number;
	sitemap?: boolean | string;
	timeout?: number;
}
