import VenueBookingStepIndicator from "@/components/venue-booking/VenueBookingStepIndicator";
import VenueBookingSummary from "@/components/venue-booking/VenueBookingSummary";

type VenueBookingLayoutProps = {
  currentStep: number;
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function VenueBookingLayout({
  currentStep,
  title,
  description,
  children,
}: VenueBookingLayoutProps) {
  return (
    <section className="bg-[#f8f7f4] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <VenueBookingStepIndicator currentStep={currentStep} />
        <div className="mb-6">
          <h1 className="font-playfair text-4xl text-[#101828]">{title}</h1>
          <p className="mt-2 max-w-2xl text-base text-[#667085]">
            {description}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>{children}</div>
          <div className="lg:sticky lg:top-28 lg:self-start">
            <VenueBookingSummary />
          </div>
        </div>
      </div>
    </section>
  );
}
