import { formatDistanceToNowStrict } from "date-fns";

const amountFormatter = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 0,
});

const compactAmountFormatter = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 1,
});

export const formatCurrency = (amount: number) => `\u20A6${amountFormatter.format(Number.isFinite(amount) ? amount : 0)}`;

export const formatCompactCurrency = (amount: number) => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safeAmount);

  if (abs >= 1_000_000) {
    return `\u20A6${compactAmountFormatter.format(safeAmount / 1_000_000)}M`;
  }

  if (abs >= 1_000) {
    return `\u20A6${compactAmountFormatter.format(safeAmount / 1_000)}k`;
  }

  return `\u20A6${amountFormatter.format(safeAmount)}`;
};

export const formatDateShort = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateLong = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const formatRelativeDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
};

export const formatAdminDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const now = new Date();
  const difference = Math.abs(now.getTime() - date.getTime());
  const days = difference / (1000 * 60 * 60 * 24);

  if (days < 7) {
    return formatRelativeDate(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const trendTone = (value: number | null) => {
  if (value === null) {
    return "neutral" as const;
  }

  if (value > 0.2) {
    return "positive" as const;
  }

  if (value < -0.2) {
    return "negative" as const;
  }

  return "neutral" as const;
};

export const trendLabel = (value: number | null) => {
  const tone = trendTone(value);

  if (tone === "neutral") {
    return "No change";
  }

  const rounded = Math.abs(value ?? 0).toFixed(1).replace(".0", "");
  if (tone === "positive") {
    return `\u2191 ${rounded}% vs last month`;
  }

  return `\u2193 ${rounded}% vs last month`;
};
