import { Activity } from "@/components/icons";

type ActivityItem = {
  id: string;
  message: string;
  time: string;
};

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "1",
    message: "Booking DS130120260004 confirmed",
    time: "2 mins ago",
  },
  {
    id: "2",
    message: "Slot auto-released due to timeout",
    time: "6 mins ago",
  },
  {
    id: "3",
    message: "Admin viewed live booking DS130120260002",
    time: "12 mins ago",
  },
];

export default function ActivityFeed() {
  return (
    <div className="bg-white rounded-xl border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Activity size={18} className="text-gray-600" />
        <h3 className="font-semibold text-sm">
          Recent Activity
        </h3>
      </div>

      {/* Feed */}
      <div className="divide-y">
        {MOCK_ACTIVITY.map((item) => (
          <div
            key={item.id}
            className="px-4 py-3 text-sm"
          >
            <p className="text-gray-800">
              {item.message}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {item.time}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
