import { getAuthenticatedAdminSessionFromCookies } from "@/services/auth/adminAuth.server";
import { redirect } from "next/navigation";
import AdminAuthCard from "@/components/admin/auth/AdminAuthCard";

export default async function AdminLoginPage() {
  const session = await getAuthenticatedAdminSessionFromCookies();
  if (session?.role === "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f7f5] px-4 py-16">
      <div className="absolute inset-0 bg-[url('/media/booking/success/pool-view.avif')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(244,247,245,0.97)_0%,rgba(244,247,245,0.92)_44%,rgba(235,242,239,0.72)_100%)]" />

      <div className="relative z-10 w-full max-w-[460px]">
        <AdminAuthCard />
      </div>

      <footer className="absolute bottom-5 z-10 w-full text-center text-xs tracking-wide text-[#667085]">
        © {new Date().getFullYear()} Haven Retreat · Private administration
      </footer>
    </div>
  );
}
