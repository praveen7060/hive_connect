import { Activity, Leaf, ShieldCheck } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../shared/components/sidebar/Sidebar";
import { NAV_ITEMS } from "../router/navigation";

const statusChips = [
  { label: "Fleet", value: "Connected", icon: Activity },
  { label: "Policy", value: "Protected", icon: ShieldCheck },
  { label: "Mode", value: "Green", icon: Leaf },
];

export default function AppLayout() {
  const location = useLocation();
  const activeItem =
    NAV_ITEMS.find((item) => item.path === location.pathname) ??
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const isFullBleedRoute =
    location.pathname === "/devices" ||
    location.pathname === "/dashboard" ||
    location.pathname === "/telemetry";

  return (
    <div className="min-h-screen bg-[var(--iotiq-bg)] text-[var(--iotiq-text)]">
      <div className="flex min-h-screen w-full">
        <Sidebar />

        <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
          {!isFullBleedRoute ? (
            <header className="border-b border-[var(--iotiq-border)] bg-white/88 px-4 py-4 backdrop-blur md:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--iotiq-muted)]">
                    IOTIQ Platform
                  </p>
                  <h1 className="mt-2 text-[26px] font-medium tracking-[-0.045em] text-[#161616] md:text-[32px]">
                    {activeItem?.label ?? "Operations"}
                  </h1>
                  <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--iotiq-muted)]">
                    {activeItem?.description ??
                      "Monitor devices, applications, and control routes from a single operational workspace."}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {statusChips.map((chip) => {
                    const Icon = chip.icon;
                    return (
                      <div
                        key={chip.label}
                        className="rounded-2xl border border-[var(--iotiq-border)] bg-[var(--iotiq-surface)] px-3 py-3"
                      >
                        <div className="flex items-center gap-2 text-[var(--iotiq-primary)]">
                          <Icon size={14} />
                          <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
                            {chip.label}
                          </span>
                        </div>
                        <p className="mt-2 text-[14px] font-medium text-[#161616]">{chip.value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </header>
          ) : null}

          <div
            className={[
              "flex-1 overflow-y-auto",
              isFullBleedRoute ? "px-0 py-0" : "px-3 py-3 md:px-5 md:py-5",
            ].join(" ")}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
