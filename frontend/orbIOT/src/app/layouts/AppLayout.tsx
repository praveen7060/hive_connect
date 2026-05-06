import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../shared/components/sidebar/Sidebar";
import { NAV_ITEMS } from "../router/navigation";

export default function AppLayout() {
  const location = useLocation();
  const activeItem =
    NAV_ITEMS.find((item) => item.path === location.pathname) ??
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const isDeviceInventoryRoute = location.pathname === "/devices";
  const showShellHeader = !isDeviceInventoryRoute;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f9fc_0%,#f3f5f8_100%)] text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
          {showShellHeader && (
            <header className="border-b border-slate-200/70 bg-white/72 px-7 py-5 backdrop-blur-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="max-w-4xl">
                  <p className="expo-eyebrow text-slate-400">Connected control plane</p>
                  <h2 className="expo-page-title mt-2 text-slate-900">
                    {activeItem?.label ?? "OrbIoT Console"}
                  </h2>
                  <p className="expo-body mt-2.5 max-w-3xl text-slate-500">
                    {activeItem?.description ??
                      "Select a section from the sidebar to navigate through the platform."}
                  </p>
                </div>

                <div className="expo-note rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-500">
                  Navigation stays in sync with each route.
                </div>
              </div>
            </header>
          )}

          <div
            className={[
              "flex-1 overflow-y-auto",
              isDeviceInventoryRoute ? "px-1 py-1 md:px-2 md:py-2" : "px-7 py-7",
            ].join(" ")}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
