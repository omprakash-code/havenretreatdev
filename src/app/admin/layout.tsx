import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login | Haven Retreat",
  description: "Secure admin portal for Haven Retreat management system",
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-surface">{children}</div>;
}
