import cac from "cac";
import { version } from "../package.json";
import { startServer } from "./server.ts";
import { type StartServerOptions, TOOL_NAME_STRATEGIES } from "./types.ts";

const cli = cac("sitemcp");

cli
	.command("[url]", "Fetch a site")
	.option("--concurrency <number>", "Number of concurrent requests", {
		default: 3,
	})
	.option("-m, --match <pattern>", "Only fetch matched pages")
	.option("--content-selector <selector>", "The CSS selector to find content")
	.option("--limit <limit>", "Limit the result to this amount of pages")
	.option("--no-cache", "Do not use cache")
	.option(
		"-t, --tool-name-strategy <strategy>",
		`Tool name strategy (${TOOL_NAME_STRATEGIES.join(", ")})`,
		{
			default: "domain",
			type: [String],
		},
	)
	.option(
		"-l, --max-length <number>",
		"Maximum length of the content to return",
		{ default: 2000 },
	)
	.action(async (url: string, flags: StartServerOptions) => {
		if (!url) {
			cli.outputHelp();
			return;
		}

		await startServer({
			...flags,
			url,
			cache: flags.cache ?? true, // we can use default option of cac, but science we use `--no` prefix, we don't want to show the user that the default is true. It is misleading.
		});
	});

cli.version(version);
cli.help();
cli.parse();
