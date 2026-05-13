// src/components/admin/slots/drawer/EditSlotDetails.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AdminSlot } from "@/types/admin/slot-admin";
import { toast } from "sonner";

import SlotTimingTab, {
    type SlotTimingPayload,
    type SlotTimingTabHandle,
    type SlotTimingTabMeta,
} from "./tabs/SlotTimingTab";
import SlotPricingTab, {
    type SlotPricingPayload,
    type SlotPricingTabHandle,
    type SlotPricingTabMeta,
} from "./tabs/SlotPricingTab";
import SlotStatusTab, {
    type SlotStatusPayload,
    type SlotStatusTabHandle,
    type SlotStatusTabMeta,
} from "./tabs/SlotStatusTab";
import SlotAuditTab from "./tabs/SlotAuditTab";

type Props = {
    slotId: string;
    onCancel: () => void;
    onUpdated?: (updated: AdminSlot) => void;
};

type PatchSlotPayload =
    | {
        timing: { startTime: string; endTime: string };
        overrideReason: string;
    }
    | {
        pricing: {
            regularPrice: number;
            salePrice: number | null;
        };
        overrideReason: string;
    }
    | {
        status: {
            value: "AVAILABLE" | "DISABLED";
            discountText?: string | null;
        };
        overrideReason: string;
    };




function TabButton({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
        relative px-3 py-2 text-sm font-medium transition-colors
        ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}
      `}
        >
            {active && (
                <motion.div
                    layoutId="activeEditSlotTab"
                    className="absolute inset-0 border-b-2 border-black -mx-px"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            )}
            <span className="relative">{label}</span>
        </button>
    );
}


export default function EditSlotDetails({ slotId, onCancel, onUpdated }: Props) {

    const [slot, setSlot] = useState<AdminSlot | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingAll, setSavingAll] = useState(false);
    const [sharedReason, setSharedReason] = useState("");
    const [sharedReasonError, setSharedReasonError] = useState<string | null>(null);
    const [timingMeta, setTimingMeta] = useState<SlotTimingTabMeta>({
        hasChanges: false,
        canSubmit: true,
    });
    const [pricingMeta, setPricingMeta] = useState<SlotPricingTabMeta>({
        hasChanges: false,
        canSubmit: true,
    });
    const [statusMeta, setStatusMeta] = useState<SlotStatusTabMeta>({
        hasChanges: false,
        canSubmit: true,
        hasVisibilityChange: false,
        hasMessageChange: false,
    });

    const [activeTab, setActiveTab] =
        useState<"edit" | "audit">("edit");
    const sharedReasonRef = useRef<HTMLTextAreaElement | null>(null);
    const timingRef = useRef<SlotTimingTabHandle | null>(null);
    const pricingRef = useRef<SlotPricingTabHandle | null>(null);
    const statusRef = useRef<SlotStatusTabHandle | null>(null);

    useEffect(() => {
        let active = true;

        async function fetchSlot() {
            setLoading(true);

            try {
                const res = await fetch(`/api/admin/slots/${slotId}`);
                if (!res.ok) {
                    throw new Error("Failed to fetch slot");
                }

                const json = await res.json();

                if (!json || !json.success) {
                    throw new Error(json?.message || "Invalid response");
                }

                if (active && json.success) {
                    setSlot(json.data);
                }

                if (active) setLoading(false);
            } catch (error) {
                console.error("Error fetching slot:", error);
                if (active) setLoading(false);
            }
        }

        fetchSlot();

        return () => {
            active = false;
        };
    }, [slotId]);


    async function patchSlot(payload: PatchSlotPayload) {
        const res = await fetch(`/api/admin/slots/${slotId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        let json;
        try {
            json = await res.json();
        } catch {
            throw new Error("Invalid server response");
        }

        if (!res.ok || !json.success) {
            const error = {
                code: json?.code,
                message: json?.message || "Update failed",
                details: json?.details,
            };

            throw error;
        }

        setSlot(json.data);
        onUpdated?.(json.data);
    }

    const isLocked = slot?.status === "LOCKED";
    const isBooked = slot?.status === "BOOKED";
    const isEditDisabled = isLocked || isBooked;
    const hasAnyChanges =
        timingMeta.hasChanges || pricingMeta.hasChanges || statusMeta.hasChanges;
    const reasonRequired =
        timingMeta.hasChanges ||
        pricingMeta.hasChanges ||
        statusMeta.hasVisibilityChange;
    const canSaveChanges =
        hasAnyChanges &&
        timingMeta.canSubmit &&
        pricingMeta.canSubmit &&
        statusMeta.canSubmit &&
        !isEditDisabled;

    useEffect(() => {
        if (!sharedReasonError) return;
        if (!reasonRequired || sharedReason.trim().length >= 10) {
            setSharedReasonError(null);
        }
    }, [reasonRequired, sharedReason, sharedReasonError]);

    async function handleSaveAllChanges() {
        if (!canSaveChanges || savingAll) return;

        try {
            setSavingAll(true);
            const reasonForSave = sharedReason.trim();
            if (reasonRequired && reasonForSave.length < 10) {
                setSharedReasonError("Reason must be at least 10 characters.");
                window.requestAnimationFrame(() => {
                    sharedReasonRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
                    sharedReasonRef.current?.focus();
                });
                return;
            }
            setSharedReasonError(null);
            const savedSections: string[] = [];

            if (timingMeta.hasChanges) {
                const saved = await timingRef.current?.submit(reasonForSave);
                if (saved) savedSections.push("timing");
            }

            if (pricingMeta.hasChanges) {
                const saved = await pricingRef.current?.submit(reasonForSave);
                if (saved) savedSections.push("pricing");
            }

            if (statusMeta.hasChanges) {
                const saved = await statusRef.current?.submit(reasonForSave);
                if (saved) savedSections.push("status");
            }

            if (savedSections.length === 0) return;

            const description =
                savedSections.length === 1
                    ? `Updated ${savedSections[0]} settings.`
                    : `Updated ${savedSections.join(", ")} settings.`;

            toast.success("Slot updated", { description });
            setSharedReason("");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to save slot changes.";
            toast.error("Failed to save slot changes", { description: message });
        } finally {
            setSavingAll(false);
        }
    }

    if (loading || !slot) {
        return (
            <div className="p-6 text-sm text-slate-500">
                Loading slot details…
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Tabs header – reuse same TabButton style */}
            <div className="mb-3 -mx-6 flex gap-1 border-b border-slate-200 px-6">
                <TabButton
                    active={activeTab === "edit"}
                    onClick={() => setActiveTab("edit")}
                    label="Edit Slot"
                />
                <TabButton
                    active={activeTab === "audit"}
                    onClick={() => setActiveTab("audit")}
                    label="Audit"
                />
            </div>

            {/* (Use same TabButton component you already have) */}

            <div className="flex-1 overflow-y-auto space-y-3">
                <AnimatePresence mode="wait">
                    {activeTab === "edit" && (
                        <motion.div key="edit" className="space-y-3">
                            <SlotStatusTab
                                ref={statusRef}
                                slot={slot}
                                disabled={isEditDisabled}
                                onMetaChange={setStatusMeta}
                                onSave={async ({ status, reason, discountText }: SlotStatusPayload) => {
                                    await patchSlot({
                                        status: {
                                            value: status,
                                            discountText,
                                        },
                                        overrideReason: reason,
                                    });

                                }}
                            />
                            <SlotTimingTab
                                ref={timingRef}
                                slot={slot}
                                disabled={isEditDisabled}
                                onMetaChange={setTimingMeta}
                                onSave={async ({ startTime, endTime, reason }: SlotTimingPayload) => {
                                    await patchSlot({
                                        timing: { startTime, endTime },
                                        overrideReason: reason,
                                    });
                                }}
                            />
                            <SlotPricingTab
                                ref={pricingRef}
                                slot={slot}
                                disabled={isEditDisabled}
                                onMetaChange={setPricingMeta}
                                onSave={async ({ regularPrice, salePrice, reason }: SlotPricingPayload) => {
                                    await patchSlot({
                                        pricing: {
                                            regularPrice,
                                            salePrice,
                                        },
                                        overrideReason: reason,
                                    });
                                }}

                            />

                            {hasAnyChanges && (
                                <div className="space-y-1 rounded-lg border border-slate-200 p-3">
                                    <label className="text-xs font-medium text-slate-700">
                                        Reason for Changes
                                        {reasonRequired && (
                                            <span className="text-red-500"> *</span>
                                        )}
                                    </label>
                                    <textarea
                                        ref={sharedReasonRef}
                                        rows={3}
                                        value={sharedReason}
                                        onChange={(event) => {
                                            setSharedReason(event.target.value);
                                            if (sharedReasonError) {
                                                setSharedReasonError(null);
                                            }
                                        }}
                                        placeholder="e.g. Maintenance update / pricing revision"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    />
                                    <p className="text-[11px] text-slate-500">
                                        Required for timing, pricing, and visibility changes. Optional for offer message-only update.
                                    </p>
                                    {sharedReasonError && (
                                        <p className="text-[11px] text-red-600">{sharedReasonError}</p>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === "audit" && (
                        <SlotAuditTab slot={slot} />
                    )}
                </AnimatePresence>
            </div>

            {activeTab === "edit" && (
                <div className="mt-2 border-t border-slate-200 pt-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={savingAll}
                            className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSaveAllChanges()}
                            disabled={!canSaveChanges || savingAll}
                            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {savingAll ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
