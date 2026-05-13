// src/components/booking/occasion/useOccasions.ts
"use client";

import { useEffect, useState } from "react";

/* -----------------------------
   Backend (API) Types
------------------------------ */

type ApiOccasionField = {
    id: string;
    occasionId: string;
    fieldKey: string;
    label: string;
    placeholder?: string;
    isRequired: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
};

type ApiOccasion = {
    id: string;
    key: string;
    label: string;
    icon: string;
    subtext?: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    fields: ApiOccasionField[];
};

/* -----------------------------
   Frontend (UI) Types
------------------------------ */

export type OccasionField = {
    key: string;
    label: string;
    isRequired: boolean;
    placeholder?: string;
};

export type Occasion = {
    id: string;
    key: string;
    name: string;
    icon: string;
    subtext?: string;
    fields: OccasionField[];
};

/* -----------------------------
   Hook
------------------------------ */

export function useOccasions() {
    const [occasions, setOccasions] = useState<Occasion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadOccasions() {
            try {
                const res = await fetch("/api/occasions");

                if (!res.ok) {
                    throw new Error(`Failed to load occasions: ${res.status}`);
                }
                const data: ApiOccasion[] = await res.json();

                const normalized: Occasion[] = data
                    .filter((o) => o.isActive)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((o) => ({
                        id: o.id,
                        key: o.key,
                        name: o.label, // backend → frontend
                        icon: o.icon,
                        subtext: o.subtext,
                        fields: o.fields
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((f) => ({
                                key: f.fieldKey,
                                label: f.label,
                                isRequired: f.isRequired,
                                placeholder: f.placeholder ?? "",
                            })),
                    }));

                setOccasions(normalized);
            } catch (error) {
                console.error("Failed to load occasions", error);
                setOccasions([]);
            } finally {
                setLoading(false);
            }
        }

        loadOccasions();
    }, []);

    return { occasions, loading };
}
