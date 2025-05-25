# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `bun install` - Install dependencies
- `bun run build` - Build the project using tsdown, outputs to dist/
- `bun run lint` - Run Biome linter and formatter
- `bun run typecheck` - Run TypeScript type checking using tsgo
- `bun test` - Run unit tests
- `bun release` - Full release process: lint, typecheck, test, build, and version bump

### Running the MCP Server
- `bunx . [url]` - Run the MCP server for a specific URL
- Example: `bunx . https://example.com --concurrency 5 --match "/**" --cache`

## Architecture

This is a Model Context Protocol (MCP) server that fetches websites and exposes them as tools for AI assistants.

### Core Components

1. **MCP Server (`server.ts`)**: Creates dynamic tools based on the fetched site:
   - `indexOf{SiteName}` - Returns paginated list of all pages
   - `getDocumentOf{SiteName}` - Returns content of specific pages
   - Uses YAML format for responses
   - Implements file-based caching in `~/.cache/sitemcp`

2. **Site Fetcher (`fetch-site.ts`)**: Queue-based concurrent web crawler:
   - Uses Cheerio for link extraction
   - Uses Happy DOM + Readability for content extraction
   - Respects match patterns and same-origin policy
   - Handles redirects and non-HTML content gracefully

3. **CLI (`cli.ts`)**: Command-line interface using gunshi framework
   - Validates inputs and configures the server
   - Supports options for concurrency, caching, content selectors, etc.

### Key Technical Decisions

- **Content Extraction**: Uses Mozilla's Readability library to extract article content intelligently
- **Concurrent Fetching**: Queue-based system with configurable concurrency (default: 3)
- **Tool Naming**: Dynamic tool names generated from site URL (domain/subdomain/pathname strategies)
- **Response Format**: YAML for better readability in AI contexts
- **Logging**: Custom logger outputs to stderr (stdout reserved for MCP protocol)

### Testing Strategy

Tests use Bun's built-in test runner and focus on utility functions. Run individual tests with:
- `bun test utils.test.ts` - Run specific test file
- `bun test -t "test name"` - Run tests matching pattern