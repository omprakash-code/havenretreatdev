"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PEN_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23111827%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z%22/%3E%3Cpath d=%22m15 5 4 4%22/%3E%3C/svg%3E") 3 21, crosshair';

export default function SignaturePad({
  value,
  onChange,
  disabled = false,
  flat = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  flat?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasDrawnRef = useRef(false);
  const renderedValueRef = useRef<string | null>(null);
  const drawRequestRef = useRef(0);
  const historyRef = useRef<Array<string | null>>([null]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryControls = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const configureContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const context = canvas.getContext("2d");
    if (!context) return null;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio =
      typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 1) : 1;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.fillStyle = "#111827";

    return { canvas, context, width, height };
  }, []);

  const getCanvasSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) return null;
    return canvas.toDataURL("image/png");
  }, []);

  const drawSnapshot = useCallback((snapshot: string | null) => {
    const requestId = ++drawRequestRef.current;
    const configured = configureContext();
    if (!configured) return;

    configured.context.clearRect(0, 0, configured.width, configured.height);
    if (!snapshot) {
      hasDrawnRef.current = false;
      renderedValueRef.current = null;
      return;
    }

    const image = new Image();
    image.onload = () => {
      if (requestId !== drawRequestRef.current) return;
      const refreshed = configureContext();
      if (!refreshed) return;
      refreshed.context.clearRect(0, 0, refreshed.width, refreshed.height);
      refreshed.context.drawImage(
        image,
        0,
        0,
        refreshed.width,
        refreshed.height
      );
      hasDrawnRef.current = true;
      renderedValueRef.current = snapshot;
    };
    image.src = snapshot;
  }, [configureContext]);

  const commitSnapshot = (snapshot: string | null) => {
    const currentSnapshot = historyRef.current[historyIndexRef.current] ?? null;
    if (snapshot === currentSnapshot) return;

    historyRef.current = [
      ...historyRef.current.slice(0, historyIndexRef.current + 1),
      snapshot,
    ];
    historyIndexRef.current = historyRef.current.length - 1;
    syncHistoryControls();
    renderedValueRef.current = snapshot;
    onChange(snapshot);
  };

  useEffect(() => {
    // A locally committed stroke is already on the canvas. Redrawing it here
    // clears the pixels between pointer-up and asynchronous image decoding.
    if (value === renderedValueRef.current) return;
    drawSnapshot(value);
  }, [drawSnapshot, value]);

  useEffect(() => {
    const handleResize = () => {
      const snapshot = getCanvasSnapshot() ?? renderedValueRef.current;
      drawSnapshot(snapshot);
    };

    handleResize();
    const canvas = canvasRef.current;
    const resizeObserver =
      canvas && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResize)
        : null;
    if (canvas) resizeObserver?.observe(canvas);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [drawSnapshot, getCanvasSnapshot]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.preventDefault();
    const configured = configureContext();
    const point = getPoint(event);
    if (!configured || !point) return;

    drawingRef.current = true;
    lastPointRef.current = point;
    configured.canvas.setPointerCapture(event.pointerId);
    configured.context.beginPath();
    configured.context.moveTo(point.x, point.y);
    configured.context.arc(point.x, point.y, 0.8, 0, Math.PI * 2);
    configured.context.fill();
    hasDrawnRef.current = true;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if (!drawingRef.current) return;
    event.preventDefault();
    const configured = configureContext();
    const point = getPoint(event);
    const lastPoint = lastPointRef.current;
    if (!configured || !point || !lastPoint) return;

    const midpoint = {
      x: (lastPoint.x + point.x) / 2,
      y: (lastPoint.y + point.y) / 2,
    };

    configured.context.quadraticCurveTo(lastPoint.x, lastPoint.y, midpoint.x, midpoint.y);
    configured.context.stroke();
    lastPointRef.current = point;
    hasDrawnRef.current = true;
  };

  const handlePointerUp = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event?.preventDefault();
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const nextSnapshot = getCanvasSnapshot();
    commitSnapshot(nextSnapshot);
  };

  const handleClear = () => {
    const configured = configureContext();
    if (!configured) return;
    configured.context.clearRect(0, 0, configured.width, configured.height);
    drawingRef.current = false;
    lastPointRef.current = null;
    hasDrawnRef.current = false;
    commitSnapshot(null);
  };

  const handleUndo = () => {
    if (disabled) return;
    if (historyIndexRef.current <= 0) return;

    historyIndexRef.current -= 1;
    const previousSnapshot = historyRef.current[historyIndexRef.current] ?? null;
    drawSnapshot(previousSnapshot);
    syncHistoryControls();
    onChange(previousSnapshot);
  };

  const handleRedo = () => {
    if (disabled) return;
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    historyIndexRef.current += 1;
    const nextSnapshot = historyRef.current[historyIndexRef.current] ?? null;
    drawSnapshot(nextSnapshot);
    syncHistoryControls();
    onChange(nextSnapshot);
  };

  return (
    <div className={`${flat ? "border border-[#d0d5dd] p-4" : "rounded-2xl border border-[#d0d5dd] p-4"}`}>
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={disabled ? undefined : { cursor: PEN_CURSOR }}
        className={`h-44 w-full touch-none border ${
          disabled
            ? "cursor-not-allowed border-[#eaecf0] bg-[#f2f4f7] opacity-70"
            : "border-transparent bg-[#f8fafc]"
        }`}
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#667085]">
          {disabled
            ? "Scroll through the agreement to unlock signing."
            : "Sign with your mouse, trackpad, or touch input."}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled || !canUndo}
            onClick={handleUndo}
            className="text-sm font-medium text-[#347f7c] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={disabled || !canRedo}
            onClick={handleRedo}
            className="text-sm font-medium text-[#347f7c] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
          >
            Redo
          </button>
          <button
            type="button"
            disabled={disabled || !value}
            onClick={handleClear}
            className="text-sm font-medium text-[#347f7c] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
