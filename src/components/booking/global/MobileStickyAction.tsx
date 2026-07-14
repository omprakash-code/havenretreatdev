"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "@/components/icons";

type MobileStickyActionProps = {
  label: string;
  onClick?: () => void;
  onInvalidClick?: () => void;
  disabled?: boolean;
  hidden?: boolean;
  isInvalid?: boolean;
  enableInvalidSubmitFeedback?: boolean;
  invalidSubmitMessage?: string;
  totalPrice?: number | null;
  advancePay?: number | null;
  showArrow?: boolean;
  className?: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function MobileStickyAction({
  label,
  onClick,
  onInvalidClick,
  disabled = false,
  hidden = false,
  isInvalid = false,
  enableInvalidSubmitFeedback = false,
  invalidSubmitMessage = "Please fill details to continue.",
  totalPrice,
  advancePay,
  showArrow = true,
  className = "",
}: MobileStickyActionProps) {
  const [showInvalidError, setShowInvalidError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const hasPrice = typeof totalPrice === "number" && Number.isFinite(totalPrice);
  const resolvedAdvancePay =
    typeof advancePay === "number" && Number.isFinite(advancePay)
      ? Math.max(advancePay, 0)
      : null;
  const shouldShowInvalidError = showInvalidError && isInvalid;

  useEffect(() => {
    if (!showInvalidError) return;
    const timeoutId = window.setTimeout(() => {
      setIsShaking(false);
    }, 380);
    return () => window.clearTimeout(timeoutId);
  }, [showInvalidError]);

  useEffect(() => {
    if (!showInvalidError) return;
    const timeoutId = window.setTimeout(() => {
      setShowInvalidError(false);
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [showInvalidError]);

  const handleClick = () => {
    if (disabled) return;
    if (enableInvalidSubmitFeedback && isInvalid) {
      setShowInvalidError(true);
      setIsShaking(false);
      window.requestAnimationFrame(() => {
        setIsShaking(true);
      });
      onInvalidClick?.();
      return;
    }
    setShowInvalidError(false);
    onClick?.();
  };

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/45 bg-white/90 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-12px_28px_rgba(15,23,42,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 lg:hidden ${className}`.trim()}
    >
      <div className="w-full max-w-7xl">
        {shouldShowInvalidError && (
          <p className="mb-1.5 text-center text-xs text-red-600">
            {invalidSubmitMessage}
          </p>
        )}
        {hasPrice && resolvedAdvancePay !== null && (
          <div className="mb-2 border-b border-[#d7e4e1] px-1 pb-2 text-center">
            <p className="truncate whitespace-nowrap text-xs text-gray-700">
              No payment is required today.
            </p>
          </div>
        )}
        <div
          className={`flex w-full items-end gap-3 ${
            hasPrice ? "justify-between" : "justify-end"
          }`}
        >
          {hasPrice && (
            <div className="min-w-[80px] pb-1 text-left">
              <p className="text-sm font-semibold text-gray-500">Total Price</p>
              <p className="text-xl font-bold leading-tight text-black">
                {formatCurrency(Number(totalPrice))}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={`mobile-sticky-action-btn inline-flex min-w-[132px] scale-[0.92] origin-right items-center justify-center gap-2 border border-[#347f7c] bg-[#347f7c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500 ${
              isShaking && isInvalid ? "is-shaking" : ""
            }`}
          >
            <span>{label}</span>
            {showArrow ? <ArrowRight size={14} /> : null}
          </button>
        </div>
      </div>
      <style jsx>{`
        .mobile-sticky-action-btn.is-shaking {
          animation: stickyActionShake 0.35s ease-in-out;
        }

        @keyframes stickyActionShake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-4px);
          }
          40% {
            transform: translateX(4px);
          }
          60% {
            transform: translateX(-3px);
          }
          80% {
            transform: translateX(3px);
          }
        }
      `}</style>
    </div>
  );
}
