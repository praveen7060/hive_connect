import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, Cpu, Dot, Orbit } from "lucide-react";
import {
  NAV_ITEMS,
  type AppNavItem,
  type AppNavSubItem,
} from "../../../app/router/navigation";

interface NavItemProps {
  item: AppNavItem;
  expanded: boolean;
  activePath: string;
  activeSearch: URLSearchParams;
}

interface SubNavItemProps {
  parentPath: string;
  subItem: AppNavSubItem;
  activePath: string;
  activeSearch: URLSearchParams;
}

function SubNavItem({
  parentPath,
  subItem,
  activePath,
  activeSearch,
}: SubNavItemProps) {
  const to = `${parentPath}?${subItem.queryKey}`;
  const isActive = activePath === parentPath && activeSearch.has(subItem.queryKey);

  return (
    <li>
      <NavLink
        to={to}
        className={[
          "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[12px] transition-all duration-300",
          isActive
            ? "bg-cyan-400/12 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.22)]"
            : "text-slate-400 hover:bg-white/5 hover:text-white",
        ].join(" ")}
      >
        <span
          className={[
            "h-2 w-2 rounded-full transition-colors duration-300",
            isActive ? "bg-cyan-300" : "bg-slate-600 group-hover:bg-slate-300",
          ].join(" ")}
        />
        <span className="truncate">{subItem.label}</span>
      </NavLink>
    </li>
  );
}

function NavItem({ item, expanded, activePath, activeSearch }: NavItemProps) {
  const Icon = item.icon;
  const active = activePath === item.path || activePath.startsWith(`${item.path}/`);
  const hasSubItems = Boolean(item.subItems?.length);
  const showSubItems = expanded && active && hasSubItems;

  return (
    <li className="relative">
      <NavLink
        to={item.path}
        end
        className={({ isActive }) =>
          [
            "group relative flex items-center gap-3 overflow-hidden rounded-[24px] px-3.5 py-3",
            "border border-transparent transition-all duration-300 outline-none",
            "focus-visible:ring-2 focus-visible:ring-cyan-300/40",
            isActive
              ? "border-cyan-300/18 bg-cyan-400/10 text-white shadow-[0_18px_34px_rgba(8,145,178,0.16)]"
              : "text-slate-400 hover:border-white/8 hover:bg-white/5 hover:text-white",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={[
                "absolute inset-y-3 left-0 w-[3px] rounded-r-full transition-all duration-300",
                isActive ? "bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.85)]" : "bg-transparent",
              ].join(" ")}
            />

            <span
              className={[
                "relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border transition-all duration-300",
                isActive
                  ? "border-cyan-300/24 bg-slate-950/40 text-cyan-200"
                  : "border-white/6 bg-white/4 text-slate-400 group-hover:border-white/12 group-hover:bg-white/8 group-hover:text-slate-100",
              ].join(" ")}
            >
              <Icon size={17} />
            </span>

            {expanded ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold tracking-[0.01em]">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-slate-500 group-hover:text-slate-300">
                    {item.stats[0]?.label ?? "Control node"}
                  </p>
                </div>
                {hasSubItems ? (
                  <ChevronRight
                    size={14}
                    className={`flex-shrink-0 transition-transform duration-300 ${
                      active ? "rotate-90 text-cyan-200" : "text-slate-600"
                    }`}
                  />
                ) : (
                  <Dot size={18} className="text-slate-600 group-hover:text-cyan-200" />
                )}
              </>
            ) : null}
          </>
        )}
      </NavLink>

      {showSubItems && item.subItems ? (
        <ul className="mt-2 flex flex-col gap-1.5 pl-3" role="list">
          {item.subItems.map((subItem) => (
            <SubNavItem
              key={subItem.id}
              parentPath={item.path}
              subItem={subItem}
              activePath={activePath}
              activeSearch={activeSearch}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function Sidebar() {
  const [canHover, setCanHover] = useState(false);
  const [active, setActive] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHoverSupport = () => setCanHover(mediaQuery.matches);

    updateHoverSupport();
    mediaQuery.addEventListener("change", updateHoverSupport);

    return () => {
      mediaQuery.removeEventListener("change", updateHoverSupport);
    };
  }, []);

  const expanded = !canHover || active;
  const activeSearch = new URLSearchParams(location.search);

  const activeItem = useMemo(
    () =>
      NAV_ITEMS.find(
        (item) =>
          location.pathname === item.path ||
          location.pathname.startsWith(`${item.path}/`)
      ) ?? NAV_ITEMS[0],
    [location.pathname]
  );

  return (
    <aside
      className={[
        "relative flex h-screen flex-shrink-0 flex-col overflow-hidden border-r border-white/8 bg-[#07111f]/94 backdrop-blur-xl",
        "transition-[width] duration-300 ease-in-out",
        expanded ? "w-[308px]" : "w-[94px]",
      ].join(" ")}
      aria-label="Primary navigation"
      aria-expanded={expanded}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocusCapture={() => setActive(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setActive(false);
        }
      }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-y-0 left-[46px] w-px bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent" />
        <div className="absolute left-[42px] top-[110px] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.95)]" />
        <div className="absolute left-[42px] top-[50%] h-2 w-2 rounded-full bg-emerald-300/80 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
        <div className="absolute left-[42px] bottom-[112px] h-2.5 w-2.5 rounded-full bg-indigo-300/80 shadow-[0_0_18px_rgba(165,180,252,0.85)]" />
      </div>

      <div className="relative overflow-hidden border-b border-white/8 px-4 py-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] border border-cyan-300/16 bg-cyan-400/10 text-cyan-200 shadow-[0_14px_30px_rgba(34,211,238,0.16)]">
            <Cpu size={18} />
          </div>
          <div
            className={`overflow-hidden transition-all duration-200 ${
              expanded ? "w-auto opacity-100" : "w-0 opacity-0"
            }`}
          >
            <p className="whitespace-nowrap text-[15px] font-semibold tracking-[0.08em] text-white">
              ORBIOT
            </p>
            <p className="whitespace-nowrap text-[11px] uppercase tracking-[0.26em] text-cyan-200/70">
              Flow Console
            </p>
          </div>
        </div>

        {expanded ? (
          <div className="mt-4 rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
            <div className="flex items-center gap-2 text-cyan-200">
              <Orbit size={14} />
              <span className="text-[11px] uppercase tracking-[0.2em]">Live Route</span>
            </div>
            <p className="mt-3 text-[16px] font-semibold tracking-[-0.03em] text-white">
              {activeItem?.label ?? "Dashboard"}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-slate-400">
              The navigation rail expands into active device, control, and telemetry branches.
            </p>
          </div>
        ) : null}
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-4" aria-label="Primary navigation">
        <ul className="flex flex-col gap-2" role="list">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              expanded={expanded}
              activePath={location.pathname}
              activeSearch={activeSearch}
            />
          ))}
        </ul>
      </nav>

      <div className={`relative border-t border-white/8 px-4 py-4 ${expanded ? "" : "text-center"}`}>
        {expanded ? (
          <div className="rounded-2xl border border-white/8 bg-gradient-to-r from-cyan-400/10 to-indigo-400/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Network posture
            </p>
            <p className="mt-2 text-[14px] font-semibold text-white">Control plane synchronized</p>
            <p className="mt-1 text-[12px] text-slate-400">
              Animated shell, flow-map nodes, and route-aware status are live.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-200">
            <span className="text-[11px] font-semibold">HC</span>
          </div>
        )}
      </div>
    </aside>
  );
}
