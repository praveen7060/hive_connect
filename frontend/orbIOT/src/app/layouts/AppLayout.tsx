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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
          {showShellHeader && (
            <header className="border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="max-w-4xl">
                  <p className="expo-eyebrow text-slate-500">Connected control plane</p>
                  <h2 className="expo-page-title mt-2 text-slate-950">
                    {activeItem?.label ?? "OrbIoT Console"}
                  </h2>
                  <p className="expo-body mt-3 max-w-3xl text-slate-600">
                    {activeItem?.description ??
                      "Select a section from the sidebar to navigate through the platform."}
                  </p>
                </div>

                <div className="expo-note rounded-full border border-sky-200 bg-sky-50 px-4 py-3 text-sky-700">
                  Routes are now mounted through the sidebar.
                </div>
              </div>
            </header>
          )}

          <div
            className={[
              "flex-1 overflow-y-auto",
              isDeviceInventoryRoute ? "px-1 py-1 md:px-2 md:py-2" : "px-6 py-6",
            ].join(" ")}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
