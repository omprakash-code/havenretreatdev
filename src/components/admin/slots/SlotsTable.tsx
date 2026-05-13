"use client";

import { useMemo, useState, useEffect } from "react";
import SlotRow from "./SlotRow";
import type { AdminSlot } from "@/types/admin/slot-admin";
import { toast } from "sonner";
import { toDateKey } from "@/lib/date";

const PAGE_SIZE = 40;

export default function SlotsTable({
    data,
    onView,
    onEdit,
    onDelete,
}: {
    data: AdminSlot[];
    onView: (slot: AdminSlot) => void;
    onEdit: (slot: AdminSlot) => void;
    onDelete: (slot: AdminSlot) => void;
}) {
    const [selected, setSelected] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [slots, setSlots] = useState<AdminSlot[]>(data);
    const [loadingSlots, setLoadingSlots] = useState<Record<string, boolean>>({});
    const hideSelectionColumn = true;

    const visibleSlots = useMemo(() => {
        const todayKey = toDateKey(new Date());
        return slots.filter((slot) => toDateKey(slot.date) >= todayKey);
    }, [slots]);


    const totalPages = Math.ceil(visibleSlots.length / PAGE_SIZE);
    const paginated = visibleSlots.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    const toggleAll = () =>
        setSelected(
            selected.length === paginated.length
                ? []
                : paginated.map((s) => s.id)
        );

    const toggleOne = (id: string) =>
        setSelected((prev) =>
            prev.includes(id)
                ? prev.filter((i) => i !== id)
                : [...prev, id]
        );

    useEffect(() => {
        setSlots(data);
    }, [data]);

    useEffect(() => {
        if (totalPages === 0 && page !== 1) {
            setPage(1);
            return;
        }
        if (totalPages > 0 && page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    async function handleToggleSlotStatus(slotId: string, enabled: boolean) {
        // 1. Mark slot as loading
        setLoadingSlots((prev) => ({ ...prev, [slotId]: true }));

        // 2. Optimistic update
        setSlots((prev) =>
            prev.map((s) =>
                s.id === slotId
                    ? { ...s, status: enabled ? "AVAILABLE" : "DISABLED" }
                    : s
            )
        );

        try {
            const res = await fetch(`/api/admin/slots/${slotId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: {
                        value: enabled ? "AVAILABLE" : "DISABLED",
                    },
                    overrideReason: enabled
                        ? "Slot enabled by admin"
                        : "Slot disabled by admin",
                }),
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.message || "Failed to update slot status");
            }

            toast.success(
                enabled ? "Slot enabled" : "Slot disabled"
            );
        } catch (err) {
            // 3. Rollback on failure
            setSlots((prev) =>
                prev.map((s) =>
                    s.id === slotId
                        ? { ...s, status: enabled ? "DISABLED" : "AVAILABLE" }
                        : s
                )
            );

            toast.error("Slot update failed", {
                description:
                    err instanceof Error ? err.message : "Unexpected error",
            });

        } finally {
            // 4. Clear loading state
            setLoadingSlots((prev) => {
                const next = { ...prev };
                delete next[slotId];
                return next;
            });
        }
    }


    return (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto overscroll-x-contain">
            <table className="min-w-[1060px] w-full border-collapse">
                <thead className="bg-neutral-50 text-[#111827] text-[12px] uppercase tracking-wide">
                    <tr className="h-14">
                        <th className={`w-10 pl-5 pr-3 ${hideSelectionColumn ? "hidden" : ""}`}>
                            <div className="flex justify-center">
                                <input
                                    type="checkbox"
                                    checked={
                                        selected.length === paginated.length &&
                                        paginated.length > 0
                                    }
                                    onChange={toggleAll}
                                    className="h-4 w-4 accent-neutral-900"
                                />
                            </div>
                        </th>
                        <th className={hideSelectionColumn ? "pl-5 pr-3 text-left" : "px-3 text-left"}>#</th>
                        <th className="px-3 text-left">DATE</th>
                        <th className="px-3 text-left">THEATRE</th>
                        <th className="px-3 text-left">TIME</th>
                        <th className="px-3 text-left">DURATION</th>
                        <th className="px-3 text-left">PRICE</th>
                        <th className="px-3 text-left">STATUS</th>
                        <th className="px-3 text-left">CREATED</th>
                        <th className="pl-3 pr-5 w-[50px] text-left">ACTION</th>
                    </tr>
                </thead>

                <tbody>
                    {paginated.map((slot, index) => (
                        <SlotRow
                            key={slot.id}
                            slot={slot}
                            selected={selected.includes(slot.id)}
                            onSelect={() => toggleOne(slot.id)}
                            onView={() => onView(slot)}
                            onEdit={() => onEdit(slot)}
                            onDelete={() => onDelete(slot)}
                            onToggleStatus={handleToggleSlotStatus}
                            hideSelectionColumn={hideSelectionColumn}
                            loading={!!loadingSlots[slot.id]}
                            srNo={(page - 1) * PAGE_SIZE + index + 1}
                        />
                    ))}
                </tbody>

            </table>

            {totalPages > 1 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-3 border-t border-neutral-200 text-sm">
                    <span className="text-neutral-500">
                        Page {page} of {totalPages}
                    </span>

                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="rounded-md border border-neutral-200 px-3 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="rounded-md border border-neutral-200 px-3 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
