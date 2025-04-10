import cac from "cac";
import { version } from "../package.json";
import { startServer } from "./server.ts";

const cli = cac("sitemcp");

cli
	.command("[url]", "Fetch a site")
	.option("--concurrency <number>", "Number of concurrent requests", {
		default: 3,
	})
	.option("-m, --match <pattern>", "Only fetch matched pages")
	.option("--content-selector <selector>", "The CSS selector to find content")
	.option("--limit <limit>", "Limit the result to this amount of pages")
	.option("--silent", "Do not print any logs")
	.option("--no-cache", "Do not use cache")
	.option(
		"-t, --tool-name-strategy <strategy>",
		"Tool name strategy ('subdomain' | 'domain' | 'pathname') default: 'domain'",
	)
	.option(
		"-l, --max-length <number>",
		"Maximum length of the content to return (default: 2000)",
	)
	.action(async (url, flags) => {
		if (!url) {
			cli.outputHelp();
			return;
		}

		await startServer({
			url,
			...flags,
		});
	});

cli.version(version);
cli.help();
cli.parse();
