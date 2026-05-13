import { notFound } from "next/navigation";
import PackageDetailView from "@/components/packages/PackageDetailView";
import { getEventPackageBySlug } from "@/services/package.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PackageDetailPage({
  params,
}: PageProps) {
  const { slug } = await params;
  const eventPackage = await getEventPackageBySlug(slug);

  if (!eventPackage) {
    notFound();
  }

  return <PackageDetailView eventPackage={eventPackage} />;
}
