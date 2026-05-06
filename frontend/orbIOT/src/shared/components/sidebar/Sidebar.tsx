import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, Cpu } from "lucide-react";
import { NAV_ITEMS, type AppNavItem, type AppNavSubItem } from "../../../app/router/navigation";

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

function SubNavItem({ parentPath, subItem, activePath, activeSearch }: SubNavItemProps) {
  const to = `${parentPath}?${subItem.queryKey}`;
  const isActive = activePath === parentPath && activeSearch.has(subItem.queryKey);

  return (
    <li>
      <NavLink
        to={to}
        className={[
          "flex items-center gap-3 rounded-xl px-3 py-2 text-[12px] transition-all duration-200",
          isActive
            ? "bg-slate-950/[0.05] text-slate-900"
            : "text-slate-500 hover:bg-slate-950/[0.03] hover:text-slate-800",
        ].join(" ")}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-slate-700" : "bg-slate-300"}`} />
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
            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200",
            expanded ? "justify-start" : "justify-center px-0",
            isActive
              ? "bg-slate-950/[0.06] text-slate-950"
              : "text-slate-600 hover:bg-slate-950/[0.03] hover:text-slate-900",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={[
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                isActive
                  ? "bg-white text-slate-950 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
                  : "bg-transparent text-slate-500 group-hover:bg-white/80 group-hover:text-slate-800",
              ].join(" ")}
            >
              <Icon size={17} />
            </span>

            {expanded ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.label}</p>
                </div>
                {hasSubItems ? (
                  <ChevronRight
                    size={14}
                    className={`flex-shrink-0 text-slate-300 transition-transform duration-200 ${
                      active ? "rotate-90 text-slate-500" : ""
                    }`}
                  />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </NavLink>

      {showSubItems && item.subItems ? (
        <ul className="mt-2 flex flex-col gap-1 pl-2" role="list">
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
      NAV_ITEMS.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) ??
      NAV_ITEMS[0],
    [location.pathname]
  );

  return (
    <aside
      className={`relative flex h-screen flex-shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#fcfcfd] transition-[width] duration-300 ease-out ${
        expanded ? "w-[308px]" : "w-[88px]"
      }`}
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
      <div className="border-b border-slate-200 px-4 pb-5 pt-5">
        <div className={`flex items-center ${expanded ? "gap-3" : "justify-center"}`}>
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
            <Cpu size={18} />
          </div>

          {expanded ? (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-[-0.03em] text-slate-950">
                Hive Connect
              </p>
              <p className="mt-1 truncate text-[12px] text-slate-500">iot.hiveconnect.local</p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary navigation">
        <ul className="flex flex-col gap-1.5" role="list">
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

      <div className={`border-t border-slate-200 px-4 py-4 ${expanded ? "" : "text-center"}`}>
        {expanded ? (
          <>
            <p className="text-[11px] text-slate-400">Connected control plane</p>
            <p className="mt-1 text-[12px] font-medium text-slate-700">{activeItem?.label ?? "Dashboard"}</p>
          </>
        ) : (
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
            <span className="text-[11px] font-semibold">HC</span>
          </div>
        )}
      </div>
    </aside>
  );
}
