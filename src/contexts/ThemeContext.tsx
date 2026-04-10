import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useMemo } from "react";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { compileThemeVars, ensureThemePresetFonts, type ThemePreset, themePresets } from "@/themes";

interface ThemeContextValue {
  preset: ThemePreset;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { storefrontConfig } = useStorefrontConfig();
  const preset = useMemo(() => themePresets[storefrontConfig.themePresetKey], [storefrontConfig.themePresetKey]);

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.themePreset = preset.key;
    void ensureThemePresetFonts(preset.key);

    for (const [name, value] of Object.entries(compileThemeVars(preset))) {
      root.style.setProperty(name, value);
    }
  }, [preset]);

  return <ThemeContext.Provider value={{ preset }}>{children}</ThemeContext.Provider>;
};

export const useThemeConfig = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeConfig must be used within ThemeProvider");
  }

  return context;
};
