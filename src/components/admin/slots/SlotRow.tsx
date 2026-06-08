"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Eye, Pencil, Info, Trash } from "@/components/icons";
import SlotStatusPill from "./SlotStatusPill";
import type { AdminSlot } from "@/types/admin/slot-admin";
import { isPastSlot } from "@/lib/slot-utils";
import {
    formatSlotTime,
    formatIST,
    formatDuration,
    formatISTDate,
} from "@/lib/formatters";

export default function SlotRow({
    slot,
    selected,
    onSelect,
    onView,
    onEdit,
    onDelete,
    hideSelectionColumn = false,
    loading,
    srNo,
}: {
    slot: AdminSlot;
    selected: boolean;
    onSelect: () => void;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStatus: (slotId: string, enabled: boolean) => void;
    hideSelectionColumn?: boolean;
    loading?: boolean;
    srNo: number;
}) {
    const [bookedInfoOpen, setBookedInfoOpen] = useState(false);
    const [overrideInfoOpen, setOverrideInfoOpen] = useState(false);
    const [customInfoOpen, setCustomInfoOpen] = useState(false);
    const [deleteInfoOpen, setDeleteInfoOpen] = useState(false);
    const bookedTriggerRef = useRef<HTMLButtonElement | null>(null);
    const bookedTooltipRef = useRef<HTMLDivElement | null>(null);
    const overrideTriggerRef = useRef<HTMLButtonElement | null>(null);
    const overrideTooltipRef = useRef<HTMLDivElement | null>(null);
    const customTriggerRef = useRef<HTMLButtonElement | null>(null);
    const customTooltipRef = useRef<HTMLDivElement | null>(null);
    const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
    const deleteTooltipRef = useRef<HTMLDivElement | null>(null);
    const bookedTooltipId = useId();
    const overrideTooltipId = useId();
    const customTooltipId = useId();
    const deleteTooltipId = useId();

    const isLocked = slot.status === "LOCKED";
    const isDisabled = slot.status === "DISABLED";
    const isBooked = slot.status === "BOOKED" || slot.bookingCount > 0;

    const past = isPastSlot(slot);
    const pastSlot =
        past &&
        slot.bookingCount === 0 &&
        slot.status === "AVAILABLE";

    const derivedStatus = isLocked
        ? "LOCKED"
        : isDisabled
            ? "DISABLED"
            : isBooked
                ? "BOOKED"
                : "AVAILABLE";

    useEffect(() => {
        if (!bookedInfoOpen && !overrideInfoOpen && !customInfoOpen && !deleteInfoOpen) return;

        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;

            if (
                bookedTriggerRef.current?.contains(target) ||
                bookedTooltipRef.current?.contains(target)
            ) {
                return;
            }

            if (
                overrideTriggerRef.current?.contains(target) ||
                overrideTooltipRef.current?.contains(target)
            ) {
                return;
            }

            if (
                customTriggerRef.current?.contains(target) ||
                customTooltipRef.current?.contains(target)
            ) {
                return;
            }

            if (
                deleteTriggerRef.current?.contains(target) ||
                deleteTooltipRef.current?.contains(target)
            ) {
                return;
            }

            setBookedInfoOpen(false);
            setOverrideInfoOpen(false);
            setCustomInfoOpen(false);
            setDeleteInfoOpen(false);
        };

        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setBookedInfoOpen(false);
            setOverrideInfoOpen(false);
            setCustomInfoOpen(false);
            setDeleteInfoOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onEscape);

        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onEscape);
        };
    }, [bookedInfoOpen, overrideInfoOpen, customInfoOpen, deleteInfoOpen]);

    return (
        <tr
            className={`group border-t border-neutral-200 text-[13px] transition-colors
        ${loading ? "opacity-60 pointer-events-none" : "hover:bg-neutral-50"}
      `}
        >
            {/* Checkbox */}
            <td className={`w-10 py-3 pl-5 pr-3 ${hideSelectionColumn ? "hidden" : ""}`}>
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onSelect}
                        className="h-4 w-4 rounded-sm accent-neutral-900"
                    />
                </div>
            </td>

            <td className={hideSelectionColumn ? "py-3 pl-5 pr-3 text-neutral-500" : "px-3 py-3 text-neutral-500"}>{srNo}</td>

            <td className="px-3 py-3 font-medium whitespace-nowrap">
                {formatISTDate(slot.date)}
            </td>

            <td className="px-3 py-3">{slot.theatre.name}</td>

            <td className="px-3 py-3 whitespace-nowrap">
                <div className="flex items-center gap-1">
                    <span>{formatSlotTime(slot.startTime, slot.endTime)}</span>
                    {slot.isCustomSlot && (
                        <div className="relative inline-flex items-center">
                            <button
                                ref={customTriggerRef}
                                type="button"
                                aria-label="Custom slot information"
                                aria-haspopup="dialog"
                                aria-expanded={customInfoOpen}
                                aria-controls={customTooltipId}
                                onMouseEnter={() => setCustomInfoOpen(true)}
                                onMouseLeave={() => setCustomInfoOpen(false)}
                                onFocus={() => setCustomInfoOpen(true)}
                                onBlur={(event) => {
                                    const next = event.relatedTarget as Node | null;
                                    if (next && customTooltipRef.current?.contains(next)) return;
                                    setCustomInfoOpen(false);
                                }}
                                onClick={() => setCustomInfoOpen((prev) => !prev)}
                                className="inline-flex cursor-pointer items-center justify-center rounded-sm outline-none"
                            >
                                <span className="h-2 w-2 rounded-full bg-violet-500" />
                            </button>
                            <div
                                ref={customTooltipRef}
                                id={customTooltipId}
                                role="tooltip"
                                tabIndex={-1}
                                className={`absolute bottom-full mb-2 left-1/2 z-50 w-56 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 whitespace-normal break-words rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 shadow-lg transition-opacity duration-75 ${
                                    customInfoOpen
                                        ? "opacity-100"
                                        : "pointer-events-none opacity-0"
                                }`}
                            >
                                This slot was created manually by admin.
                            </div>
                        </div>
                    )}
                </div>
            </td>

            <td className="px-3 py-3 whitespace-nowrap">
                {formatDuration(slot.durationMin)}
            </td>

            <td className="px-3 py-3 font-semibold whitespace-nowrap">
                ${slot.pricing.final.toLocaleString()}
                {slot.pricing.sale && (
                    <span className="ml-2 text-xs text-neutral-500 line-through">
                        ${slot.pricing.regular}
                    </span>
                )}
            </td>

            {/* STATUS + TOGGLE */}
            <td className="px-3 py-3 whitespace-nowrap w-34">
                <div className="flex items-center gap-2 justify-start">
                    <div className="flex items-center gap-1 w-[100px] relative group/status">
                        {!pastSlot && (
                            <SlotStatusPill status={derivedStatus} />
                        )}

                        {pastSlot && (
                            <span
                                title="This slot has already ended"
                                className="w-22 text-center bg-blue-50 text-blue-700 border border-blue-300 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                            >
                                PAST
                            </span>
                        )}

                        <div className="flex items-center">
                            {isBooked && (
                                <div className="relative inline-flex items-center">
                                    <button
                                        ref={bookedTriggerRef}
                                        type="button"
                                        aria-label="Why this slot cannot be disabled"
                                        aria-haspopup="dialog"
                                        aria-expanded={bookedInfoOpen}
                                        aria-controls={bookedTooltipId}
                                        onMouseEnter={() => setBookedInfoOpen(true)}
                                        onMouseLeave={() => setBookedInfoOpen(false)}
                                        onFocus={() => setBookedInfoOpen(true)}
                                        onBlur={(event) => {
                                            const next = event.relatedTarget as Node | null;
                                            if (next && bookedTooltipRef.current?.contains(next)) return;
                                            setBookedInfoOpen(false);
                                        }}
                                        onClick={() => setBookedInfoOpen((prev) => !prev)}
                                        className="inline-flex cursor-pointer items-center justify-center rounded-sm text-neutral-400 outline-none transition hover:text-neutral-600 focus-visible:text-neutral-700"
                                    >
                                        <Info size={16} />
                                    </button>

                                    {/* Tooltip */}
                                    <div
                                        ref={bookedTooltipRef}
                                        id={bookedTooltipId}
                                        role="tooltip"
                                        tabIndex={-1}
                                        className={`absolute bottom-full mb-2 left-1/2 z-50 w-56 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 whitespace-normal break-words rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 shadow-lg transition-opacity duration-75 ${
                                            bookedInfoOpen
                                                ? "opacity-100"
                                                : "pointer-events-none opacity-0"
                                        }`}
                                    >
                                        Booked slots cannot be disabled
                                    </div>
                                </div>
                            )}
                        </div>

                         {slot.isOverridden && (
                            <div className="relative inline-flex items-center">
                                <button
                                    ref={overrideTriggerRef}
                                    type="button"
                                    aria-label="Slot override information"
                                    aria-haspopup="dialog"
                                    aria-expanded={overrideInfoOpen}
                                    aria-controls={overrideTooltipId}
                                    onMouseEnter={() => setOverrideInfoOpen(true)}
                                    onMouseLeave={() => setOverrideInfoOpen(false)}
                                    onFocus={() => setOverrideInfoOpen(true)}
                                    onBlur={(event) => {
                                        const next = event.relatedTarget as Node | null;
                                        if (next && overrideTooltipRef.current?.contains(next)) return;
                                        setOverrideInfoOpen(false);
                                    }}
                                    onClick={() => setOverrideInfoOpen((prev) => !prev)}
                                    className="inline-flex cursor-pointer items-center justify-center rounded-sm outline-none"
                                >
                                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                                </button>
                                <div
                                    ref={overrideTooltipRef}
                                    id={overrideTooltipId}
                                    role="tooltip"
                                    tabIndex={-1}
                                    className={`absolute bottom-full mb-2 left-1/2 z-50 w-56 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 whitespace-normal break-words rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 shadow-lg transition-opacity duration-75 ${
                                        overrideInfoOpen
                                            ? "opacity-100"
                                            : "pointer-events-none opacity-0"
                                    }`}
                                >
                                    This slot was manually modified
                                </div>
                            </div>
                        )}
                    </div>


                </div>

                {loading && (
                    <span className="text-[11px] text-neutral-400 ml-2">
                        Updating…
                    </span>
                )}
            </td>

            <td className="px-3 py-3 text-neutral-500 leading-tight whitespace-nowrap">
                <div>{formatIST(slot.createdAt).split(",")[0]}</div>
                <div className="text-xs">
                    {formatIST(slot.createdAt).split(",")[1]}
                </div>
            </td>

            {/* Actions */}
            <td className="py-3 pl-3 pr-5 whitespace-nowrap">
                <div className="flex items-center gap-1">
                    {/* View */}
                    <button
                        onClick={onView}
                        title="View slot details"
                        className="inline-flex w-8 h-8 cursor-pointer items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 opacity-0 opacity-100 transition">
                        <Eye size={15} />
                    </button>

                    {/* Edit */}
                    <button
                        onClick={onEdit}
                        title="Edit slot"
                        className="inline-flex w-8 h-8 cursor-pointer items-center justify-center rounded-md text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition opacity-0 opacity-100">
                        <Pencil size={15} />
                    </button>

                    {/* Delete */}
                    <div className="relative inline-flex items-center">
                        <button
                            ref={deleteTriggerRef}
                            onClick={() => {
                                if (slot.canDelete) {
                                    onDelete();
                                    return;
                                }
                                setDeleteInfoOpen((prev) => !prev);
                            }}
                            aria-label={slot.canDelete ? "Delete slot" : "Slot cannot be deleted"}
                            aria-haspopup={slot.canDelete ? undefined : "dialog"}
                            aria-expanded={slot.canDelete ? undefined : deleteInfoOpen}
                            aria-controls={slot.canDelete ? undefined : deleteTooltipId}
                            onMouseEnter={() => {
                                if (!slot.canDelete) setDeleteInfoOpen(true);
                            }}
                            onMouseLeave={() => {
                                if (!slot.canDelete) setDeleteInfoOpen(false);
                            }}
                            onFocus={() => {
                                if (!slot.canDelete) setDeleteInfoOpen(true);
                            }}
                            onBlur={(event) => {
                                if (slot.canDelete) return;
                                const next = event.relatedTarget as Node | null;
                                if (next && deleteTooltipRef.current?.contains(next)) return;
                                setDeleteInfoOpen(false);
                            }}
                            className={`inline-flex w-8 h-8 items-center justify-center rounded-md transition ${
                                slot.canDelete
                                    ? "cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
                                    : "cursor-not-allowed text-slate-300"
                            }`}
                        >
                            <Trash size={15} />
                        </button>

                        {!slot.canDelete && (
                            <div
                                ref={deleteTooltipRef}
                                id={deleteTooltipId}
                                role="tooltip"
                                tabIndex={-1}
                                className={`absolute bottom-full mb-2 right-0 z-50 w-56 max-w-[calc(100vw-1.5rem)] whitespace-normal break-words rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 shadow-lg transition-opacity duration-75 ${
                                    deleteInfoOpen
                                        ? "opacity-100"
                                        : "pointer-events-none opacity-0"
                                }`}
                            >
                                {slot.deleteDisabledReason || "This slot cannot be deleted."}
                            </div>
                        )}
                    </div>
                </div>
            </td>

        </tr>
    );
}
