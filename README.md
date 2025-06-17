# SiteMCP

[![npm version](https://img.shields.io/npm/v/sitemcp?color=yellow)](https://npmjs.com/package/sitemcp)
[![NPM Downloads](https://img.shields.io/npm/dy/sitemcp)](https://tanstack.com/stats/npm?packageGroups=%5B%7B%22packages%22:%5B%7B%22name%22:%22sitemcp%22%7D%5D%7D%5D&range=30-days&transform=none&binType=daily&showDataMode=all&height=400)

[![DeepWiki](https://img.shields.io/badge/DeepWiki-ryoppippi%2Fsitemcp-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/ryoppippi/sitemcp)

Fetch an entire site and use it as an MCP Server

https://github.com/user-attachments/assets/ebe2d7c6-4ddc-4a37-8e1e-d80fac49d8ae

<details>
  <summary><bold>Demo in Japanese</bold></summary>

https://github.com/user-attachments/assets/24288140-be2a-416c-9e7c-c49be056a373

</details>


> [!NOTE]
> `sitemcp` is a fork of [`sitefetch`](https://github.com/egoist/sitefetch) by [@egoist](https://github.com/egoist)

## Install

One-off usage (choose one of the followings):

```bash
bunx sitemcp
npx sitemcp
pnpx sitemcp
```

Install globally (choose one of the followings):

```bash
bun i -g sitemcp
npm i -g sitemcp
pnpm i -g sitemcp
```

## Usage

```bash
sitemcp https://daisyui.com

# or better concurrency
sitemcp https://daisyui.com --concurrency 10
```

### Tool Name Strategy

Use `-t, --tool-name-strategy` to specify the tool name strategy, it will be used as the MCP server name (default: `domain`).
This will be used as the MCP server name.

```bash
sitemcp https://vite.dev -t domain # indexOfVite / getDocumentOfVite
sitemcp https://react-tweet.vercel.app/ -t subdomain # indexOfReactTweet / getDocumentOfReactTweet
sitemcp https://ryoppippi.github.io/vite-plugin-favicons/ -t pathname # indexOfVitePluginFavicons / getDocumentOfVitePluginFavicons
```

### Max Length of Content

Use `-l, --max-length` to specify the max length of content, default is `2000` characters.
This is useful for sites with long content, such as blogs or documentation.
The acceptable content length depends on the MCP client you are using, so please check the documentation of your MCP client for more details.
Also welcome to open an issue if you have any questions.

```bash
sitemcp https://vite.dev -l 10000
```

### Match specific pages

Use the `-m, --match` flag to specify the pages you want to fetch:

```bash
sitemcp https://vite.dev -m "/blog/**" -m "/guide/**"
```

The match pattern is tested against the pathname of target pages, powered by micromatch, you can check out all the supported [matching features](https://github.com/micromatch/micromatch#matching-features).

### Content selector

We use [mozilla/readability](https://github.com/mozilla/readability) to extract readable content from the web page, but on some pages it might return irrelevant contents, in this case you can specify a CSS selector so we know where to find the readable content:

```sitemcp
sitemcp https://vite.dev --content-selector ".content"
```

## How to configure with MCP Client

You can execute server from your MCP client (e.g. Claude Desktop).

The below example configuration for Claude Desktop

```json
{
  "mcpServers": {
    "daisy-ui": {
      "command": "npx",
      "args": [
        "-y",
        "sitemcp",
        "https://daisyui.com",
        "-m",
        "/components/**"
      ]
    }
  }
}

```

## Tips

- Some site has a lot of pages. It is better to run `sitemcp` before registering the server to the MCP client. `sitemcp` caches the pages in `~/.cache/sitemcp` by default. You can disable by `--no-cache` flag.

## License

MIT.

## Sponsors

<!-- spellchecker:disable-line -->
<p align="center">
	<a href="https://github.com/sponsors/ryoppippi">
		<img src="https://cdn.jsdelivr.net/gh/ryoppippi/sponsors/sponsors.svg">
	</a>
</p>

## Stats

<a href="https://www.star-history.com/#ryoppippi/sitemcp&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ryoppippi/sitemcp&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=ryoppippi/sitemcp&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=ryoppippi/sitemcp&type=Date" />
 </picture>
</a>

![Stats by Repobeats](https://repobeats.axiom.co/api/embed/2ad989875810c346a80fa4677ed0154ef94132c3.svg "Repobeats analytics image")

