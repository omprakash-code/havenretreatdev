"use client";

import { FormEvent, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Calendar } from "@/components/icons";
import { LOCATIONS } from "@/constants/locations";
import { formatISTDate } from "@/lib/formatters";

type WaitlistApiResponse = {
    success: boolean;
    message?: string;
    data?: {
        id: string;
        reference: string;
        status: "NEW" | "CONTACTED" | "CLOSED";
        createdAt: string;
    };
};

type WaitlistFormData = {
    name: string;
    phone: string;
    email: string;
    city: string;
    locationPreference: string;
    preferredDate: string;
    preferredTime: string;
    peopleCount: string;
    occasion: string;
    notes: string;
};

const INITIAL_FORM: WaitlistFormData = {
    name: "",
    phone: "",
    email: "",
    city: "",
    locationPreference: "",
    preferredDate: "",
    preferredTime: "",
    peopleCount: "",
    occasion: "",
    notes: "",
};

function normalizeIndianMobile(input: string) {
    const digits = input.replace(/\D/g, "");

    if (digits.length === 0) return "";
    if (digits.length <= 10) return digits;
    if (digits.length === 11 && digits.startsWith("0")) {
        return digits.slice(1);
    }

    return digits.slice(-10);
}

export default function WaitlistForm() {
    const [form, setForm] = useState<WaitlistFormData>(INITIAL_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [submittedReference, setSubmittedReference] = useState<string | null>(null);
    const preferredDateInputRef = useRef<HTMLInputElement | null>(null);
    const formattedPreferredDate = getFormattedDate(form.preferredDate);

    function updateField<K extends keyof WaitlistFormData>(
        key: K,
        value: WaitlistFormData[K]
    ) {
        setForm((prev) => ({
            ...prev,
            [key]: value,
        }));
    }

    const openPreferredDatePicker = () => {
        const input = preferredDateInputRef.current;
        if (!input) return;

        if (typeof input.showPicker === "function") {
            try {
                input.showPicker();
                return;
            } catch {
                // Fallback for browsers that block showPicker.
            }
        }

        input.focus();
    };

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        setSubmittedReference(null);

        try {
            const res = await fetch("/api/waitlist", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: form.name,
                    phone: form.phone,
                    email: form.email || null,
                    city: form.city || null,
                    locationPreference: form.locationPreference,
                    preferredDate: form.preferredDate || null,
                    preferredTime: form.preferredTime || null,
                    peopleCount: form.peopleCount,
                    occasion: form.occasion || null,
                    notes: form.notes || null,
                }),
            });

            const json = (await res.json()) as WaitlistApiResponse;
            if (!res.ok || !json.success) {
                throw new Error(json.message ?? "Failed to submit waitlist request.");
            }

            toast.success(json.message ?? "You are on the waiting list.");
            setSubmittedReference(json.data?.reference ?? null);
            setForm(INITIAL_FORM);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to submit waitlist request."
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="bg-white py-11 sm:py-14 lg:py-20">
            <div className="max-w-3xl mx-auto px-3 sm:px-6">
                <motion.h2
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#111111] text-center"
                >
                    Tell Us What You’re Looking For
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mt-3 sm:mt-4 text-center text-sm sm:text-base text-[#5F6368]"
                >
                    We’ll contact you as soon as something opens up.
                </motion.p>

                <form
                    onSubmit={(e) => void handleSubmit(e)}
                    autoComplete="on"
                    className="mt-8 sm:mt-10 rounded-2xl border border-gray-200 bg-[#FAFAFA] p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5"
                >
                    {/* Name + Phone */}
                    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                        <input
                            type="text"
                            id="waitlist-name"
                            name="name"
                            autoComplete="name"
                            autoCapitalize="words"
                            placeholder="Your Name"
                            value={form.name}
                            onChange={(e) => updateField("name", e.target.value)}
                            className="w-full self-start px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
                            required/>

                        <div className="relative pt-1 sm:pt-0">
                            <p className="pointer-events-none absolute right-1 -top-3 text-right text-xs text-gray-400 sm:-top-5">
                                {form.phone.length}/10 digits
                            </p>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                                    +91
                                </span>
                                <input
                                    type="tel"
                                    id="waitlist-phone"
                                    name="tel"
                                    autoComplete="tel-national"
                                    inputMode="numeric"
                                    placeholder="Enter 10-digit mobile number"
                                    value={form.phone}
                                    onChange={(e) =>
                                        updateField("phone", normalizeIndianMobile(e.target.value))
                                    }
                                    className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-14 pr-4 text-sm sm:py-3.5 sm:pl-14 sm:pr-5 sm:text-base focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Email + Preferred time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="email"
                            id="waitlist-email"
                            name="email"
                            autoComplete="email"
                            placeholder="Email (optional)"
                            value={form.email}
                            onChange={(e) => updateField("email", e.target.value)}
                            className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
                        />

                        <input
                            type="time"
                            id="waitlist-preferred-time"
                            name="preferredTime"
                            value={form.preferredTime}
                            onChange={(e) => updateField("preferredTime", e.target.value)}
                            className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
                        />
                    </div>

                    {/* City + Location */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            id="waitlist-city"
                            name="city"
                            autoComplete="address-level2"
                            autoCapitalize="words"
                            placeholder="City"
                            value={form.city}
                            onChange={(e) => updateField("city", e.target.value)}
                            className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
                            required/>

                        <select
                            id="waitlist-location-preference"
                            name="locationPreference"
                            value={form.locationPreference}
                            onChange={(e) =>
                                updateField("locationPreference", e.target.value)
                            }
                            className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
                            required>
                            <option value="">Preferred Location</option>
                            {LOCATIONS.map((location) => (
                                <option key={location.id} value={location.name}>
                                    {location.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date + People */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            className="relative"
                            onClick={openPreferredDatePicker}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openPreferredDatePicker();
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label="Preferred date"
                        >
                            <input
                                ref={preferredDateInputRef}
                                type="date"
                                id="waitlist-preferred-date"
                                name="preferredDate"
                                value={form.preferredDate}
                                onChange={(e) => updateField("preferredDate", e.target.value)}
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                            />
                            <div className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm sm:px-5 sm:py-3.5 sm:text-base">
                                <span className={form.preferredDate ? "text-[#111111]" : "text-gray-400"}>
                                    {formattedPreferredDate}
                                </span>
                                <Calendar size={16} className="shrink-0 text-gray-500" />
                            </div>
                        </div>

                        <input
                            type="number"
                            id="waitlist-people-count"
                            name="peopleCount"
                            min={1}
                            max={50}
                            placeholder="Number of People"
                            value={form.peopleCount}
                            onChange={(e) =>
                                updateField("peopleCount", e.target.value.replace(/\D+/g, ""))
                            }
                            className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
                            required
                        />
                    </div>

                    {/* Occasion (optional but compact) */}
                    <select
                        id="waitlist-occasion"
                        name="occasion"
                        value={form.occasion}
                        onChange={(e) => updateField("occasion", e.target.value)}
                        className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40">
                        <option value="">Occasion (optional)</option>

                        <option value="birthday">Birthday</option>
                        <option value="anniversary">Anniversary</option>
                        <option value="romantic-date">Romantic Date</option>
                        <option value="marriage-proposal">Marriage Proposal</option>

                        <option value="bride-to-be">Bride to Be</option>
                        <option value="farewell">Farewell</option>
                        <option value="congratulations">Congratulations</option>
                        <option value="baby-shower">Baby Shower</option>

                        <option value="other">Other / Custom Celebration</option>
                    </select>


                    {/* Message */}
                    <textarea
                        rows={3}
                        id="waitlist-notes"
                        name="notes"
                        placeholder="Special requirements (optional)"
                        value={form.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                        className="w-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"/>

                    {submittedReference ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            Reference ID: <span className="font-semibold">{submittedReference}</span>
                        </div>
                    ) : null}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full sm:w-auto sm:min-w-[220px] sm:mx-auto sm:block py-3 sm:py-3.5 px-6 rounded-full bg-[#FFD700] text-black text-sm sm:text-base font-semibold hover:shadow-xl hover:shadow-[#FFD700]/35 transition-all disabled:cursor-not-allowed disabled:opacity-60">
                        {submitting ? "Submitting..." : "Join Waitlist"}
                    </button>
                </form>


                {/* Trust note */}
                <p className="mt-5 sm:mt-6 text-center text-xs sm:text-sm text-gray-500">
                    We respect your privacy. Your details are used only to contact you
                    regarding availability or your request.
                </p>
            </div>
        </section>
    );
}

function getFormattedDate(value: string) {
    if (!value) return "Preferred Date";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Invalid date";
    return formatISTDate(parsed);
}
