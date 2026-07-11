"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import { motion } from "framer-motion";
import { trackMetaStandardEvent } from "@/lib/meta/browser";

// Components
import CinematicHero from "@/components/booking/success/CinematicHero";
import AnimatedTicketCard from "@/components/booking/success/AnimatedTicketCard";
import CelebrationBlock from "@/components/booking/success/CelebrationBlock";
import CelebrationDetailsCard from "@/components/booking/success/CelebrationDetailsCard";
import ExtrasShowcase from "@/components/booking/success/ExtrasShowcase";
import ReviewStatusCard from "@/components/booking/success/ReviewStatusCard";
import { buildCelebrationRows } from "@/components/booking/success/success-details";
import TheatreImagePanel from "@/components/booking/success/TheatreImagePanel";
import type { BookingSuccessData } from "@/components/booking/success/types";
import {
  buildBookingSuccessPurchaseEvent,
  hasTrackedBookingSuccessPurchase,
  markBookingSuccessPurchaseTracked,
  shouldTrackBookingSuccessPurchase,
} from "@/components/booking/success/metaPurchase";
import { SUCCESS_VENUE_IMAGE } from "@/components/booking/success/assets";

export default function BookingSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("t");
  const { resetBooking, booking } = useBooking();
  const hasResetRef = useRef(false);

  const [data, setData] = useState<BookingSuccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }
    const confirmedToken = token;

    async function fetchBooking() {
      try {
        const res = await fetch(`/api/bookings/by-success-token?t=${encodeURIComponent(confirmedToken)}`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (json?.code === "TOKEN_EXPIRED") {
            setErrorState({
              title: "Confirmation link expired",
              message:
                "This confirmation link has expired. Please check your email for the latest confirmation.",
            });
          } else {
            setErrorState({
              title: "Unable to open confirmation",
              message:
                "This confirmation link is invalid. Please use the latest booking confirmation link.",
            });
          }
          return;
        }

        if (!json || !json.bookingRef) {
          setErrorState({
            title: "Unable to open confirmation",
            message:
              "This confirmation link is invalid. Please use the latest booking confirmation link.",
          });
          return;
        }
        setData(json);
      } catch {
        setErrorState({
          title: "Unable to load booking",
          message:
            "We could not load your booking confirmation right now. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchBooking();
  }, [token, router]);

  useEffect(() => {
    if (!data) return;

    const handlePopState = () => {
      router.replace("/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [data, router]);

  useEffect(() => {
    if (!data) return;
    if (hasResetRef.current) return;

    if (
      booking.bookingId ||
      booking.schedule ||
      booking.package ||
      booking.location
    ) {
      hasResetRef.current = true;
      resetBooking();
    }
  }, [data, resetBooking, booking]);

  useEffect(() => {
    if (!token || !data) return;
    if (!shouldTrackBookingSuccessPurchase(data)) return;
    if (typeof window === "undefined") return;

    const purchaseEvent = buildBookingSuccessPurchaseEvent(data, token);
    if (
      hasTrackedBookingSuccessPurchase(
        window.sessionStorage,
        purchaseEvent.storageKey
      )
    ) {
      return;
    }

    const tracked = trackMetaStandardEvent(
      "Purchase",
      purchaseEvent.params,
      { eventId: purchaseEvent.eventId }
    );

    if (tracked) {
      markBookingSuccessPurchaseTracked(
        window.sessionStorage,
        purchaseEvent.storageKey
      );
    }
  }, [data, token]);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fcfdfd] via-[#f6f8f7] to-[#edf3f1] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-[#d7e4e1] border-t-[#347f7c] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-sm">Loading your celebration details...</p>
        </motion.div>
      </div>
    );
  }

  // Error State with Retry
  if (errorState || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fcfdfd] via-[#f6f8f7] to-[#edf3f1] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 border border-[#2f7e7a]/25 bg-[#edf3f1] flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[#347f7c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {errorState?.title ?? "Unable to open confirmation"}
          </h2>
          <p className="text-slate-600 mb-6">
            {errorState?.message ??
              "We're just loading your celebration details."}
          </p>
          <button
            onClick={() => router.replace("/booking")}
            className="px-6 py-3 border border-[#347f7c] bg-[#347f7c] hover:bg-[#245e5b] text-white font-semibold transition-colors"
          >
            Go to Booking
          </button>
        </motion.div>
      </div>
    );
  }

  const hasCelebrationDetails = buildCelebrationRows(data).length > 0;
  // Legacy paid bookings keep the original confirmation layout; review-workflow
  // bookings lead with where they stand.
  const showReviewStatus =
    data.bookingStatus === "PENDING_REVIEW" ||
    data.bookingStatus === "APPROVED" ||
    data.bookingStatus === "REJECTED";

  return (
    <>
      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-b from-[#fcfdfd] via-[#f6f8f7] to-[#edf3f1] relative overflow-hidden">
        {/* Ambient Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[#347f7c]/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute -top-24 -left-20 w-80 h-80 bg-[#8eb7b1]/20 rounded-full blur-[130px] pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10">
          {/* Hero Section */}
          <CinematicHero />

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-8 sm:pb-10">
            <section className="overflow-hidden border border-[#2f7e7a]/20 bg-white shadow-lg shadow-[#cfdedb]/40">
              <div className="grid items-start gap-4 p-3 sm:p-5 lg:p-6 xl:gap-0 xl:grid-cols-[35%_65%]">
                <div className="border-dashed border-[#d7e4e1] xl:border-r-2 xl:pr-4">
                  <div className="space-y-4">
                    <TheatreImagePanel
                      theatreName={data.theatreName}
                      theatreImage={SUCCESS_VENUE_IMAGE}
                      locationName={data.locationName}
                      embedded
                    />
                    <CelebrationBlock occasionLabel={data.occasionLabel} embedded />
                    {hasCelebrationDetails && (
                      <div className="hidden border-t border-[#d7e4e1] pt-4 xl:block">
                        <CelebrationDetailsCard data={data} compact />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 xl:pt-0">
                  {showReviewStatus && <ReviewStatusCard data={data} />}
                  <AnimatedTicketCard data={data} embedded />
                </div>
              </div>

              {hasCelebrationDetails && (
                <div className="border-t border-[#d7e4e1] px-3 py-3 sm:px-6 sm:py-5 xl:hidden">
                  <CelebrationDetailsCard data={data} />
                </div>
              )}

              {data.items.length > 0 && (
                <div className="border-t border-[#d7e4e1] px-3 py-3 sm:px-6 sm:py-5">
                  <ExtrasShowcase items={data.items} embedded />
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
