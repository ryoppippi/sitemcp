import { Command, Option } from "commander";
import { description, name, version } from "../package.json";
import { startServer } from "./server.ts";
import { TOOL_NAME_STRATEGIES, type ToolNameStrategy } from "./types.ts";

const program = new Command();

program
	.name(name)
	.description(description)
	.version(version)
	.argument("<url>", "The URL to fetch")
	.option(
		"-c, --concurrency <number>",
		"Number of concurrent requests",
		"3",
	)
	.option("-m, --match <value...>", "Only fetch matched pages")
	.option(
		"--content-selector <string>",
		"The CSS selector to find content",
	)
	.option("--limit <number>", "Limit the result to this amount of pages")
	.option('--no-cache', 'Disable cache (default: cache is enabled)')
	// .option(
	// 	"-t, --tool-name-strategy <value>",
	// 	"Tool name strategy",
	// 	"domain",
	// ).choices(['domain', 'fqdn', 'subdomain']) // Using TOOL_NAME_STRATEGIES in the new way
	.option(
		"-l, --max-length <number>",
		"Maximum length of the content to return",
		"2000",
	);

const toolNameStrategyOption = new Option('-t, --tool-name-strategy <value>', 'Tool name strategy')
  .default('domain')
  .choices(TOOL_NAME_STRATEGIES);
program.addOption(toolNameStrategyOption);

program.addHelpText(
		"after",
		`
Examples:
  # Basic usage
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
  $ sitemcp https://ryoppippi.com --no-cache`,
	)
	.action(
		async (
			url: string,
			options: {
				concurrency: string;
				match?: string[];
				contentSelector?: string;
				limit?: string;
				cache?: boolean; // Changed from noCache to cache, as per Commander's --no-flag behavior
				toolNameStrategy: string;
				maxLength: string;
			},
		) => {
			const {
				concurrency,
				match,
				contentSelector,
				limit,
				cache, // Changed from noCache to cache
				toolNameStrategy,
				maxLength,
			} = options;

			// Validate toolNameStrategy
			if (
				toolNameStrategy &&
				!TOOL_NAME_STRATEGIES.includes(toolNameStrategy as ToolNameStrategy)
			) {
				console.error(
					`error: Option --tool-name-strategy has invalid value ${toolNameStrategy}`,
				);
				process.exit(1);
			}
			await startServer({
				url,
				concurrency: Number.parseInt(concurrency, 10),
				match: match ?? [],
				contentSelector,
				limit: limit ? Number.parseInt(limit, 10) : undefined,
				cache: cache, // Directly use options.cache
				toolNameStrategy: toolNameStrategy as ToolNameStrategy,
				maxLength: Number.parseInt(maxLength, 10),
			});
		},
	);

await program.parseAsync(process.argv);
