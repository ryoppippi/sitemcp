import * as fs from 'node:fs'
import * as path from 'node:path'
import { cac } from "cac"
import { fetchSite } from "./index.ts"
import { logger } from "./logger.ts"
import { cacheDirectory, ensureArray, sanitizeToolName, sanitizeUrl } from "./utils.ts"
import { version } from "../package.json"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { FetchSiteResult } from "./types.ts"

const cli = cac("sitemcp")

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
    const cacheFile = path.join(catchDir, `${sanitizedUrl}.json`)

    let pages: FetchSiteResult | undefined = undefined

    if(flags.noCache !== true) {
      // check if cache exists
      if (fs.existsSync(cacheFile)) {
        logger.info("Using cache file", cacheFile)
        const json = fs.readFileSync(cacheFile, "utf-8")
        try {
          pages = new Map(Object.entries(JSON.parse(json)))
        } catch (e) {
          logger.warn("Cache file is invalid, ignoring")
          pages = undefined
        }
      }
    }

    if (pages == null) {
      pages = await fetchSite(url, {
        concurrency: flags.concurrency,
        match: flags.match && ensureArray(flags.match),
        contentSelector: flags.contentSelector,
        limit: flags.limit,
      })
    }

    if (pages.size === 0) {
      logger.warn("No pages found")
      return
    }

    if (flags.noCache !== true) {
      // create cache dir if not exists
      if (!fs.existsSync(catchDir)) {
        fs.promises.mkdir(catchDir, { recursive: true })
      }
      // write to cache file
      const json = JSON.stringify(Object.fromEntries(pages), null, 2)
      await fs.promises.writeFile(cacheFile, json, "utf-8")
      logger.info("Cache file written to", cacheFile)
    }

    for(const page of pages.values()) {
      const name = sanitizeToolName(page.url)
      const description = `get page content: ${page.title}` as const

      logger.info(`Registering tool ${name} (${description})`)

      server.tool(
        name,
        description,
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
  logger.info("MCP Server running on stdio");
 })

cli.version(version)
cli.help()
cli.parse()
