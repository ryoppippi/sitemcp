import { cac } from "cac"
import { fetchSite } from "./index.ts"
import { logger } from "./logger.ts"
import { ensureArray } from "./utils.ts"
import { version } from "../package.json"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const cli = cac("sitemcp")

cli
  .command("[url]", "Fetch a site")
  .option("-o, --outfile <path>", "Write the fetched site to a text file")
  .option("--concurrency <number>", "Number of concurrent requests", {
    default: 3,
  })
  .option("-m, --match <pattern>", "Only fetch matched pages")
  .option("--content-selector <selector>", "The CSS selector to find content")
  .option("--limit <limit>", "Limit the result to this amount of pages")
  .option("--silent", "Do not print any logs")
  .action(async (url, flags) => {
    if (!url) {
      cli.outputHelp()
      return
    }

    // use console.error because stdout cannot be used in MCP server
    logger.setLevel("warn")

    const pages = await fetchSite(url, {
      concurrency: flags.concurrency,
      match: flags.match && ensureArray(flags.match),
      contentSelector: flags.contentSelector,
      limit: flags.limit,
    })


    // create server instance
    const server = new McpServer({
      name: `mcp server for ${url}`,
      version,
    });

    if (pages.size === 0) {
      logger.warn("No pages found")
      return
    }

    for(const page of pages.values()) {
      server.tool(
        `getDocumentOf-${page.url}`,
        `get page content: ${page.title}`,
        async () => {
          return {
            content:[
              {
                type: "text",
                text: page.content,
              }
            ]
          }
        },
    )
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
 })

cli.version(version)
cli.help()
cli.parse()
