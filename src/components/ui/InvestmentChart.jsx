"use client";

import { useEffect, useRef, useState } from "react";
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

function formatCompactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function formatTooltipTime(time) {
  if (!time) return "—";

  if (typeof time === "string") {
    return time;
  }

  if (typeof time === "number") {
    const d = new Date(time * 1000);
    if (Number.isNaN(d.getTime())) return String(time);

    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return String(time);
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
  const [hoverData, setHoverData] = useState(null);

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
        vertLine: {
          color: "rgba(255,255,255,0.18)",
          width: 1,
          style: 2,
        },
        horzLine: {
          color: "rgba(255,255,255,0.18)",
          width: 1,
          style: 2,
        },
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

    const normalizedLineData = normalizeLineData(data);
    const normalizedCandleData = normalizeCandleData(data);
    const normalizedVolume =
      Array.isArray(volumeData) && volumeData.length > 0
        ? normalizeVolumeData(volumeData)
        : [];

    if (mode === "candles") {
      if (normalizedCandleData.length > 0) {
        series = chart.addSeries(CandlestickSeries, {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderUpColor: "#22c55e",
          borderDownColor: "#ef4444",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });

        series.setData(normalizedCandleData);

        const volumeToUse =
          normalizedVolume.length > 0
            ? normalizedVolume
            : normalizeVolumeData(
                normalizedCandleData.map((c) => ({
                  time: c.time,
                  value: 0,
                  open: c.open,
                  close: c.close,
                }))
              );

        if (volumeToUse.length > 0) {
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

          volumeSeries.setData(volumeToUse);
        }
      }
    } else {
      if (normalizedLineData.length > 0) {
        series = chart.addSeries(LineSeries, {
          color: "#60a5fa",
          lineWidth: 3,
          priceLineColor: "rgba(96,165,250,.8)",
          lastValueVisible: true,
          crosshairMarkerVisible: true,
        });

        series.setData(normalizedLineData);
      }
    }

    if (series) {
      const normalizedMarkers = normalizeMarkers(markers);

      try {
        createSeriesMarkers(series, normalizedMarkers);
      } catch (err) {
        console.error("marker render failed", err);
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

    const candleMap = new Map(
      normalizedCandleData.map((row) => [String(row.time), row])
    );
    const volumeMap = new Map(
      normalizedVolume.map((row) => [String(row.time), row])
    );
    const lineMap = new Map(
      normalizedLineData.map((row) => [String(row.time), row])
    );

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        setHoverData(null);
        return;
      }

      const key = String(param.time);

      if (mode === "candles") {
        const candle = candleMap.get(key);

        if (!candle) {
          setHoverData(null);
          return;
        }

        const vol = volumeMap.get(key);
        const change =
          Number.isFinite(candle.open) && Number.isFinite(candle.close)
            ? candle.close - candle.open
            : null;
        const changePct =
          Number.isFinite(candle.open) && candle.open !== 0 && Number.isFinite(candle.close)
            ? ((candle.close - candle.open) / candle.open) * 100
            : null;

        setHoverData({
          mode: "candles",
          time: param.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: vol?.value ?? null,
          change,
          changePct,
        });
      } else {
        const line = lineMap.get(key);

        if (!line) {
          setHoverData(null);
          return;
        }

        setHoverData({
          mode: "line",
          time: param.time,
          close: line.value,
        });
      }
    });

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

  const hoverTone =
    hoverData?.change !== null && Number.isFinite(hoverData?.change)
      ? hoverData.change >= 0
        ? "#4ade80"
        : "#f87171"
      : "rgba(255,255,255,.92)";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: `${height}px`,
        borderRadius: "18px",
        overflow: "hidden",
      }}
    >
      <div
        ref={chartContainerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "18px",
          overflow: "hidden",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 3,
          minWidth: 210,
          maxWidth: 260,
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,.08)",
          background: "rgba(8,12,20,.84)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 12px 30px rgba(0,0,0,.28)",
          pointerEvents: "none",
        }}
      >
        <div
          className="muted"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 8,
          }}
        >
          Hover Stats
        </div>

        {hoverData ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 12 }}>
              {formatTooltipTime(hoverData.time)}
            </div>

            {hoverData.mode === "candles" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                  <MiniHover label="O" value={formatPrice(hoverData.open)} />
                  <MiniHover label="H" value={formatPrice(hoverData.high)} />
                  <MiniHover label="L" value={formatPrice(hoverData.low)} />
                  <MiniHover label="C" value={formatPrice(hoverData.close)} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span className="muted" style={{ fontSize: 12 }}>Vol</span>
                  <span style={{ fontWeight: 800, fontSize: 12 }}>
                    {hoverData.volume !== null ? formatCompactNumber(hoverData.volume) : "—"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span className="muted" style={{ fontSize: 12 }}>Change</span>
                  <span style={{ fontWeight: 900, fontSize: 12, color: hoverTone }}>
                    {hoverData.change !== null ? `${hoverData.change >= 0 ? "+" : ""}${formatPrice(hoverData.change)}` : "—"}
                    {hoverData.changePct !== null ? ` • ${hoverData.changePct >= 0 ? "+" : ""}${hoverData.changePct.toFixed(2)}%` : ""}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span className="muted" style={{ fontSize: 12 }}>Price</span>
                <span style={{ fontWeight: 900, fontSize: 12 }}>
                  {formatPrice(hoverData.close)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
            Move the crosshair over the chart to inspect OHLC, volume, and candle change.
          </div>
        )}
      </div>
    </div>
  );
}

function MiniHover({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,.06)",
        background: "rgba(255,255,255,.03)",
        padding: "6px 8px",
      }}
    >
      <div
        className="muted"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 4, fontWeight: 800, fontSize: 12 }}>{value}</div>
    </div>
  );
}