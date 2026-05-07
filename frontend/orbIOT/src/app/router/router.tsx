import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { DEFAULT_ROUTE, NAV_ITEMS, type AppNavItem } from "./navigation";

const DeviceInventoryPage = lazy(() => import("../../modules/device-inventory/page"));
const ApplicationConsolePage = lazy(() => import("../../modules/application-console/page"));
const DashboardPage = lazy(() => import("../../modules/dashboard/page"));
const DeviceControlPage = lazy(() => import("../../modules/device-control/page"));

function FeaturePage({ item }: { item: AppNavItem }) {
  const Icon = item.icon;

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="expo-eyebrow inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
              <Icon size={14} />
              IOTIQ
            </div>
            <div className="space-y-3">
              <h1 className="expo-display text-slate-950">{item.label}</h1>
              <p className="expo-body max-w-[46rem] text-slate-600">{item.description}</p>
            </div>
          </div>

          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            {item.stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4"
              >
                <p className="expo-eyebrow text-slate-500">{stat.label}</p>
                <p className="expo-metric mt-3 text-slate-950">{stat.value}</p>
                <p className="expo-note mt-2 text-slate-600">{stat.helper}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="expo-card-title text-slate-950">Operational Focus</p>
              <p className="expo-body mt-2 text-slate-600">
                This module is ready for API-backed widgets and role-specific workflows.
              </p>
            </div>
            <div className="expo-note rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              Ready
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="expo-eyebrow text-slate-500">Primary Action</p>
              <p className="expo-card-title mt-3 text-slate-950">Connect service data</p>
              <p className="expo-body mt-2 text-slate-600">
                Add live data tables, charts, and controls for {item.label.toLowerCase()}.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="expo-eyebrow text-slate-500">Navigation Status</p>
              <p className="expo-card-title mt-3 text-slate-950">Route mapped in app shell</p>
              <p className="expo-body mt-2 text-slate-600">
                Sidebar selection, URL state, and active highlighting are already aligned.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="expo-eyebrow text-slate-500">IOTIQ Standard</p>
          <p className="expo-section-title mt-3 text-slate-950">Simple. Clear. Production-ready.</p>
          <p className="expo-body mt-3 text-slate-600">
            Every page now uses a consistent professional shell, so teams can scale features without design drift.
          </p>
        </article>
      </div>
    </section>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={DEFAULT_ROUTE} replace />} />

        <Route path="/" element={<AppLayout />}>
          {NAV_ITEMS.map((item) => (
            <Route
              key={item.id}
              path={item.path.replace(/^\//, "")}
              element={
                item.id === "devices" ? (
                  <Suspense
                    fallback={
                      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="expo-body text-slate-600">Loading device inventory...</p>
                      </section>
                    }
                  >
                    <DeviceInventoryPage />
                  </Suspense>
                ) : item.id === "dashboard" ? (
                  <Suspense
                    fallback={
                      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="expo-body text-slate-600">Loading dashboard...</p>
                      </section>
                    }
                  >
                    <DashboardPage />
                  </Suspense>
                ) : item.id === "applications" ? (
                  <Suspense
                    fallback={
                      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="expo-body text-slate-600">Loading application console...</p>
                      </section>
                    }
                  >
                    <ApplicationConsolePage />
                  </Suspense>
                ) : item.id === "control" ? (
                  <Suspense
                    fallback={
                      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="expo-body text-slate-600">Loading device control...</p>
                      </section>
                    }
                  >
                    <DeviceControlPage />
                  </Suspense>
                ) : (
                  <FeaturePage item={item} />
                )
              }
            />
          ))}
        </Route>

        <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
