//src/components/admin/dashboard/KpiStrip.tsx
function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-4 border ${color}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export default function KpiStrip() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <KpiCard label="Live Bookings" value={4} color="border-blue-200 bg-blue-50" />
      <KpiCard label="🔥 Hot Leads" value={2} color="border-red-200 bg-red-50" />
      <KpiCard label="Abandoned Today" value={3} color="border-[#FFD700]/25 bg-[#FFD700]/8" />
      <KpiCard label="Confirmed Today" value={8} color="border-green-200 bg-green-50" />
      <KpiCard label="Revenue Today" value="₹5,992" color="border-gray-200 bg-white" />
    </div>
  );
}
