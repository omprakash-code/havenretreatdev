import { getAuthenticatedAdminSessionFromCookies } from "@/services/auth/adminAuth.server";
import { redirect } from "next/navigation";
import AdminAuthCard from "@/components/admin/auth/AdminAuthCard";

export default async function AdminLoginPage() {
  const session = await getAuthenticatedAdminSessionFromCookies();
  if (session?.role === "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-[#111] to-[#1a1a1a] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_60%)]" />

      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        <AdminAuthCard />
      </div>

      <footer className="absolute bottom-4 text-center w-full text-xs text-gray-600">
        © {new Date().getFullYear()} Haven Retreat — Admin Portal
      </footer>
    </div>
  );
}
