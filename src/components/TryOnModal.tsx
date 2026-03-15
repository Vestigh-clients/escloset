import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { runTryOnWithPolling } from "@/services/tryOnService";
import type { Product } from "@/types/product";
import { getPrimaryImage } from "@/types/product";
import type { TryOnState } from "@/types/tryon";

type TryOnModalProps = {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
};

const TryOnModal = ({ product, isOpen, onClose }: TryOnModalProps) => {
  const [tryOnState, setTryOnState] = useState<TryOnState>("upload");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [compositeImage, setCompositeImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryReason, setRetryReason] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (modelPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(modelPreview);
      }
    };
  }, [modelPreview]);

  const resetTryOn = () => {
    if (modelPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(modelPreview);
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setTryOnState("upload");
    setModelFile(null);
    setModelPreview(null);
    setProgress(0);
    setResultImage(null);
    setCompositeImage(null);
    setErrorMessage(null);
    setIsRetrying(false);
    setRetryCount(0);
    setRetryReason(null);
  };

  const handleClose = () => {
    abortControllerRef.current?.abort();
    resetTryOn();
    onClose();
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    const maxSizeBytes = 5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setTryOnState("error");
      setErrorMessage("Please upload a JPG or PNG image.");
      return;
    }

    if (file.size > maxSizeBytes) {
      setTryOnState("error");
      setErrorMessage("Image is too large. Please upload a file up to 5MB.");
      return;
    }

    if (modelPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(modelPreview);
    }

    setModelFile(file);
    setModelPreview(URL.createObjectURL(file));
    setTryOnState("upload");
    setErrorMessage(null);
  };

  const handleStartTryOn = async () => {
    if (!modelFile) {
      return;
    }

    setTryOnState("processing");
    setProgress(0);
    setErrorMessage(null);
    setIsRetrying(false);
    setRetryCount(0);
    setRetryReason(null);

    const fileExt = modelFile.name.split(".").pop() || "png";
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const { data: uploadData, error } = await supabase.storage.from("tryon-uploads").upload(fileName, modelFile, {
      contentType: modelFile.type,
      upsert: false,
    });

    if (error || !uploadData) {
      setTryOnState("error");
      setErrorMessage("Failed to upload photo. Please try again.");
      return;
    }

    const { data: urlData } = supabase.storage.from("tryon-uploads").getPublicUrl(uploadData.path);
    const modelUrl = urlData.publicUrl;
    const productImageUrl = getPrimaryImage(product);

    if (!productImageUrl) {
      setTryOnState("error");
      setErrorMessage("This product has no image available for try-on.");
      return;
    }

    const hasAccessories = product.categories.slug === "bags";

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    await runTryOnWithPolling(
      modelUrl,
      [productImageUrl],
      hasAccessories,
      undefined,
      {
        onProgress: (value) => setProgress(value),
        onRetry: (count, reason) => {
          setIsRetrying(true);
          setRetryCount(count);
          setRetryReason(reason);
        },
        onComplete: (result, composite) => {
          setResultImage(result);
          setCompositeImage(composite);
          setIsRetrying(false);
          setTryOnState("result");
        },
        onError: (message) => {
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }

          setErrorMessage(message);
          setIsRetrying(false);
          setTryOnState("error");
        },
      },
      abortControllerRef.current.signal,
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-3 py-6"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Virtual Try-On"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[2px] bg-[#F5F0E8] p-7 sm:p-10"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-5 top-5 text-[#555555] transition-colors duration-200 hover:text-[#1A1A1A]"
          aria-label="Close try-on modal"
        >
          <X size={20} strokeWidth={1.4} />
        </button>

        <h2 className="mb-1 font-display text-[28px] italic text-[#1A1A1A]">Try it On</h2>
        <p className="mb-8 font-body text-[12px] text-[#777777]">{product.name}</p>

        {tryOnState === "upload" ? (
          <div>
            <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Your Photo</p>

            {!modelPreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-[2px] border-2 border-dashed border-[#d4ccc2] px-6 py-10 text-center transition-colors duration-200 hover:border-[#1A1A1A]"
              >
                <Camera size={32} strokeWidth={1.25} className="mx-auto mb-3 text-[#d4ccc2]" />
                <p className="font-body text-[13px] text-[#555555]">Upload a photo of yourself</p>
                <p className="mt-2 font-body text-[10px] text-[#777777]">JPG or PNG - Max 5MB</p>
              </button>
            ) : (
              <div>
                <img src={modelPreview} alt="Model preview" className="h-[200px] w-full rounded-[2px] object-cover" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 font-body text-[10px] uppercase tracking-[0.15em] text-[#C4A882]"
                >
                  Change photo
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="my-6 border-b border-[#d4ccc2]" />

            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Trying On</p>

            <div className="flex items-start gap-4">
              <img
                src={getPrimaryImage(product)}
                alt={product.name}
                className="h-[85px] w-[64px] rounded-[2px] object-cover"
              />
              <div>
                <p className="font-body text-[12px] text-[#1A1A1A]">{product.name}</p>
                <p className="mt-1 font-body text-[10px] uppercase tracking-[0.15em] text-[#C4A882]">{product.categories.name}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartTryOn}
              disabled={!modelFile}
              className="mt-6 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Try-On
            </button>
          </div>
        ) : null}

        {tryOnState === "processing" ? (
          <div>
            <p className="mb-8 text-center font-display text-[24px] italic text-[#1A1A1A]">Creating your try-on</p>

            <div className="relative h-[3px] w-full overflow-hidden rounded-[2px] bg-[#e8e2d9]">
              {progress === 0 ? (
                <div
                  className="absolute top-0 h-full w-[30%]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, #C4A882 50%, transparent 100%)",
                    animation: "lux-tryon-shimmer 1.5s ease-in-out infinite",
                  }}
                />
              ) : (
                <div
                  className="h-full rounded-[2px] bg-[#C4A882] transition-all duration-500 ease-in-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              )}
            </div>

            {isRetrying ? (
              <p className="mt-4 text-center font-body text-[11px] text-[#555555]">
                {`Retrying (${retryCount}): ${retryReason ?? "request retry in progress"}`}
              </p>
            ) : null}
          </div>
        ) : null}

        {tryOnState === "result" ? (
          <div>
            <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Try-On Complete</p>

            {resultImage ? (
              <img
                src={resultImage}
                alt={`${product.name} virtual try-on`}
                className="max-h-[480px] w-full rounded-[2px] object-contain"
              />
            ) : null}

            {compositeImage ? (
              <div>
                <p className="mb-2 mt-4 font-body text-[10px] uppercase tracking-[0.15em] text-[#777777]">Outfit Preview</p>
                <img src={compositeImage} alt="Outfit preview" className="h-[120px] w-full object-contain" />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (!resultImage) {
                  return;
                }
                const link = document.createElement("a");
                link.href = resultImage;
                link.download = `luxuriant-tryon-${product.slug}.png`;
                link.click();
              }}
              className="mt-6 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A]"
            >
              Download Photo
            </button>

            <button
              type="button"
              onClick={resetTryOn}
              className="mt-2 w-full rounded-[2px] border border-[#1A1A1A] bg-transparent px-4 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[#1A1A1A] transition-colors duration-300 hover:bg-[#1A1A1A] hover:text-[#F5F0E8]"
            >
              Try Another Photo
            </button>
          </div>
        ) : null}

        {tryOnState === "error" ? (
          <div className="py-2 text-center">
            <AlertCircle size={40} strokeWidth={1.25} className="mx-auto mb-4 text-[#C0392B]" />
            <p className="mb-6 font-display text-[22px] italic leading-[1.2] text-[#1A1A1A]">
              {errorMessage ?? "Something went wrong. Please try again."}
            </p>

            <button
              type="button"
              onClick={resetTryOn}
              className="w-full rounded-[2px] bg-[#1A1A1A] px-4 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A]"
            >
              Try Again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TryOnModal;

