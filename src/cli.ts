import * as fs from 'node:fs'
import * as path from 'node:path'
import { cac } from "cac"
import { fetchSite } from "./index.ts"
import { logger } from "./logger.ts"
import { cacheDirectory, ensureArray, sanitizeUrl } from "./utils.ts"
import { version } from "../package.json"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { FetchSiteResult } from "./types.ts"

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
  .option("--no-cache", "Do not use cache")
  .action(async (url, flags) => {
    if (!url) {
      cli.outputHelp()
      return
    }

    // create server instance
    const server = new McpServer({
      name: `mcp server for ${url}`,
      version,
    });

    // use console.error because stdout cannot be used in MCP server
    logger.setLevel("warn")

    const sanitizedUrl = sanitizeUrl(url)
    const catchDir = cacheDirectory();

    let pages: FetchSiteResult | undefined = undefined

    if(!flags.noCache) {
      // check if cache exists
      const cacheFile = path.join(catchDir, `${sanitizedUrl}.json`)
      if (fs.existsSync(cacheFile)) {
        logger.info("Using cache file", cacheFile)
        pages = JSON.parse(fs.readFileSync(cacheFile, "utf-8"))
      }
    }

    if (!pages) {
      pages = await fetchSite(url, {
        concurrency: flags.concurrency,
        match: flags.match && ensureArray(flags.match),
        contentSelector: flags.contentSelector,
        limit: flags.limit,
      })
    }

    if (!flags.noCache) {
      // create cache dir if not exists
      if (!fs.existsSync(catchDir)) {
        fs.mkdirSync(catchDir, { recursive: true })
      }
      // write to cache file
      const cacheFile = path.join(catchDir, `${sanitizedUrl}.json`)
      fs.writeFileSync(cacheFile, JSON.stringify(pages, null, 2))
      logger.info("Cache file written to", cacheFile)
    }

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
