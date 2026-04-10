import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { resolveStorefrontConfig, type ResolvedStorefrontConfig } from "@/config/storefront.config";
import { fetchPublicSiteSettings, type PublicSiteSettings } from "@/services/publicSiteSettingsService";
import {
  fetchStorefrontCategories,
  type StorefrontCategory,
} from "@/services/storefrontCategoryService";

interface StorefrontConfigContextValue {
  storefrontConfig: ResolvedStorefrontConfig;
  publicSettings: PublicSiteSettings | null;
  storefrontCategories: StorefrontCategory[];
}

const StorefrontConfigContext = createContext<StorefrontConfigContextValue | undefined>(undefined);

interface StorefrontConfigProviderProps {
  children: ReactNode;
  initialPublicSettings?: PublicSiteSettings | null;
  initialStorefrontCategories?: StorefrontCategory[];
}

export const StorefrontConfigProvider = ({
  children,
  initialPublicSettings = null,
  initialStorefrontCategories = [],
}: StorefrontConfigProviderProps) => {
  const [publicSettings, setPublicSettings] = useState<PublicSiteSettings | null>(initialPublicSettings);
  const [storefrontCategories, setStorefrontCategories] = useState<StorefrontCategory[]>(initialStorefrontCategories);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      const [settingsResult, categoriesResult] = await Promise.allSettled([
        fetchPublicSiteSettings(),
        fetchStorefrontCategories(),
      ]);

      if (!isActive) {
        return;
      }

      if (settingsResult.status === "fulfilled") {
        setPublicSettings(settingsResult.value);
      } else if (!initialPublicSettings) {
        setPublicSettings(null);
      }

      if (categoriesResult.status === "fulfilled") {
        setStorefrontCategories(categoriesResult.value);
      } else if (initialStorefrontCategories.length === 0) {
        setStorefrontCategories([]);
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [initialPublicSettings, initialStorefrontCategories.length]);

  const storefrontConfig = useMemo(() => resolveStorefrontConfig(publicSettings), [publicSettings]);

  return (
    <StorefrontConfigContext.Provider value={{ storefrontConfig, publicSettings, storefrontCategories }}>
      {children}
    </StorefrontConfigContext.Provider>
  );
};

export const useStorefrontConfig = () => {
  const context = useContext(StorefrontConfigContext);
  if (!context) {
    throw new Error("useStorefrontConfig must be used within StorefrontConfigProvider");
  }

  return context;
};
