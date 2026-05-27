import { useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type DrawerSize = "default" | "large" | "compact";

interface RightDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: DrawerSize;
}

interface InventoryPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  label: string;
  onPageChange: (page: number) => void;
}

export function RightDrawer({
  open,
  onClose,
  children,
  size = "default",
}: RightDrawerProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  const widthClass =
    size === "large"
      ? "w-full sm:max-w-[60vw] lg:w-[46vw] lg:min-w-[560px] lg:max-w-[880px]"
      : size === "compact"
        ? "w-full sm:max-w-[60vw] lg:w-[540px] lg:min-w-[520px] lg:max-w-[580px]"
        : "w-full sm:max-w-[62vw] lg:w-[44vw] lg:min-w-[520px] lg:max-w-[860px]";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#111111]/12 backdrop-blur-[3px] inventory-drawer-overlay">
      <button
        type="button"
        onClick={onClose}
        className="hidden h-full flex-1 cursor-default lg:block"
        aria-label="Close panel overlay"
      />
      <div className="flex h-full w-full justify-end p-0 sm:p-4 lg:w-auto lg:p-5">
        <aside
          className={`inventory-drawer-panel ${widthClass} h-full overflow-hidden border border-[var(--iotiq-border)] bg-white shadow-[0_32px_90px_rgba(17,17,17,0.16)]`}
        >
          <div className="h-full overflow-hidden">
            {children}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function InventoryPagination({
  page,
  pageSize,
  total,
  label,
  onPageChange,
}: InventoryPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(total, safePage * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-600">
          {total} {label}
        </span>
        <span className="text-slate-300">•</span>
        <span>
          {total === 0 ? "No records" : `${start}-${end} shown`}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
          Page {safePage} / {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function InventoryEmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-18 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-[13px] font-semibold text-slate-600">{title}</p>
        <p className="text-[12px] text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}
