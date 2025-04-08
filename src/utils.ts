import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";
import micromatch from "micromatch";
import * as ufo from "ufo";

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

export function sanitizeUrl(url: string): string {
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

export function sanitizeToolName(name: string): string {
	// Remove common URL prefixes and invalid characters
	return `getDocumentOf-${name}`
		.replace(/^https?:\/\//, "") // Remove http:// or https://
		.replace(/[^a-zA-Z0-9_-]/g, "_") // Replace invalid chars with underscore
		.substring(0, 64); // Limit to 64 characters
}
