export interface RunJobRequest {
  model_url: string;
  outfit_pieces: string[];
  prompt?: string;
}

export interface RunJob {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  result_base64?: string;
  outfit_composite_base64?: string;
  is_retrying?: boolean;
  retry_count?: number;
  retry_reason?: string;
}

export interface TryOnResult {
  jobId: string;
  resultImage: string;
  outfitCompositeImage?: string;
}

export type TryOnState = "upload" | "processing" | "result" | "error";
