import type { RunJob } from "../types/tryon";

const API_KEY = import.meta.env.VITE_STYLESYNCS_API_KEY;
const BASE_URL = import.meta.env.VITE_STYLESYNCS_BASE_URL;

const HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  "X-API-Key": API_KEY ?? "",
};

const assertTryOnConfig = () => {
  if (!API_KEY || !BASE_URL) {
    throw new Error("StyleSyncs configuration missing. Check VITE_STYLESYNCS_API_KEY and VITE_STYLESYNCS_BASE_URL.");
  }
};

// v1 for accessories (bags), v2 for everything else.
export const selectApiVersion = (hasAccessories: boolean): "v1" | "v2" => {
  return hasAccessories ? "v1" : "v2";
};

// Start a try-on job.
export const startTryOnJob = async (
  modelUrl: string,
  outfitPieces: string[],
  hasAccessories: boolean,
  prompt?: string,
): Promise<{ jobId: string; apiVersion: "v1" | "v2" }> => {
  assertTryOnConfig();

  const apiVersion = selectApiVersion(hasAccessories);
  const response = await fetch(`${BASE_URL}/run/${apiVersion}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      model_url: modelUrl,
      outfit_pieces: outfitPieces,
      ...(prompt ? { prompt } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start try-on job: ${response.status} - ${errorText}`);
  }

  const job: RunJob = await response.json();
  if (!job.jobId) {
    throw new Error("No jobId returned from try-on API");
  }

  return {
    jobId: job.jobId,
    apiVersion,
  };
};

// Poll a single job status.
export const pollTryOnJob = async (jobId: string, apiVersion: "v1" | "v2"): Promise<RunJob> => {
  assertTryOnConfig();

  const response = await fetch(`${BASE_URL}/run/${apiVersion}/${jobId}`, {
    method: "GET",
    headers: HEADERS,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to poll job status: ${response.status} - ${errorText}`);
  }

  return (await response.json()) as RunJob;
};

// Full polling loop with callbacks for UI updates.
export const runTryOnWithPolling = async (
  modelUrl: string,
  outfitPieces: string[],
  hasAccessories: boolean,
  prompt: string | undefined,
  callbacks: {
    onProgress: (progress: number) => void;
    onRetry: (count: number, reason: string | null) => void;
    onComplete: (resultImage: string, compositeImage: string | null) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> => {
  let jobId: string;
  let apiVersion: "v1" | "v2";

  try {
    const result = await startTryOnJob(modelUrl, outfitPieces, hasAccessories, prompt);
    jobId = result.jobId;
    apiVersion = result.apiVersion;
  } catch (error) {
    callbacks.onError(error instanceof Error ? error.message : "Failed to start try-on");
    return;
  }

  const POLL_INTERVAL = 2000;
  const MAX_WAIT = 300000;
  const startTime = Date.now();

  const poll = async (): Promise<void> => {
    if (signal?.aborted) {
      return;
    }

    if (Date.now() - startTime > MAX_WAIT) {
      callbacks.onError("Try-on timed out. Please try again.");
      return;
    }

    let job: RunJob;
    try {
      job = await pollTryOnJob(jobId, apiVersion);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : "Failed to get job status");
      return;
    }

    if (job.progress !== undefined && job.progress > 0) {
      callbacks.onProgress(job.progress);
    }

    if (job.is_retrying) {
      callbacks.onRetry(job.retry_count ?? 0, job.retry_reason ?? null);
    }

    if (job.status === "completed") {
      if (!job.result_base64) {
        callbacks.onError("Try-on completed but no image was returned.");
        return;
      }

      const resultImage = job.result_base64.startsWith("data:")
        ? job.result_base64
        : `data:image/png;base64,${job.result_base64}`;

      const compositeImage = job.outfit_composite_base64
        ? job.outfit_composite_base64.startsWith("data:")
          ? job.outfit_composite_base64
          : `data:image/png;base64,${job.outfit_composite_base64}`
        : null;

      callbacks.onComplete(resultImage, compositeImage);
      return;
    }

    if (job.status === "failed") {
      callbacks.onError(job.error ?? "Try-on failed. Please try again.");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    return poll();
  };

  await poll();
};
