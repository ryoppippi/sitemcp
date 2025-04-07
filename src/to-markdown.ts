import Turndown from "turndown";
import { gfm } from "turndown-plugin-gfm";

const turndown = new Turndown();
turndown.use(gfm);

export function toMarkdown(html: string): string {
	return turndown.turndown(html);
}
