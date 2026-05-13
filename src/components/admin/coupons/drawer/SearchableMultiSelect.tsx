import { useMemo, useState } from "react";
import { ChevronDown, Search } from "@/components/icons";

type SearchableMultiSelectProps = {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  onSetSelected?: (values: string[]) => void;
  emptyText?: string;
  searchPlaceholder?: string;
  summaryLabel?: string;
  emptySelectionLabel?: string;
};

export default function SearchableMultiSelect({
  options,
  selected,
  onToggle,
  onSetSelected,
  emptyText = "No options found.",
  searchPlaceholder = "Search...",
  summaryLabel = "items",
  emptySelectionLabel,
}: SearchableMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filteredValues = useMemo(
    () => filteredOptions.map((option) => option.value),
    [filteredOptions]
  );
  const filteredSelectedCount = useMemo(
    () => filteredValues.filter((value) => selectedSet.has(value)).length,
    [filteredValues, selectedSet]
  );
  const allFilteredSelected =
    filteredValues.length > 0 && filteredSelectedCount === filteredValues.length;

  const selectedSummary = useMemo(() => {
    if (selected.length === 0) {
      return emptySelectionLabel ?? `No ${summaryLabel} selected`;
    }
    if (selected.length === 1) return `1 selected`;
    return `${selected.length} ${summaryLabel} selected`;
  }, [emptySelectionLabel, selected.length, summaryLabel]);

  const handleSelectAll = () => {
    if (filteredValues.length === 0) return;
    const next = Array.from(new Set([...selected, ...filteredValues]));
    if (onSetSelected) {
      onSetSelected(next);
      return;
    }
    filteredValues.forEach((value) => {
      if (!selectedSet.has(value)) {
        onToggle(value);
      }
    });
  };

  const handleClearFiltered = () => {
    if (filteredValues.length === 0) return;
    const next = selected.filter((value) => !filteredValues.includes(value));
    if (onSetSelected) {
      onSetSelected(next);
      return;
    }
    filteredValues.forEach((value) => {
      if (selectedSet.has(value)) {
        onToggle(value);
      }
    });
  };

  if (options.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-700 sm:text-xs">
            {selectedSummary}
          </p>
          <p className="text-xs text-slate-500">
            {query.trim() ? `${filteredOptions.length} results` : `${options.length} available`}
          </p>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <div
            className={`flex min-w-0 items-center overflow-hidden rounded-md border border-slate-200 bg-white transition-[width] duration-300 ease-out ${
              searchOpen ? "h-10 w-full sm:h-8 sm:w-60" : "h-10 w-full sm:h-8 sm:w-8"
            }`}
          >
            <div
              className={`overflow-hidden transition-[max-width,opacity] duration-300 ease-out ${
                searchOpen ? "max-w-full opacity-100 sm:max-w-52" : "max-w-full opacity-100 sm:max-w-0 sm:opacity-0"
              }`}
            >
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full min-w-0 border-0 bg-transparent px-3 text-sm text-slate-800 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 sm:h-8 sm:w-52 sm:px-2"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchOpen((current) => !current);
                if (collapsed) {
                  setCollapsed(false);
                }
              }}
              className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-slate-700 transition-colors hover:bg-slate-100 sm:inline-flex sm:h-8 sm:w-8"
              aria-label={searchOpen ? "Hide search" : "Show search"}
            >
              <Search size={13} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 sm:h-8 sm:w-8"
            aria-label={collapsed ? "Expand options" : "Collapse options"}
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${
                collapsed ? "-rotate-90" : "rotate-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{
          gridTemplateRows: collapsed ? "0fr" : "1fr",
          opacity: collapsed ? 0.7 : 1,
        }}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 p-3">
            {filteredOptions.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                {emptyText}
              </div>
            ) : (
              <div className="max-h-56 overflow-auto rounded-md border border-slate-200 bg-white">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-700 sm:min-h-0 sm:py-1.5 sm:text-xs">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          handleSelectAll();
                          return;
                        }
                        handleClearFiltered();
                      }}
                      disabled={filteredValues.length === 0}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900 disabled:cursor-not-allowed sm:h-3.5 sm:w-3.5"
                    />
                    <span>Select all</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleClearFiltered}
                    disabled={filteredSelectedCount === 0}
                    className="min-h-10 cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:px-2 sm:py-1.5 sm:text-xs"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1 p-2">
                  {filteredOptions.map((option) => {
                    const checked = selectedSet.has(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:gap-2 sm:py-1.5 sm:text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggle(option.value)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900 sm:h-3.5 sm:w-3.5"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
