"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";

function toChartTime(value) {
  if (!value) return null;

  if (typeof value === "number") return value;

  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const ts = Date.parse(trimmed);
    if (!Number.isNaN(ts)) {
      return Math.floor(ts / 1000);
    }
  }

  return null;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLineData(data = []) {
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const time = toChartTime(row?.time ?? row?.date ?? row?.timestamp);
      const value = num(row?.value ?? row?.close ?? row?.price);

      if (!time || value === null) return null;

      return { time, value };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const at = typeof a.time === "string" ? Date.parse(a.time) : a.time;
      const bt = typeof b.time === "string" ? Date.parse(b.time) : b.time;
      return at - bt;
    });
}

function normalizeCandleData(data = []) {
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const time = toChartTime(row?.time ?? row?.date ?? row?.timestamp);
      const open = num(row?.open);
      const high = num(row?.high);
      const low = num(row?.low);
      const close = num(row?.close);

      if (!time) return null;
      if (open === null || high === null || low === null || close === null) {
        return null;
      }

      return {
        time,
        open,
        high,
        low,
        close,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const at = typeof a.time === "string" ? Date.parse(a.time) : a.time;
      const bt = typeof b.time === "string" ? Date.parse(b.time) : b.time;
      return at - bt;
    });
}

function normalizeVolumeData(data = []) {
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const time = toChartTime(row?.time ?? row?.date ?? row?.timestamp);
      const value = num(row?.value ?? row?.volume);

      if (!time || value === null) return null;

      const open = num(row?.open);
      const close = num(row?.close);

      return {
        time,
        value,
        color:
          open !== null && close !== null
            ? close >= open
              ? "rgba(34,197,94,0.45)"
              : "rgba(239,68,68,0.45)"
            : "rgba(148,163,184,0.35)",
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const at = typeof a.time === "string" ? Date.parse(a.time) : a.time;
      const bt = typeof b.time === "string" ? Date.parse(b.time) : b.time;
      return at - bt;
    });
}

export default function InvestmentChart({
  data = [],
  volumeData = [],
  mode = "line",
  height = 540,
}) {
  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const chart = createChart(container, {
      width: container.clientWidth || 900,
      height,
      layout: {
        background: { color: "#09111f" },
        textColor: "#cbd5e1",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.10)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.10)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(255,255,255,0.16)" },
        horzLine: { color: "rgba(255,255,255,0.16)" },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    let series;
    let volumeSeries;

    if (mode === "candles") {
      const candleData = normalizeCandleData(data);

      if (candleData.length > 0) {
        series = chart.addSeries(CandlestickSeries, {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderUpColor: "#22c55e",
          borderDownColor: "#ef4444",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });

        series.setData(candleData);

        const normalizedVolume =
          Array.isArray(volumeData) && volumeData.length > 0
            ? normalizeVolumeData(volumeData)
            : normalizeVolumeData(
                candleData.map((c) => ({
                  time: c.time,
                  value: 0,
                  open: c.open,
                  close: c.close,
                }))
              );

        if (normalizedVolume.length > 0) {
          volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "",
          });

          volumeSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.78,
              bottom: 0,
            },
          });

          volumeSeries.setData(normalizedVolume);
        }
      }
    } else {
      const lineData = normalizeLineData(data);

      if (lineData.length > 0) {
        series = chart.addSeries(LineSeries, {
          color: "#60a5fa",
          lineWidth: 3,
        });

        series.setData(lineData);
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (!container) return;
      chart.applyOptions({
        width: container.clientWidth || 900,
      });
      chart.timeScale().fitContent();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, volumeData, mode, height]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: `${height}px`,
        borderRadius: "18px",
        overflow: "hidden",
      }}
    />
  );
}