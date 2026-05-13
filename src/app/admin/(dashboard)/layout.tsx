import AdminLayout from "@/components/admin/layouts/AdminLayout";
import { getAuthenticatedAdminSessionFromCookies } from "@/services/auth/adminAuth.server";
import { redirect } from "next/navigation";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthenticatedAdminSessionFromCookies();
  if (!session || session.role !== "ADMIN") {
    redirect("/admin/login");
  }

  return <AdminLayout>{children}</AdminLayout>;
}
