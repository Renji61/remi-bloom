"use client";

import { useMemo } from "react";
import { useAppStore } from "@/stores/app-store";

const currencyInfo: Record<string, { code: string; symbol: string; locale: string }> = {
  USD: { code: "USD", symbol: "$", locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", locale: "en-GB" },
  JPY: { code: "JPY", symbol: "¥", locale: "ja-JP" },
  INR: { code: "INR", symbol: "₹", locale: "en-IN" },
  CAD: { code: "CAD", symbol: "CA$", locale: "en-CA" },
  AUD: { code: "AUD", symbol: "AU$", locale: "en-AU" },
  BRL: { code: "BRL", symbol: "R$", locale: "pt-BR" },
  MXN: { code: "MXN", symbol: "MX$", locale: "es-MX" },
  CHF: { code: "CHF", symbol: "CHF", locale: "de-CH" },
  CNY: { code: "CNY", symbol: "¥", locale: "zh-CN" },
  KRW: { code: "KRW", symbol: "₩", locale: "ko-KR" },
  SEK: { code: "SEK", symbol: "kr", locale: "sv-SE" },
  NOK: { code: "NOK", symbol: "kr", locale: "nb-NO" },
  DKK: { code: "DKK", symbol: "kr", locale: "da-DK" },
  NZD: { code: "NZD", symbol: "NZ$", locale: "en-NZ" },
  SGD: { code: "SGD", symbol: "S$", locale: "en-SG" },
  HKD: { code: "HKD", symbol: "HK$", locale: "en-HK" },
  THB: { code: "THB", symbol: "฿", locale: "th-TH" },
  RUB: { code: "RUB", symbol: "₽", locale: "ru-RU" },
  ZAR: { code: "ZAR", symbol: "R", locale: "en-ZA" },
  TRY: { code: "TRY", symbol: "₺", locale: "tr-TR" },
  PLN: { code: "PLN", symbol: "zł", locale: "pl-PL" },
};

export const currencyOptions = Object.entries(currencyInfo).map(([code, info]) => ({
  code,
  symbol: info.symbol,
  label: `${info.symbol}  ${code}`,
}));

export function useFormatPrice() {
  const currencyCode = useAppStore((s) => s.currencyCode);
  const currencySymbol = useAppStore((s) => s.currencySymbol);

  return useMemo(() => {
    const info = currencyInfo[currencyCode];
    const locale = info?.locale ?? "en-US";
    const code = currencyCode;

    return (price: number): string => {
      if (price <= 0) return "";
      const numPrice = typeof price === "string" ? parseFloat(price) : price;
      if (isNaN(numPrice) || numPrice <= 0) return "";
      if (!code) return `$${numPrice.toFixed(2)}`;
      try {
        return numPrice.toLocaleString(locale, {
          style: "currency",
          currency: code,
        });
      } catch {
        return `${currencySymbol || "$"}${numPrice.toFixed(2)}`;
      }
    };
  }, [currencyCode, currencySymbol]);
}

export { currencyInfo };
