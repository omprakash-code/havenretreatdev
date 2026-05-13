import PackageListSection from "@/components/packages/PackageListSection";
import { getEventPackages } from "@/services/package.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PackagesPage() {
  const packages = await getEventPackages();
  const venue = packages[0]?.venue ?? null;

  return <PackageListSection venue={venue} packages={packages} />;
}
