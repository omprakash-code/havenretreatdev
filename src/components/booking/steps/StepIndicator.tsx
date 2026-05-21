"use client";

import { motion } from "framer-motion";
import {
  Package as PackageIcon,
  User,
  Sparkles,
  Gift,
  FileSignature,
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
  { label: "Agreement", icon: FileSignature },
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
      <div className="relative grid grid-cols-6 items-start">
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
              className="relative flex flex-col items-center"
            >
              {index < steps.length - 1 ? (
                <div
                  className={`absolute ${
                    stepNo < clampedStep ? "bg-[#347f7c]" : "bg-[#d7e4e1]"
                  }`}
                  style={{
                    height: LINE_HEIGHT,
                    left: `calc(50% + ${CIRCLE_SIZE / 2}px)`,
                    right: `calc(-50% + ${CIRCLE_SIZE / 2}px)`,
                    top: CIRCLE_SIZE / 2 - LINE_HEIGHT / 2,
                  }}
                />
              ) : null}

              {/* Circle */}
              <motion.div
                animate={{ scale: isActive ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="relative z-10 w-[26px] h-[26px] rounded-full flex items-center justify-center border transition-colors duration-300"
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
