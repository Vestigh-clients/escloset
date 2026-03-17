import { useState } from "react";
import { storeConfig } from "@/config/store.config";
import { cn } from "@/lib/utils";

interface StoreLogoProps {
  className?: string;
  textClassName?: string;
  alt?: string;
}

const StoreLogo = ({ className, textClassName, alt }: StoreLogoProps) => {
  const [hasImageError, setHasImageError] = useState(false);
  const hasLogo = Boolean(storeConfig.logoUrl?.trim()) && !hasImageError;

  if (hasLogo) {
    return (
      <img
        src={storeConfig.logoUrl}
        alt={alt ?? storeConfig.storeName}
        className={className}
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <span className={cn("font-display text-[24px] italic text-foreground", textClassName)}>
      {storeConfig.storeName}
    </span>
  );
};

export default StoreLogo;
