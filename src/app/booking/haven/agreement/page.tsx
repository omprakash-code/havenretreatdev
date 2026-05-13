import VenueBookingAgreementForm from "@/components/venue-booking/VenueBookingAgreementForm";
import { getActiveAgreementTemplate } from "@/services/agreement.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HavenBookingAgreementPage() {
  const template = await getActiveAgreementTemplate();

  return <VenueBookingAgreementForm template={template} />;
}
