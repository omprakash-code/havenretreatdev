"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, IndianRupee, History } from "lucide-react";

import SlotStatusPill from "@/components/admin/slots/SlotStatusPill";
import { formatISTDate, formatSlotTime, formatDuration } from "@/lib/formatters";
import type { AdminSlot } from "@/types/admin/slot-admin";

/* ---------------------------------
   Tab Button
---------------------------------- */
function TabButton({
    active,
    onClick,
    label,
    icon: Icon,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    icon?: React.ComponentType<{ size?: number }>;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors 
                ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {active && (
                <motion.div
                    layoutId="activeSlotTab"
                    className="absolute inset-0 border-b-2 border-black -mx-px"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            )}
            <span className="relative flex items-center gap-2">
                {Icon && <Icon size={16} />}
                {label}
            </span>
        </button>
    );
}

/* ---------------------------------
   Info Row
---------------------------------- */
function InfoRow({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 mb-1">
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-sm font-medium text-slate-900 text-right">
                {value}
            </span>
        </div>
    );
}

/* ---------------------------------
   Slot Details (Final UX)
---------------------------------- */
export default function SlotDetails({ slot }: { slot: AdminSlot }) {
    const [activeTab, setActiveTab] = useState<"overview" | "audit">("overview");

    const bookings = slot.bookings ?? [];
    const hasBooking = bookings.length > 0;

    return (
        <div className="flex flex-col h-full">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 px-6 -mx-6 mb-6">
                <TabButton
                    active={activeTab === "overview"}
                    onClick={() => setActiveTab("overview")}
                    label="Overview"
                />
                <TabButton
                    active={activeTab === "audit"}
                    onClick={() => setActiveTab("audit")}
                    label="Audit"
                    icon={History}
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto space-y-6">
                <AnimatePresence mode="wait">
                    {/* ================= OVERVIEW ================= */}
                    {activeTab === "overview" && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* ================= STATUS + BOOKING ================= */}
                            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <SlotStatusPill status={slot.status} />
                                    </div>

                                    {hasBooking && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const ref = bookings[0].bookingRef;
                                                window.open(
                                                    `/admin/bookings?ref=${ref}`,
                                                    "_blank"
                                                );
                                            }}
                                            className="px-3 py-2 rounded-sm bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 cursor-pointer"
                                        >
                                            View Booking
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ================= SLOT INFO ================= */}
                            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <Calendar size={16} />
                                    Slot Details
                                </h3>

                                <div className="grid grid-cols-2 gap-2">
                                    <InfoRow
                                        label="Date"
                                        value={formatISTDate(slot.date)}
                                    />
                                    <InfoRow
                                        label="Time"
                                        value={formatSlotTime(slot.startTime, slot.endTime)}
                                    />

                                    <InfoRow
                                        label="Duration"
                                        value={formatDuration(slot.durationMin)}
                                    />
                                    <InfoRow
                                        label="Theatre"
                                        value={slot.theatre.name}
                                    />
                                </div>
                            </div>

                            {/* ================= PRICING ================= */}
                            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <IndianRupee size={16} />
                                    Pricing
                                </h3>

                                <InfoRow
                                    label="Regular Price"
                                    value={`₹${slot.pricing.regular.toLocaleString()}`}
                                />
                                {slot.pricing.sale != null && (
                                    <>
                                        <InfoRow
                                            label="Sale Price"
                                            value={`₹${slot.pricing.sale.toLocaleString()}`}
                                        />
                                        <InfoRow
                                            label="Booking Price"
                                            value={
                                                <span className="text-lg font-bold">
                                                    ₹{slot.pricing.final.toLocaleString()}
                                                </span>
                                            }
                                        />
                                    </>
                                )}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-slate-500">
                                        Special Message
                                    </span>

                                    {slot.pricing.discountText ? (
                                    <div className="inline-block text-xs text-slate-800 bg-white-50 px-2 py-1 rounded border border-slate-400">
                                        {slot.pricing.discountText}
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">
                                        No special message
                                    </span>
                                )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ================= AUDIT ================= */}
                    {activeTab === "audit" && (
                        <motion.div
                            key="audit"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                                <InfoRow
                                    label="Overridden"
                                    value={slot.isOverridden ? "Yes" : "No"}
                                />

                                {slot.isOverridden && (
                                    <>
                                        <InfoRow
                                            label="Reason"
                                            value={slot.overrideReason ?? "—"}
                                        />
                                        <InfoRow
                                            label="Modified At"
                                            value={
                                                slot.slotModifiedAt
                                                    ? formatISTDate(slot.slotModifiedAt)
                                                    : "—"
                                            }
                                        />
                                        <InfoRow
                                            label="Modified By"
                                            value={slot.slotModifiedBy ?? "—"}
                                        />
                                    </>
                                )}

                                <InfoRow
                                    label="Created At"
                                    value={formatISTDate(slot.createdAt)}
                                />
                                <InfoRow
                                    label="Last Updated"
                                    value={formatISTDate(slot.updatedAt)}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
