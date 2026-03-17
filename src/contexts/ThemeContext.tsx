import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { storeConfig, type StoreConfig } from "@/config/store.config";

interface ThemeContextValue {
  theme: StoreConfig["theme"];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const BORDER_RADIUS_BY_PRESET: Record<StoreConfig["theme"]["borderRadius"], string> = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
};

const normalizeHex = (input: string): string => {
  const value = input.trim();
  if (!value) return "#000000";
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [, a, b, c] = value;
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  return "#000000";
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex).slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHsl = ({ r, g, b }: { r: number; g: number; b: number }): string => {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;

  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === nr) {
      hue = ((ng - nb) / delta) % 6;
    } else if (max === ng) {
      hue = (nb - nr) / delta + 2;
    } else {
      hue = (nr - ng) / delta + 4;
    }
  }

  hue = Math.round((hue * 60 + 360) % 360);
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return `${hue} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

const isHexLight = (hex: string): boolean => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5;
};

const toReadableForeground = (hex: string): string => {
  return isHexLight(hex) ? "0 0% 10%" : "0 0% 96%";
};

const toReadableTextHex = (hex: string): string => {
  return isHexLight(hex) ? "#1A1A1A" : "#F5F0E8";
};

const toLinearChannel = (value: number): number => {
  const normalized = value / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
};

const calculateRelativeLuminance = ({ r, g, b }: { r: number; g: number; b: number }): number => {
  const red = toLinearChannel(r);
  const green = toLinearChannel(g);
  const blue = toLinearChannel(b);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const getContrastRatio = (foregroundHex: string, backgroundHex: string): number => {
  const foregroundLuminance = calculateRelativeLuminance(hexToRgb(foregroundHex));
  const backgroundLuminance = calculateRelativeLuminance(hexToRgb(backgroundHex));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const toContrastSafeColor = (
  preferredHex: string,
  backgroundHex: string,
  fallbackHex: string,
  minimumContrastRatio = 4.5,
): string => {
  const preferred = normalizeHex(preferredHex);
  const background = normalizeHex(backgroundHex);
  const fallback = normalizeHex(fallbackHex);

  if (getContrastRatio(preferred, background) >= minimumContrastRatio) {
    return preferred;
  }

  let bestCandidate = preferred;
  let bestRatio = getContrastRatio(preferred, background);

  const fallbackRatio = getContrastRatio(fallback, background);
  if (fallbackRatio > bestRatio) {
    bestCandidate = fallback;
    bestRatio = fallbackRatio;
  }

  for (let step = 1; step <= 12; step += 1) {
    const candidate = mixHex(preferred, fallback, step / 12);
    const ratio = getContrastRatio(candidate, background);
    if (ratio > bestRatio) {
      bestCandidate = candidate;
      bestRatio = ratio;
    }
    if (ratio >= minimumContrastRatio) {
      return candidate;
    }
  }

  return bestCandidate;
};

const mixHex = (baseHex: string, overlayHex: string, overlayWeight: number): string => {
  const base = hexToRgb(baseHex);
  const overlay = hexToRgb(overlayHex);
  const weight = Math.min(1, Math.max(0, overlayWeight));
  const r = Math.round(base.r * (1 - weight) + overlay.r * weight);
  const g = Math.round(base.g * (1 - weight) + overlay.g * weight);
  const b = Math.round(base.b * (1 - weight) + overlay.b * weight);
  return `#${[r, g, b].map((entry) => entry.toString(16).padStart(2, "0")).join("")}`;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const theme = useMemo(() => storeConfig.theme, []);

  useEffect(() => {
    const root = document.documentElement;
    const primary = normalizeHex(theme.primaryColor);
    const secondary = normalizeHex(theme.secondaryColor);
    const accent = normalizeHex(theme.accentColor);
    const navbarSolid = normalizeHex(theme.navbarSolidBackgroundColor);
    const navbarSolidForeground = toReadableTextHex(navbarSolid);
    const navbarSolidInteractive = toContrastSafeColor(accent, navbarSolid, navbarSolidForeground);
    const danger = "#C0392B";
    const success = "#2E7D32";
    const muted = mixHex(primary, secondary, 0.3);
    const mutedSoft = mixHex(primary, secondary, 0.45);
    const border = mixHex(primary, secondary, 0.7);
    const surface = mixHex(primary, secondary, 0.82);
    const surfaceAlt = mixHex(primary, secondary, 0.9);
    const surfaceStrong = mixHex(primary, secondary, 0.6);
    const primaryRgb = hexToRgb(primary);
    const secondaryRgb = hexToRgb(secondary);
    const accentRgb = hexToRgb(accent);
    const navbarSolidRgb = hexToRgb(navbarSolid);
    const navbarSolidForegroundRgb = hexToRgb(navbarSolidForeground);
    const navbarSolidInteractiveRgb = hexToRgb(navbarSolidInteractive);
    const dangerRgb = hexToRgb(danger);
    const successRgb = hexToRgb(success);
    const borderRgb = hexToRgb(border);

    root.style.setProperty("--color-primary", primary);
    root.style.setProperty("--color-secondary", secondary);
    root.style.setProperty("--color-accent", accent);
    root.style.setProperty("--color-navbar-solid", navbarSolid);
    root.style.setProperty("--color-navbar-solid-foreground", navbarSolidForeground);
    root.style.setProperty("--color-navbar-solid-interactive", navbarSolidInteractive);
    root.style.setProperty("--color-muted", muted);
    root.style.setProperty("--color-muted-soft", mutedSoft);
    root.style.setProperty("--color-border", border);
    root.style.setProperty("--color-surface", surface);
    root.style.setProperty("--color-surface-alt", surfaceAlt);
    root.style.setProperty("--color-surface-strong", surfaceStrong);
    root.style.setProperty("--color-danger", danger);
    root.style.setProperty("--color-success", success);
    root.style.setProperty("--font-heading", theme.fontHeading);
    root.style.setProperty("--font-body", theme.fontBody);
    root.style.setProperty("--border-radius", BORDER_RADIUS_BY_PRESET[theme.borderRadius]);

    root.style.setProperty("--color-primary-rgb", `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
    root.style.setProperty("--color-secondary-rgb", `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);
    root.style.setProperty("--color-accent-rgb", `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
    root.style.setProperty("--color-navbar-solid-rgb", `${navbarSolidRgb.r}, ${navbarSolidRgb.g}, ${navbarSolidRgb.b}`);
    root.style.setProperty("--color-navbar-solid-foreground-rgb", `${navbarSolidForegroundRgb.r}, ${navbarSolidForegroundRgb.g}, ${navbarSolidForegroundRgb.b}`);
    root.style.setProperty("--color-navbar-solid-interactive-rgb", `${navbarSolidInteractiveRgb.r}, ${navbarSolidInteractiveRgb.g}, ${navbarSolidInteractiveRgb.b}`);
    root.style.setProperty("--color-danger-rgb", `${dangerRgb.r}, ${dangerRgb.g}, ${dangerRgb.b}`);
    root.style.setProperty("--color-success-rgb", `${successRgb.r}, ${successRgb.g}, ${successRgb.b}`);

    root.style.setProperty("--background", rgbToHsl(secondaryRgb));
    root.style.setProperty("--foreground", rgbToHsl(primaryRgb));
    root.style.setProperty("--card", rgbToHsl(secondaryRgb));
    root.style.setProperty("--card-foreground", rgbToHsl(primaryRgb));
    root.style.setProperty("--popover", rgbToHsl(secondaryRgb));
    root.style.setProperty("--popover-foreground", rgbToHsl(primaryRgb));
    root.style.setProperty("--primary", rgbToHsl(primaryRgb));
    root.style.setProperty("--primary-foreground", toReadableForeground(primary));
    root.style.setProperty("--secondary", rgbToHsl(secondaryRgb));
    root.style.setProperty("--secondary-foreground", rgbToHsl(primaryRgb));
    root.style.setProperty("--muted", rgbToHsl(secondaryRgb));
    root.style.setProperty("--muted-foreground", "0 0% 38%");
    root.style.setProperty("--accent", rgbToHsl(accentRgb));
    root.style.setProperty("--accent-foreground", toReadableForeground(accent));
    root.style.setProperty("--border", rgbToHsl(borderRgb));
    root.style.setProperty("--input", rgbToHsl(borderRgb));
    root.style.setProperty("--ring", rgbToHsl(accentRgb));
    root.style.setProperty("--radius", BORDER_RADIUS_BY_PRESET[theme.borderRadius]);
    root.style.setProperty("--font-display", theme.fontHeading);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
};

export const useThemeConfig = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeConfig must be used within ThemeProvider");
  }
  return context;
};

