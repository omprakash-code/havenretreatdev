"use client";

import { motion } from "framer-motion";
import {
  Package as PackageIcon,
  User,
  Sparkles,
  Gift,
  CreditCard,
  Check,
} from "lucide-react";

type Props = {
  currentStep: number;
  className?: string;
  extrasSubProgress?: {
    current: number;
    total: number;
  };
};

const steps = [
  { label: "Package", icon: PackageIcon },
  { label: "Contact", icon: User },
  { label: "Occasion", icon: Sparkles },
  { label: "Add-ons", icon: Gift },
  { label: "Payment", icon: CreditCard },
];

const CIRCLE_SIZE = 26;
const LINE_HEIGHT = 2;

export default function StepIndicator({
  currentStep,
  className = "",
  extrasSubProgress,
}: Props) {
  const clampedStep = Math.max(1, Math.min(currentStep, steps.length));
  const previousStep = Math.max(clampedStep - 1, 1);
  const progressPercent =
    ((clampedStep - 1) / (steps.length - 1)) * 100;
  const initialPercent =
    ((previousStep - 1) / (steps.length - 1)) * 100;
  const normalizedExtrasSubProgress =
    extrasSubProgress && extrasSubProgress.total > 0
      ? {
          total: extrasSubProgress.total,
          current: Math.max(
            1,
            Math.min(extrasSubProgress.current, extrasSubProgress.total)
          ),
        }
      : null;

  return (
    <div className={`w-full max-w-6xl mx-auto px-2 py-2 ${className}`}>
      <div className="relative flex items-center justify-between">
        {/* Base line (constrained under circles) */}
        <div
          className="absolute bg-[#d7e4e1]"
          style={{
            height: LINE_HEIGHT,
            left: CIRCLE_SIZE / 2,
            right: CIRCLE_SIZE / 2,
            top: CIRCLE_SIZE / 2 - LINE_HEIGHT / 2,
          }}
        />

        {/* Progress line */}
        <motion.div
          initial={{ width: `${initialPercent}%` }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="absolute bg-[#347f7c]"
          style={{
            height: LINE_HEIGHT,
            left: CIRCLE_SIZE / 2,
            top: CIRCLE_SIZE / 2 - LINE_HEIGHT / 2,
            maxWidth: `calc(100% - ${CIRCLE_SIZE}px)`,
          }}
        />

        {steps.map((step, index) => {
          const stepNo = index + 1;
          const isCompleted = stepNo < clampedStep;
          const isActive = stepNo === clampedStep;
          const Icon = step.icon;
          const showExtrasSubProgress =
            stepNo === 4 && isActive && normalizedExtrasSubProgress;

          return (
            <div
              key={step.label}
              className="relative z-10 flex flex-col items-center"
              style={{ width: CIRCLE_SIZE }}
            >
              {/* Circle */}
              <motion.div
                animate={{ scale: isActive ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="w-[26px] h-[26px] rounded-full flex items-center justify-center border transition-colors duration-300"
                style={{
                  backgroundColor:
                    isCompleted || isActive ? "#347f7c" : "#ffffff",
                  borderColor:
                    isCompleted || isActive ? "#347f7c" : "#d7e4e1",
                  color:
                    isCompleted || isActive ? "#ffffff" : "#9ca3af",
                }}
              >
                {isCompleted ? (
                  <Check size={14} strokeWidth={2.5} />
                ) : showExtrasSubProgress ? (
                  <span className="text-[8px] font-semibold leading-none">
                    {normalizedExtrasSubProgress.current}/
                    {normalizedExtrasSubProgress.total}
                  </span>
                ) : (
                  <Icon size={12} strokeWidth={2.2} />
                )}
              </motion.div>

              {/* Label */}
              <span
                className={`mt-1 text-[10px] sm:text-[10px] text-center transition-colors
                  ${
                    isActive
                      ? "text-[#245e5b] font-semibold"
                      : isCompleted
                      ? "text-[#347f7c]"
                      : "text-gray-400"
                  }
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
