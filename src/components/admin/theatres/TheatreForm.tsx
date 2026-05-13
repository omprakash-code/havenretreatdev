"use client";

import { useFieldArray, useForm, useWatch, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useId, useRef, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { theatreSchema, TheatreFormValues } from "./theatre.schema";
import TheatreGalleryUploader from "./TheatreGalleryUploader";
import PdfUploader from "./PdfUploader";
import { motion, AnimatePresence } from "framer-motion";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
    Info,
    Users,
    Utensils,
    Balloon,
    ShieldCheck,
    Heart,
    User,
    Cake,
    Wand2,
    Gift,
} from "@/components/icons";
import {
    createEmptyTheatreCardContent,
    normalizeTheatreCardContent,
} from "@/lib/theatre-card-content";

// ============================= 
// THEATRE FORM
// ============================= 
type TheatreFormProps = {
    defaultValues?: Partial<TheatreFormValues>;
    onSubmit: (values: TheatreFormValues, helpers: { reset: () => void }) => void;
    loading?: boolean;
    locations?: Array<{ id: string; name: string }>; // Available locations
};

const BLOCKED_NUMBER_KEYS = new Set(["e", "E", "+", "-", "."]);

function handleNumericKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (BLOCKED_NUMBER_KEYS.has(event.key)) {
        event.preventDefault();
    }
}

function handleNumericPaste(event: ReactClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (/[^\d]/.test(pasted)) {
        event.preventDefault();
    }
}

function toNumberOrUndefined(value: unknown) {
    if (value === "" || value == null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function InfoTooltipButton({
    label,
    content,
}: {
    label: string;
    content: string;
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const tooltipId = useId();

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (triggerRef.current?.contains(target)) return;
            if (tooltipRef.current?.contains(target)) return;
            setOpen(false);
        };

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onEscape);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onEscape);
        };
    }, [open]);

    return (
        <span className="relative inline-flex">
            <button
                ref={triggerRef}
                type="button"
                aria-label={`More info about ${label}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={tooltipId}
                className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-slate-400 outline-none transition hover:text-slate-600 focus-visible:text-slate-700"
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={(event) => {
                    const next = event.relatedTarget as Node | null;
                    if (next && tooltipRef.current?.contains(next)) return;
                    setOpen(false);
                }}
                onClick={() => setOpen((prev) => !prev)}
            >
                <Info size={12} />
            </button>

            <div
                ref={tooltipRef}
                id={tooltipId}
                role="tooltip"
                tabIndex={-1}
                className={`absolute left-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-1.5rem)] rounded-md border border-slate-200 bg-white p-2 text-[11px] font-medium text-slate-700 shadow-sm transition-all duration-200 ease-out ${open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0 pointer-events-none"
                    }`}
            >
                {content}
            </div>
        </span>
    );
}

export default function TheatreForm({
    defaultValues,
    onSubmit,
    loading = false,
    locations = [],
}: TheatreFormProps) {
    const [activeTab, setActiveTab] = useState<"basic" | "settings">("basic");

    const {
        register,
        handleSubmit,
        reset,
        control,
        setValue,
        formState: { errors },
    } = useForm<TheatreFormValues>({
        resolver: zodResolver(theatreSchema),
        defaultValues: defaultValues ?? {
            name: "",
            locationId: "",
            hasFood: false,
            isActive: true,
            footerMessage: "",
            mapUrl: "",
            images: [],
            menuFile: "",
            cardContent: createEmptyTheatreCardContent(),
        },
    });

    const {
        fields: media,
        append,
        remove,
    } = useFieldArray({
        control,
        name: "images",
    });

    const isActive = useWatch({ control, name: "isActive" });
    const capacityInfoEnabled = useWatch({ control, name: "cardContent.capacity.enabled" });
    const foodInfoEnabled = useWatch({ control, name: "cardContent.food.enabled" });
    const decorInfoEnabled = useWatch({ control, name: "cardContent.decor.enabled" });
    const freeCancellationInfoEnabled = useWatch({
        control,
        name: "cardContent.freeCancellation.enabled",
    });
    const idealForEnabled = useWatch({ control, name: "cardContent.idealFor.enabled" });
    const nextStepEnabled = useWatch({ control, name: "cardContent.nextStep.enabled" });

    // Controller for menu PDF
    const { field: menuField } = useController({
        control,
        name: "menuFile",
    });



    useEffect(() => {
        if (!defaultValues) return;
        if (!defaultValues.locationId) return;
        if (locations.length === 0) return;

        reset({
            ...defaultValues,
            cardContent: normalizeTheatreCardContent(defaultValues.cardContent),
            locationId: defaultValues.locationId, // critical
        });
    }, [defaultValues, locations, reset]);

    useEffect(() => {
        setValue("hasFood", Boolean(foodInfoEnabled), { shouldDirty: true });
    }, [foodInfoEnabled, setValue]);


    return (
        <form onSubmit={handleSubmit((values: TheatreFormValues) => onSubmit(values, { reset }))} className="flex h-full min-w-0 flex-col">
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 -mx-4 px-4 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
                {[
                    { key: "basic", label: "Basic Information" },
                    { key: "settings", label: "Settings & Media" },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key as "basic" | "settings")}
                        className={`relative shrink-0 cursor-pointer px-3 py-2.5 text-sm font-medium transition-colors sm:px-4
        ${activeTab === tab.key
                                ? "text-slate-900"
                                : "text-slate-500 hover:text-slate-700"}
      `}
                    >
                        {activeTab === tab.key && (
                            <motion.div
                                layoutId="theatreActiveTab"
                                className="absolute inset-0 -mx-px border-b-2 border-black"
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                        <span className="relative">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 space-y-6 overflow-y-auto pt-6">
                <AnimatePresence mode="wait">
                    {activeTab === "basic" && (
                        <motion.div
                            key="basic"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Theatre Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900">Theatre Details</h3>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700">
                                            Theatre Name <span className="text-red-500">*</span>
                                        </label>
                                        <input {...register("name")} placeholder="e.g. Theatre 1" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all duration-200" />
                                        {errors.name && (
                                            <p className="text-xs text-red-600">{errors.name.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700">
                                            Location <span className="text-red-500">*</span>
                                        </label>
                                        <select {...register("locationId")} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all duration-200">
                                            <option value="">Select location...</option>
                                            {locations.map((loc) => (
                                                <option key={loc.id} value={loc.id}>
                                                    {loc.name}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.locationId && (
                                            <p className="text-xs text-red-600">{errors.locationId.message}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700">
                                            Max Guests Capacity <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            step={1}
                                            inputMode="numeric"
                                            onKeyDown={handleNumericKeyDown}
                                            onPaste={handleNumericPaste}
                                            {...register("capacity", { setValueAs: toNumberOrUndefined })}
                                            placeholder="e.g. 6"
                                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all duration-200"
                                        />
                                        {errors.capacity && (
                                            <p className="text-xs text-red-600">{errors.capacity.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700">
                                            Included Guests <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            step={1}
                                            inputMode="numeric"
                                            onKeyDown={handleNumericKeyDown}
                                            onPaste={handleNumericPaste}
                                            {...register("baseGuests", { setValueAs: toNumberOrUndefined })}
                                            placeholder="e.g. 2"
                                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all duration-200"
                                        />
                                        {errors.baseGuests && (
                                            <p className="text-xs text-red-600">{errors.baseGuests.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700">
                                            Display Order <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            inputMode="numeric"
                                            onKeyDown={handleNumericKeyDown}
                                            onPaste={handleNumericPaste}
                                            {...register("sortOrder", { setValueAs: toNumberOrUndefined })}
                                            placeholder="e.g. 1"
                                            className={`w-full rounded-md border px-3 py-2 text-sm ${errors.sortOrder ? "border-red-500 focus:ring-red-500/20" : "border-slate-300 focus:border-black focus:ring-black/5"}`}
                                        />
                                        {errors.sortOrder && (
                                            <p className="text-xs text-red-600">{errors.sortOrder.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900">Pricing</h3>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700">
                                            Additional Guest Charge <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                                            <input
                                                type="number"
                                                min={0}
                                                step={1}
                                                inputMode="numeric"
                                                onKeyDown={handleNumericKeyDown}
                                                onPaste={handleNumericPaste}
                                                {...register("extraPersonPrice", { setValueAs: toNumberOrUndefined })}
                                                placeholder="e.g. 300"
                                                className="w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm text-slate-900 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all duration-200"
                                            />
                                        </div>
                                        {errors.extraPersonPrice && (
                                            <p className="text-xs text-red-600">{errors.extraPersonPrice.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-medium text-slate-700">
                                            Decoration Price <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                                            <input
                                                type="number"
                                                min={0}
                                                step={1}
                                                inputMode="numeric"
                                                onKeyDown={handleNumericKeyDown}
                                                onPaste={handleNumericPaste}
                                                {...register("decorationPrice", { setValueAs: toNumberOrUndefined })}
                                                placeholder="e.g. 750"
                                                className="w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm text-slate-900 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all duration-200"
                                            />
                                        </div>
                                        {errors.decorationPrice && (
                                            <p className="text-xs text-red-600">{errors.decorationPrice.message}</p>
                                        )}
                                    </div>

                                </div>
                            </div>

                            {/* Display Settings */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900">Display Settings</h3>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <label className="block text-xs font-medium text-slate-700">
                                            Card Footer Message <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <InfoTooltipButton
                                            label="Card Footer Message"
                                            content="Custom message shown at the bottom of theatre cards on the frontend."
                                        />
                                    </div>
                                    <input {...register("footerMessage")} placeholder="e.g. For up to 2 people + ₹300 per extra person" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all duration-200" />
                                </div>
                            </div>

                            {/* Theatre Card Content */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-1.5">
                                    <h3 className="text-sm font-semibold text-slate-900">Theatre Card Content</h3>
                                    <InfoTooltipButton
                                        label="Theatre Card Content"
                                        content="Control theatre card info. Use placeholders available: {{capacity}}, {{decorationPrice}}, {{location}}, {{baseGuests}}, {{extraPersonPrice}}."
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="text-xs font-medium text-slate-700">Capacity Text</label>
                                            <ToggleSwitch
                                                checked={Boolean(capacityInfoEnabled)}
                                                onChange={(checked) =>
                                                    setValue("cardContent.capacity.enabled", checked, { shouldDirty: true })
                                                }
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Users size={14} />
                                            </span>
                                            <input
                                                {...register("cardContent.capacity.text")}
                                                disabled={!capacityInfoEnabled}
                                                className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                placeholder="Up to {{capacity}} People"
                                            />
                                        </div>
                                        {errors.cardContent?.capacity?.text && (
                                            <p className="text-xs text-red-600">{errors.cardContent.capacity.text.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="text-xs font-medium text-slate-700">Food Text</label>
                                            <ToggleSwitch
                                                checked={Boolean(foodInfoEnabled)}
                                                onChange={(checked) =>
                                                    setValue("cardContent.food.enabled", checked, { shouldDirty: true })
                                                }
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Utensils size={14} />
                                            </span>
                                            <input
                                                {...register("cardContent.food.text")}
                                                disabled={!foodInfoEnabled}
                                                className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                placeholder="Food"
                                            />
                                        </div>
                                        {errors.cardContent?.food?.text && (
                                            <p className="text-xs text-red-600">{errors.cardContent.food.text.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="text-xs font-medium text-slate-700">Decoration Text</label>
                                            <ToggleSwitch
                                                checked={Boolean(decorInfoEnabled)}
                                                onChange={(checked) =>
                                                    setValue("cardContent.decor.enabled", checked, { shouldDirty: true })
                                                }
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Balloon size={14} />
                                            </span>
                                            <input
                                                {...register("cardContent.decor.text")}
                                                disabled={!decorInfoEnabled}
                                                className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                placeholder="Decor ₹{{decorationPrice}} Only"
                                            />
                                        </div>
                                        {errors.cardContent?.decor?.text && (
                                            <p className="text-xs text-red-600">{errors.cardContent.decor.text.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="text-xs font-medium text-slate-700">Free Cancellation Text</label>
                                            <ToggleSwitch
                                                checked={Boolean(freeCancellationInfoEnabled)}
                                                onChange={(checked) =>
                                                    setValue("cardContent.freeCancellation.enabled", checked, { shouldDirty: true })
                                                }
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                <ShieldCheck size={14} />
                                            </span>
                                            <input
                                                {...register("cardContent.freeCancellation.text")}
                                                disabled={!freeCancellationInfoEnabled}
                                                className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                placeholder="Free Cancellation*"
                                            />
                                        </div>
                                        {errors.cardContent?.freeCancellation?.text && (
                                            <p className="text-xs text-red-600">{errors.cardContent.freeCancellation.text.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="text-xs font-medium text-slate-700">Ideal For Block</label>
                                            <ToggleSwitch
                                                checked={Boolean(idealForEnabled)}
                                                onChange={(checked) =>
                                                    setValue("cardContent.idealFor.enabled", checked, { shouldDirty: true })
                                                }
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                    <Heart size={14} />
                                                </span>
                                                <input
                                                    {...register("cardContent.idealFor.title")}
                                                    disabled={!idealForEnabled}
                                                    className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                    placeholder="Ideal for"
                                                />
                                            </div>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                    <Users size={14} />
                                                </span>
                                                <input
                                                    {...register("cardContent.idealFor.linePrimary")}
                                                    disabled={!idealForEnabled}
                                                    className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                    placeholder="couple and"
                                                />
                                            </div>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                    <Users size={14} />
                                                </span>
                                                <input
                                                    {...register("cardContent.idealFor.lineSecondary")}
                                                    disabled={!idealForEnabled}
                                                    className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                    placeholder="family"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 rounded-md border border-slate-200 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <label className="text-xs font-medium text-slate-700">Next Step Block</label>
                                                <InfoTooltipButton
                                                    label="Next Step Block"
                                                    content="Only fields with values are shown on theatre cards. Leave a field empty to hide that step."
                                                />
                                            </div>
                                            <ToggleSwitch
                                                checked={Boolean(nextStepEnabled)}
                                                onChange={(checked) =>
                                                    setValue("cardContent.nextStep.enabled", checked, { shouldDirty: true })
                                                }
                                            />
                                        </div>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                <User size={14} />
                                            </span>
                                            <input
                                                {...register("cardContent.nextStep.title")}
                                                disabled={!nextStepEnabled}
                                                className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                placeholder="Next Step:"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-full">
                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                        <User size={14} />
                                                    </span>
                                                    <input
                                                        {...register("cardContent.nextStep.addDetails.text")}
                                                        disabled={!nextStepEnabled}
                                                        className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                        placeholder="Add Details"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="relative w-full">
                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                        <Cake size={14} />
                                                    </span>
                                                    <input
                                                        {...register("cardContent.nextStep.addCake.text")}
                                                        disabled={!nextStepEnabled}
                                                        className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                        placeholder="Add Cake"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="relative w-full">
                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                        <Wand2 size={14} />
                                                    </span>
                                                    <input
                                                        {...register("cardContent.nextStep.fogEntry.text")}
                                                        disabled={!nextStepEnabled}
                                                        className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                        placeholder="Fog Entry"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="relative w-full">
                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                        <Gift size={14} />
                                                    </span>
                                                    <input
                                                        {...register("cardContent.nextStep.gifts.text")}
                                                        disabled={!nextStepEnabled}
                                                        className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                                        placeholder="Gifts"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Visibility */}
                            <div className="space-y-4 pb-6">
                                <h3 className="text-sm font-semibold text-slate-900">Visibility</h3>

                                <div className="flex items-center justify-between py-2 px-3 rounded-md border border-slate-200">
                                    <div>
                                        <p className="text-sm text-slate-700">
                                            {isActive ? "Visible for booking" : "Hidden from customers"}
                                        </p>
                                    </div>
                                    <ToggleSwitch checked={isActive} onChange={(checked) => setValue("isActive", checked)} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "settings" && (
                        <motion.div
                            key="settings"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Theatre Images */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900">Theatre Gallery</h3>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-slate-700">
                                        Images & Videos
                                    </label>
                                    <TheatreGalleryUploader
                                        value={media}
                                        onAdd={(item) => append(item)}
                                        onRemove={(index) => remove(index)}
                                    />

                                    {errors.images && (
                                        <p className="text-xs text-red-600">
                                            {errors.images.message}
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-500">
                                        These will be displayed in the carousel on the frontend
                                    </p>
                                </div>
                            </div>

                            {/* Menu Upload */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900">Menu</h3>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-slate-700">
                                        PDF Menu
                                    </label>
                                    <PdfUploader
                                        value={menuField.value ? { id: "1", url: menuField.value, name: "Menu PDF" } : null}
                                        onChange={(item) => menuField.onChange(item?.url ?? "")}
                                    />
                                    <p className="text-xs text-slate-500">
                                        Upload a PDF menu for customers to view
                                    </p>
                                </div>
                            </div>

                            {/* Map URL */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900">Location Details</h3>

                                <div className="space-y-1.5 pb-3">
                                    <label className="block text-xs font-medium text-slate-700">
                                        Theatre Map URL
                                    </label>
                                    <input {...register("mapUrl")} placeholder="https://maps.google.com/..." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-black focus:ring-1 focus:ring-black/5 focus:outline-none transition-all duration-200" />
                                    <p className="text-xs text-slate-500">
                                        Google Maps embed URL for this theatre location
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button type="submit" disabled={loading || locations.length === 0} className="w-full cursor-pointer rounded-md bg-[#27272a] px-5 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-black active:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2 sm:w-auto">
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </span>
                    ) : (
                        "Save Theatre"
                    )}
                </button>
            </div>
        </form>
    );
}
