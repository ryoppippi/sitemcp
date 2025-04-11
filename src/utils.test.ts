import { expect, test } from "bun:test";

import {
	getDomain,
	getPathname,
	getSubdomain,
	sanitiseToolName,
} from "./utils";

test("getSubdomain", () => {
	expect(getSubdomain("https://feature-sliced.github.io/documentation/")).toBe(
		"feature-sliced",
	);
	expect(getSubdomain("https://github.io/documentation/")).toBeUndefined();
});

test("getDomain", () => {
	expect(getDomain("https://feature-sliced.github.io/documentation/")).toBe(
		"github",
	);
	expect(getDomain("https://github.io/documentation/")).toBe("github");
});

test("getPathname", () => {
	expect(getPathname("https://feature-sliced.github.io/documentation/")).toBe(
		"documentation",
	);
	expect(getPathname("https://github.io/documentation/")).toBe("documentation");
});

test("sanitiseToolName", () => {
	expect(
		sanitiseToolName(
			"https://feature-sliced.github.io/documentation/",
			"subdomain",
		),
	).toBe("FeatureSliced");
	expect(
		sanitiseToolName(
			"https://feature-sliced.github.io/documentation/",
			"domain",
		),
	).toBe("Github");
	expect(
		sanitiseToolName(
			"https://feature-sliced.github.io/documentation/",
			"pathname",
		),
	).toBe("Documentation");
});
