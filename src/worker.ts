import { parentPort } from "node:worker_threads";
import { fetchSite } from "./fetch-site.ts";
import { logger } from "./logger.ts";
import type { FetchSiteResult, Options } from "./types.ts";

interface WorkerMessage {
	type: "start" | "stop";
	url?: string;
	options?: Options;
}

interface WorkerResponse {
	type: "progress" | "complete" | "error";
	data?: Array<[string, { title: string; url: string; content: string }]>;
	error?: string;
}

class FetchWorker {
	private currentFetch: AbortController | null = null;
	private isRunning = false;

	async start(url: string, options: Options) {
		if (this.isRunning) {
			this.sendMessage({ type: "error", error: "Worker is already running" });
			return;
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

				fetchSite(url, options).then(resolve).catch(reject);
			});

			const pages = await fetchPromise;

			if (this.isRunning) {
				this.sendMessage({
					type: "complete",
					data: Array.from(pages.entries()),
				});
			}
		} catch (error) {
			if (this.isRunning) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				logger.warn(`Worker: Fetch failed: ${errorMessage}`);
				this.sendMessage({
					type: "error",
					error: errorMessage,
				});
			}
		} finally {
			this.isRunning = false;
			this.currentFetch = null;
		}
	}

	stop() {
		if (this.currentFetch) {
			this.currentFetch.abort();
		}
		this.isRunning = false;
	}

	private sendMessage(message: WorkerResponse) {
		if (parentPort) {
			parentPort.postMessage(message);
		}
	}
}

const worker = new FetchWorker();

if (parentPort) {
	parentPort.on("message", (message: WorkerMessage) => {
		switch (message.type) {
			case "start":
				if (message.url && message.options) {
					worker.start(message.url, message.options);
				}
				break;
			case "stop":
				worker.stop();
				break;
		}
	});
}
