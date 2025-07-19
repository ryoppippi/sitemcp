import { parentPort } from "node:worker_threads";
import { createBirpc } from "birpc";
import { fetchSite } from "./fetch-site.ts";
import { logger } from "./logger.ts";
import type { FetchSiteResult, Options } from "./types.ts";

class FetchWorker {
	private currentFetch: AbortController | null = null;
	private isRunning = false;

	async startFetch(
		url: string,
		options: Options,
	): Promise<Array<[string, { title: string; url: string; content: string }]>> {
		if (this.isRunning) {
			throw new Error("Worker is already running");
		}

		this.isRunning = true;
		this.currentFetch = new AbortController();

		try {
			logger.info(`Worker: Starting fetch for ${url}`);

			// Create a promise that can be aborted
			const fetchPromise = new Promise<FetchSiteResult>((resolve, reject) => {
				const signal = this.currentFetch?.signal;

				signal?.addEventListener("abort", () => {
					reject(new Error("Fetch aborted"));
				});

				// Pass the abort signal to fetchSite
				const optionsWithSignal = { ...options, signal };
				fetchSite(url, optionsWithSignal).then(resolve).catch(reject);
			});

			const pages = await fetchPromise;
			return Array.from(pages.entries());
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logger.warn(`Worker: Fetch failed: ${errorMessage}`);
			throw error;
		} finally {
			this.isRunning = false;
			this.currentFetch = null;
		}
	}

	abortFetch() {
		if (this.currentFetch) {
			this.currentFetch.abort();
		}
		this.isRunning = false;
	}
}

const worker = new FetchWorker();

// Create birpc instance for worker side
if (parentPort) {
	createBirpc(
		{
			startFetch: worker.startFetch.bind(worker),
			abortFetch: worker.abortFetch.bind(worker),
		},
		{
			post: (data) => parentPort?.postMessage(data),
			on: (fn) => parentPort?.on("message", fn),
		},
	);
}
