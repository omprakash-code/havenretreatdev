"use client";

import { useEffect, useRef } from "react";

export default function SignaturePad({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#111827";

    if (!value) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [value]);

  const draw = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineTo(x, y);
    context.stroke();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    drawingRef.current = true;
    context.beginPath();
    context.moveTo(x, y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    draw(event.clientX - rect.left, event.clientY - rect.top);
  };

  const handlePointerUp = () => {
    const canvas = canvasRef.current;
    drawingRef.current = false;
    onChange(canvas ? canvas.toDataURL("image/png") : null);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="rounded-2xl border border-[#d0d5dd] p-4">
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="h-44 w-full touch-none rounded-xl bg-[#f8fafc]"
      />
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-sm text-[#667085]">
          Signature pad foundation for the in-app agreement flow.
        </p>
        <button
          type="button"
          onClick={handleClear}
          className="text-sm font-medium text-[#347f7c]"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
