import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Cpu } from "lucide-react";
import { NAV_ITEMS, type AppNavItem, type AppNavSubItem } from "../../../app/router/navigation";

interface NavItemProps {
  item: AppNavItem;
  activePath: string;
  activeSearch: URLSearchParams;
}

function SubNavItem({
  parentPath,
  subItem,
  activePath,
  activeSearch,
}: {
  parentPath: string;
  subItem: AppNavSubItem;
  activePath: string;
  activeSearch: URLSearchParams;
}) {
  const isActive = activePath === parentPath && activeSearch.has(subItem.queryKey);

  return (
    <li>
      <NavLink
        to={`${parentPath}?${subItem.queryKey}`}
        className={[
          "flex items-center rounded-xl px-3 py-2 text-[12px] transition duration-200",
          isActive
            ? "bg-[#f1f8ef] text-[#1d4d20]"
            : "text-[var(--iotiq-muted)] hover:bg-[#f6f8f3] hover:text-[#161616]",
        ].join(" ")}
      >
        {subItem.label}
      </NavLink>
    </li>
  );
}

function NavItem({ item, activePath, activeSearch }: NavItemProps) {
  const Icon = item.icon;
  const active = activePath === item.path || activePath.startsWith(`${item.path}/`);

  return (
    <li>
      <NavLink
        to={item.path}
        end
        className={({ isActive }) =>
          [
            "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] transition duration-200",
            isActive
              ? "border border-[#dcebd6] bg-[var(--iotiq-active)] text-[#161616] shadow-[0_8px_22px_rgba(124,175,99,0.08)]"
              : "border border-transparent text-[var(--iotiq-muted)] hover:bg-[#f6f8f3] hover:text-[#161616]",
          ].join(" ")
        }
      >
        <span
          className={[
            "absolute inset-y-2 left-0 w-[3px] rounded-r-full transition-opacity duration-200",
            active ? "bg-[#7caf63] opacity-100" : "opacity-0",
          ].join(" ")}
        />
        <span
          className={[
            "flex h-9 w-9 items-center justify-center rounded-xl border transition duration-200",
            active
              ? "border-[#e7d4a3] bg-[#fff8e7] text-[#8a6511]"
              : "border-[var(--iotiq-border)] bg-white text-[var(--iotiq-muted)] group-hover:border-[#d9e8d3] group-hover:text-[#161616]",
          ].join(" ")}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${active ? "font-semibold text-[#161616]" : "font-medium text-inherit"}`}>
            {item.label}
          </p>
          <p
            className={`truncate text-[11px] ${
              active ? "text-[#6d7567]" : "text-[var(--iotiq-muted)]"
            }`}
          >
            {item.stats[0]?.label ?? "Operations"}
          </p>
        </div>
      </NavLink>

      {active && item.subItems?.length ? (
        <ul className="mt-2 space-y-1 pl-3">
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
  const location = useLocation();
  const activeSearch = new URLSearchParams(location.search);

  const activeItem = useMemo(
    () =>
      NAV_ITEMS.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) ??
      NAV_ITEMS[0],
    [location.pathname]
  );

  return (
    <aside className="hidden h-screen w-[276px] flex-shrink-0 border-r border-[var(--iotiq-border)] bg-[#fcfcf8] xl:flex xl:flex-col">
      <div className="border-b border-[var(--iotiq-border)] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-[#d9b14a]">
            <Cpu size={18} />
          </div>
          <div>
            <p className="text-[14px] font-medium tracking-[0.08em] text-[#161616]">HIVE CONNECT</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--iotiq-muted)]">
              OWN ONBOARD OPERATE
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--iotiq-border)] bg-white px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--iotiq-muted)]">Current</p>
          <p className="mt-2 text-[15px] font-medium text-[#161616]">{activeItem?.label ?? "Dashboard"}</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--iotiq-muted)]">
            Minimal workspace with direct API-backed screens.
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              activePath={location.pathname}
              activeSearch={activeSearch}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
