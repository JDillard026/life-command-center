"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
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

function sortByTime(a, b) {
  const at = typeof a.time === "string" ? Date.parse(a.time) : a.time;
  const bt = typeof b.time === "string" ? Date.parse(b.time) : b.time;
  return at - bt;
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
    .sort(sortByTime);
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

      return { time, open, high, low, close };
    })
    .filter(Boolean)
    .sort(sortByTime);
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
    .sort(sortByTime);
}

function normalizeMarkers(markers = []) {
  if (!Array.isArray(markers)) return [];

  return markers
    .map((m) => {
      const time = toChartTime(m?.time);
      if (!time) return null;

      return {
        time,
        position: m?.position || "aboveBar",
        color: m?.color || "#60a5fa",
        shape: m?.shape || "circle",
        text: m?.text || "",
      };
    })
    .filter(Boolean)
    .sort(sortByTime);
}

function normalizePriceLines(lines = []) {
  if (!Array.isArray(lines)) return [];

  return lines
    .map((line) => {
      const price = num(line?.price);
      if (price === null) return null;

      return {
        price,
        color: line?.color || "rgba(255,255,255,.55)",
        lineWidth: Number.isFinite(Number(line?.lineWidth)) ? Number(line.lineWidth) : 1,
        lineStyle: Number.isFinite(Number(line?.lineStyle)) ? Number(line.lineStyle) : 0,
        axisLabelVisible: line?.axisLabelVisible !== false,
        title: line?.title || "",
      };
    })
    .filter(Boolean);
}

export default function InvestmentChart({
  data = [],
  volumeData = [],
  mode = "line",
  height = 540,
  markers = [],
  priceLines = [],
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
        background: { color: "#07101d" },
        textColor: "#cbd5e1",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.045)" },
        horzLines: { color: "rgba(255,255,255,0.045)" },
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
        vertLine: { color: "rgba(255,255,255,0.18)" },
        horzLine: { color: "rgba(255,255,255,0.18)" },
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
    const appliedPriceLines = [];

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
          priceLineColor: "rgba(96,165,250,.8)",
          lastValueVisible: true,
          crosshairMarkerVisible: true,
        });

        series.setData(lineData);
      }
    }

    if (series) {
      const normalizedMarkers = normalizeMarkers(markers);
      if (normalizedMarkers.length > 0) {
        try {
          createSeriesMarkers(series, normalizedMarkers);
        } catch (err) {
          console.error("marker render failed", err);
        }
      } else {
        try {
          createSeriesMarkers(series, []);
        } catch {}
      }

      const normalizedPriceLines = normalizePriceLines(priceLines);
      if (normalizedPriceLines.length > 0 && typeof series.createPriceLine === "function") {
        for (const line of normalizedPriceLines) {
          try {
            const created = series.createPriceLine(line);
            appliedPriceLines.push(created);
          } catch (err) {
            console.error("price line failed", err);
          }
        }
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      chart.applyOptions({
        width: container.clientWidth || 900,
      });
      chart.timeScale().fitContent();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      if (series && typeof series.removePriceLine === "function") {
        for (const line of appliedPriceLines) {
          try {
            series.removePriceLine(line);
          } catch {}
        }
      }

      chart.remove();
    };
  }, [data, volumeData, mode, height, markers, priceLines]);

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