interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  inlineActions?: boolean;
}

export default function PageHeader({
  title,
  description,
  actions,
  inlineActions = false,
}: PageHeaderProps) {
  return (
    <div
      className={`pb-6 border-b border-slate-200 ${
        inlineActions
          ? "flex items-start justify-between gap-3"
          : "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      }`}
    >
      {/* Left */}
      <div className={inlineActions ? "min-w-0 flex-1 pr-2" : ""}>
        {/* Title */}
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          {title}
        </h1>

        {/* Description */}
        {description && (
          <p className="mt-1.5 hidden max-w-2xl text-sm leading-relaxed text-slate-500 sm:block">
            {description}
          </p>
        )}
      </div>

      {/* Right actions */}
      {actions && (
        <div
          className={
            inlineActions
              ? "flex shrink-0 items-center gap-3 self-start"
              : "flex w-full items-stretch gap-3 self-start sm:w-auto sm:items-center"
          }
        >
          {actions}
        </div>
      )}
    </div>
  );
}
