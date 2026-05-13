"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Clock, RotateCcw } from "lucide-react";
import type { AdminSlot } from "@/types/admin/slot-admin";
import { timeToMinutes } from "@/lib/time";
import { formatDuration, formatSlotTime } from "@/lib/formatters";

type ApiErrorResponse = {
  success?: false;
  code?: string;
  message?: string;
  details?: {
    conflictingSlot?: {
      date: string;
      startTime: string;
      endTime: string;
      bufferMin?: number;
    };
    reason?: string;
  };
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message?: unknown }).message ?? "Unexpected error occurred");
  }

  return "Unexpected error occurred";
}

function formatConflictDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function calculateDuration(start: string, end: string) {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  return endMin > startMin
    ? endMin - startMin
    : endMin + 1440 - startMin;
}

export type SlotTimingPayload = {
  startTime: string;
  endTime: string;
  reason: string;
};

export type SlotTimingTabMeta = {
  hasChanges: boolean;
  canSubmit: boolean;
};

export type SlotTimingTabHandle = {
  submit: (reason: string) => Promise<boolean>;
};

type SlotTimingTabProps = {
  slot: AdminSlot;
  disabled?: boolean;
  onSave: (payload: SlotTimingPayload) => Promise<void>;
  onMetaChange?: (meta: SlotTimingTabMeta) => void;
};

const SlotTimingTab = forwardRef<SlotTimingTabHandle, SlotTimingTabProps>(
  function SlotTimingTab({ slot, disabled, onSave, onMetaChange }, ref) {
    const [startTime, setStartTime] = useState(slot.startTime);
    const [endTime, setEndTime] = useState(slot.endTime);
    const templateStartTime = slot.template?.startTime ?? slot.startTime;
    const templateEndTime = slot.template?.endTime ?? slot.endTime;

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    const isOvernight = endMin < startMin;
    const durationMin = useMemo(
      () => calculateDuration(startTime, endTime),
      [startTime, endTime]
    );

    const isChanged = startTime !== slot.startTime || endTime !== slot.endTime;
    const isInvalid = timeToMinutes(startTime) === timeToMinutes(endTime);
    const durationTooShort = durationMin < 30;
    const canResetToTemplate =
      startTime !== templateStartTime || endTime !== templateEndTime;
    const canSubmit =
      !isChanged ||
      Boolean(
        !disabled &&
          !isInvalid &&
          !durationTooShort
      );

    useEffect(() => {
      onMetaChange?.({
        hasChanges: isChanged,
        canSubmit,
      });
    }, [canSubmit, isChanged, onMetaChange]);

    useImperativeHandle(
      ref,
      () => ({
        submit: async (reason: string) => {
          if (!isChanged) return false;
          if (disabled) throw new Error("This slot cannot be modified.");
          if (isInvalid) throw new Error("Start time and end time cannot be the same.");
          if (durationTooShort) throw new Error("Slot duration must be at least 30 minutes.");
          if (!reason.trim() || reason.trim().length < 10) {
            throw new Error("Reason for timing change is required (minimum 10 characters).");
          }

          try {
            await onSave({
              startTime,
              endTime,
              reason: reason.trim(),
            });
            return true;
          } catch (err: unknown) {
            const apiError =
              typeof err === "object" && err !== null && "code" in err
                ? (err as ApiErrorResponse)
                : null;

            if (apiError?.code === "SLOT_OVERLAP" && apiError.details?.conflictingSlot) {
              const { conflictingSlot, reason: overlapReason } = apiError.details;
              const formattedDate = formatConflictDate(conflictingSlot.date);
              const formattedTime = formatSlotTime(
                conflictingSlot.startTime,
                conflictingSlot.endTime
              );

              throw new Error(
                `Slot timing conflict with ${formattedDate} ${formattedTime}${
                  overlapReason ? ` (${overlapReason})` : ""
                }`
              );
            }

            throw new Error(getErrorMessage(err));
          }
        },
      }),
      [
        disabled,
        durationTooShort,
        endTime,
        isChanged,
        isInvalid,
        onSave,
        startTime,
      ]
    );

    return (
      <div className="space-y-2">
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock size={16} />
            Override Timing
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">Start Time</label>
              <input
                type="time"
                value={startTime}
                disabled={disabled}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">End Time</label>
              <input
                type="time"
                value={endTime}
                disabled={disabled}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="text-xs text-slate-700">
            Duration:&nbsp;
            <span className="font-semibold text-slate-900">{formatDuration(durationMin)}</span>
          </div>

          {canResetToTemplate && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setStartTime(templateStartTime);
                setEndTime(templateEndTime);
              }}
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
            >
              <RotateCcw size={14} />
              Reset to template timing
            </button>
          )}

          {isChanged && (
            <div className="text-[11px] text-slate-600">
              <span className="font-medium">Before:</span>{" "}
              {formatSlotTime(slot.startTime, slot.endTime)} <br />
              <span className="font-medium">After:</span>{" "}
              {formatSlotTime(startTime, endTime)}
            </div>
          )}

          {isInvalid && (
            <div className="inline-block rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
              Start time and end time cannot be the same.
            </div>
          )}

          {durationTooShort && (
            <div className="inline-block rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
              Slot duration must be at least 30 minutes.
            </div>
          )}

          {isChanged && isOvernight && (
            <div className="inline-block rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
              This slot will extend into the next day.
            </div>
          )}
        </div>

      </div>
    );
  }
);

export default SlotTimingTab;
