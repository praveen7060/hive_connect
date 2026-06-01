import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { DEFAULT_ROUTE, NAV_ITEMS, type AppNavItem } from "./navigation";

const DeviceInventoryPage = lazy(() => import("../../modules/device-inventory/page"));
const ApplicationConsolePage = lazy(() => import("../../modules/application-console/page"));
const DashboardPage = lazy(() => import("../../modules/dashboard/page"));
const DeviceControlPage = lazy(() => import("../../modules/device-control/page"));
const TelemetryPage = lazy(() => import("../../modules/telemetry/page"));

function FeaturePage({ item }: { item: AppNavItem }) {
  const Icon = item.icon;

  return (
    <section className="space-y-4">
      <div className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eef9ef] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#155d27]">
              <Icon size={13} />
              Module
            </div>
            <h1 className="mt-3 text-[26px] font-medium tracking-[-0.05em] text-[#161616]">{item.label}</h1>
            <p className="mt-2 text-[13px] leading-6 text-[var(--iotiq-muted)]">{item.description}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {item.stats.map((stat) => (
              <article key={stat.label} className="rounded-[18px] border border-[var(--iotiq-border)] bg-[#fafaf5] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--iotiq-muted)]">{stat.label}</p>
                <p className="mt-2 text-[24px] font-medium tracking-[-0.04em] text-[#161616]">{stat.value}</p>
                <p className="mt-1 text-[12px] text-[var(--iotiq-muted)]">{stat.helper}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
          <p className="text-[12px] font-medium text-[#161616]">Current status</p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--iotiq-muted)]">
            This screen is routed correctly and ready for deeper API wiring. The shell, navigation, and route state are already integrated.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] bg-[#fafaf5] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--iotiq-muted)]">Next step</p>
              <p className="mt-2 text-[14px] font-medium text-[#161616]">Replace static blocks with live widgets</p>
            </div>
            <div className="rounded-[18px] bg-[#fff8e7] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a6511]">Priority</p>
              <p className="mt-2 text-[14px] font-medium text-[#161616]">API-first, minimal UI</p>
            </div>
          </div>
        </article>

        <article className="rounded-[22px] border border-[var(--iotiq-border)] bg-white px-4 py-4">
          <p className="text-[12px] font-medium text-[#161616]">Route details</p>
          <div className="mt-4 space-y-2 text-[12px] text-[var(--iotiq-muted)]">
            <p>Path: <span className="font-medium text-[#161616]">{item.path}</span></p>
            <p>Module: <span className="font-medium text-[#161616]">{item.label}</span></p>
            <p>Shell state: <span className="font-medium text-[#161616]">Connected</span></p>
          </div>
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
                ) : item.id === "telemetry" ? (
                  <Suspense
                    fallback={
                      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="expo-body text-slate-600">Loading telemetry...</p>
                      </section>
                    }
                  >
                    <TelemetryPage />
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
