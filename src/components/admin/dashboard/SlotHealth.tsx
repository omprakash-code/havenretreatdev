//src/components/admin/dashboard/SlotHealth.tsx
export default function SlotHealth() {
  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold mb-3">Slot Health</h3>

      <div className="space-y-2 text-sm">
        <p>🔒 Locked Slots: <strong>3</strong></p>
        <p>⏱ Expired Locks: <strong>5</strong></p>
        <p>🛡 Conflicts Prevented: <strong>12</strong></p>
      </div>
    </div>
  );
}
