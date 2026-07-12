/**
 * How long a request has been waiting for a decision. Ages past a day are
 * highlighted so stale requests are visible in the pending list.
 */
export function formatSubmittedAge(
  submittedAt: string | Date,
  now: Date = new Date()
) {
  const submitted =
    typeof submittedAt === "string" ? new Date(submittedAt) : submittedAt;
  const minutes = Math.floor(
    (now.getTime() - submitted.getTime()) / 60_000
  );

  if (!Number.isFinite(minutes) || minutes < 0) return "just now";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isStaleReview(
  submittedAt: string | Date,
  now: Date = new Date()
) {
  const submitted =
    typeof submittedAt === "string" ? new Date(submittedAt) : submittedAt;
  return now.getTime() - submitted.getTime() >= 24 * 60 * 60 * 1000;
}

export default function ReviewSlaBadge({
  submittedAt,
  className = "",
}: {
  submittedAt?: string | null;
  className?: string;
}) {
  if (!submittedAt) return null;

  const stale = isStaleReview(submittedAt);

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        stale
          ? "border border-rose-200 bg-white text-rose-700"
          : "border border-slate-300 bg-white text-slate-600"
      } ${className}`}
      title={`Submitted ${new Date(submittedAt).toLocaleString()}`}
    >
      Submitted {formatSubmittedAge(submittedAt)}
    </span>
  );
}
