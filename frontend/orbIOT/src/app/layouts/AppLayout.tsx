import { Activity, Network, ShieldCheck, Sparkles } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../shared/components/sidebar/Sidebar";
import { NAV_ITEMS } from "../router/navigation";

const statusChips = [
  {
    label: "Broker Mesh",
    value: "Stable",
    icon: Network,
  },
  {
    label: "Policy Guard",
    value: "Locked",
    icon: ShieldCheck,
  },
  {
    label: "Signal Flow",
    value: "Live",
    icon: Activity,
  },
];

export default function AppLayout() {
  const location = useLocation();
  const activeItem =
    NAV_ITEMS.find((item) => item.path === location.pathname) ??
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const isDeviceInventoryRoute = location.pathname === "/devices";
  const showShellHeader = !isDeviceInventoryRoute;

  return (
    <div className="flow-app-shell min-h-screen text-slate-100">
      <div className="flow-app-shell__bg" aria-hidden="true">
        <div className="flow-grid" />
        <div className="flow-orb flow-orb--one" />
        <div className="flow-orb flow-orb--two" />
        <div className="flow-orb flow-orb--three" />
      </div>

      <div className="relative flex min-h-screen">
        <Sidebar />

        <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
          {showShellHeader && (
            <header className="border-b border-white/8 px-6 py-5 md:px-8">
              <div className="flow-panel flow-panel--hero flex flex-col gap-6 px-6 py-6 md:px-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-4xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      <Sparkles size={13} />
                      Orbital Control Plane
                    </div>
                    <h2 className="flow-page-title mt-4 text-white">
                      {activeItem?.label ?? "IOTIQ Console"}
                    </h2>
                    <p className="flow-copy mt-3 max-w-3xl text-slate-300">
                      {activeItem?.description ??
                        "Select a section from the navigation rail to move through the connected device graph."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {statusChips.map((chip) => {
                      const Icon = chip.icon;
                      return (
                        <div
                          key={chip.label}
                          className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm"
                        >
                          <div className="flex items-center gap-2 text-cyan-200">
                            <Icon size={14} />
                            <span className="text-[11px] uppercase tracking-[0.18em]">
                              {chip.label}
                            </span>
                          </div>
                          <p className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-white">
                            {chip.value}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-300">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.95)]" />
                    Animated route shell active
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                    Flow-map navigation enabled
                  </span>
                </div>
              </div>
            </header>
          )}

          <div
            className={[
              "relative flex-1 overflow-y-auto",
              isDeviceInventoryRoute ? "px-2 py-2 md:px-3 md:py-3" : "px-5 py-5 md:px-8 md:py-8",
            ].join(" ")}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
