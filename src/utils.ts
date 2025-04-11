import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";
import pascalCase from "just-pascal-case";
import micromatch from "micromatch";
import * as ufo from "ufo";
import type { ToolNameStrategy } from "./types";

// xK or xM
export function formatNumber(num: number): string {
	return num > 1000000
		? `${(num / 1000000).toFixed(1)}M`
		: num > 1000
			? `${(num / 1000).toFixed(1)}K`
			: num.toString();
}

export function matchPath(path: string, pattern: string | string[]): boolean {
	return micromatch.isMatch(path, pattern);
}

export function ensureArray<T>(input: T | T[]): T[] {
	return Array.isArray(input) ? input : [input];
}

export function cacheDirectory(): string {
	// biome-ignore lint/complexity/useLiteralKeys: <explanation>
	return process.env["XDG_CACHE_HOME"]
		? // biome-ignore lint/complexity/useLiteralKeys: <explanation>
			path.resolve(process.env["XDG_CACHE_HOME"], "sitemcp")
		: path.resolve(os.homedir(), ".cache/sitemcp");
}

export function sanitiseUrl(url: string): string {
	const withoutProtocol = ufo.withoutProtocol(url);

	return (
		withoutProtocol
			// replace all non-alphanumeric characters with a dash
			.replace(/[^a-zA-Z0-9]/g, "-")
			// replace / with a dash
			.replace(/\//g, "-")
			// replace multiple dashes with a single dash
			.replace(/--+/g, "-")
			// remove leading and trailing dashes
			.replace(/^-+|-+$/g, "")
	);
}

/**
 * get subdomain from url
 * @example
 * - https://feature-sliced.github.io/documentation/ => feature-sliced
 */
export function getSubdomain(url: string): string | undefined {
	const { hostname } = new URL(url);
	const parts = hostname.split(".");
	if (parts.length > 2) {
		return parts[0];
	}
	return undefined;
}

/**
 * get domain without subdomain and tld
 * @example
 * - https://feature-sliced.github.io/documentation/ => github
 */
export function getDomain(url: string): string {
	const { hostname } = new URL(url);
	const [tld, ...parts] = hostname.split(".").reverse();
	if (tld == null) {
		throw new Error(`Invalid URL: ${url}`);
	}

	const domain = parts.reverse().at(-1);
	if (!domain) {
		throw new Error(`Invalid URL: ${url}`);
	}
	return domain;
}

/**
 * get pathname from url
 * @example
 * - https://feature-sliced.github.io/documentation/ => documentation
 */
export function getPathname(url: string): string | undefined {
	const { pathname } = new URL(url);
	if (pathname === "/") {
		return undefined;
	}
	return pathname.replaceAll("/", "-").replace(/-/g, " ").trim();
}

export function sanitiseToolName(
	url: string,
	strategy: ToolNameStrategy,
): string {
	let name: string | undefined;
	switch (strategy) {
		case "subdomain":
			name = getSubdomain(url);
			break;
		case "domain":
			name = getDomain(url);
			break;
		case "pathname":
			name = getPathname(url);
			break;
		default:
			throw new Error(`Unknown strategy: ${strategy}`);
	}

	if (!name) {
		throw new Error(`Invalid URL: ${url}`);
	}

	const pascalizedName = pascalCase(name);
	return pascalizedName;
}
