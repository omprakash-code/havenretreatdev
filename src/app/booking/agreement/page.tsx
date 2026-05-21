import BookingAgreementStep from "@/components/booking/agreement/BookingAgreementStep";
import { getActiveAgreementTemplate } from "@/services/agreement.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BookingAgreementPage() {
  const template = await getActiveAgreementTemplate();

  return <BookingAgreementStep template={template} />;
}
