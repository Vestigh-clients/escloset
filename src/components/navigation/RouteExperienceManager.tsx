import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";

const SCROLL_MEMORY_STORAGE_KEY = "escloset_scroll_memory_v1";

const isProductDetailPath = (pathname: string) => /^\/shop\/[^/]+$/.test(pathname);

const buildRouteKey = (pathname: string, search: string) => `${pathname}${search}`;

const readScrollMemory = (): Record<string, number> => {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.sessionStorage.getItem(SCROLL_MEMORY_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) {
        next[key] = numeric;
      }
    }
    return next;
  } catch {
    return {};
  }
};

const writeScrollMemory = (value: Record<string, number>) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SCROLL_MEMORY_STORAGE_KEY, JSON.stringify(value));
};

const saveScrollPosition = (routeKey: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const memory = readScrollMemory();
  memory[routeKey] = Math.max(0, window.scrollY || window.pageYOffset || 0);
  writeScrollMemory(memory);
};

const getSavedScrollPosition = (routeKey: string): number | null => {
  const memory = readScrollMemory();
  if (!Object.prototype.hasOwnProperty.call(memory, routeKey)) {
    return null;
  }
  return memory[routeKey];
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const RouteExperienceManager = () => {
  const location = useLocation();
  const routeKey = useMemo(() => buildRouteKey(location.pathname, location.search), [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeUnload = () => {
      saveScrollPosition(routeKey);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [routeKey]);

  useEffect(() => {
    return () => {
      saveScrollPosition(routeKey);
    };
  }, [routeKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (location.hash) {
      return;
    }

    const targetY = isProductDetailPath(location.pathname) ? 0 : (getSavedScrollPosition(routeKey) ?? 0);
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: targetY,
        behavior,
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [location.hash, location.pathname, routeKey]);

  return null;
};

export default RouteExperienceManager;
