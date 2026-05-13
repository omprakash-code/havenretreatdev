"use client";

const STEPS = [
  "Package",
  "Details",
  "Occasion",
  "Add-ons",
  "Agreement",
  "Payment",
];

export default function VenueBookingStepIndicator({
  currentStep,
}: {
  currentStep: number;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-[#d8e4e2] bg-white px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">
        {STEPS.map((label, index) => {
          const stepNo = index + 1;
          const isActive = stepNo === currentStep;
          const isCompleted = stepNo < currentStep;

          return (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                  isActive || isCompleted
                    ? "border-[#347f7c] bg-[#347f7c] text-white"
                    : "border-[#d0d5dd] bg-white text-[#667085]"
                }`}
              >
                {stepNo}
              </div>
              <span
                className={`text-sm ${
                  isActive
                    ? "font-semibold text-[#101828]"
                    : isCompleted
                    ? "text-[#344054]"
                    : "text-[#667085]"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
