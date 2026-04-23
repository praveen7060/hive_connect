import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Cpu } from "lucide-react";
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
          "block rounded-lg px-2.5 py-2 text-[11px] font-semibold leading-tight transition-colors duration-150",
          isActive
            ? "bg-sky-100 text-sky-800"
            : "text-slate-600 hover:bg-white hover:text-slate-900",
        ].join(" ")}
      >
        {subItem.label}
      </NavLink>
    </li>
  );
}

function NavItem({ item, expanded, activePath, activeSearch }: NavItemProps) {
  const Icon = item.icon;
  const shouldShowSubItems =
    expanded &&
    (activePath === item.path || activePath.startsWith(`${item.path}/`)) &&
    Boolean(item.subItems?.length);

  return (
    <li className="relative">
      <NavLink
        to={item.path}
        end
        className={({ isActive }) =>
          [
            "group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium",
            "border border-transparent transition-all duration-150 ease-out outline-none",
            "focus-visible:ring-2 focus-visible:ring-sky-500/40",
            isActive
              ? "border-sky-200 bg-sky-50 text-slate-950"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sky-500" />
            )}

            <span className="flex-shrink-0 transition-transform duration-150 group-hover:scale-110">
              <Icon
                size={18}
                className={isActive ? "text-sky-600" : "text-slate-400 group-hover:text-slate-700"}
              />
            </span>

            <span
              className={`
                truncate whitespace-nowrap transition-all duration-200
                ${expanded ? "w-auto opacity-100" : "w-0 overflow-hidden opacity-0"}
              `}
            >
              {item.label}
            </span>
          </>
        )}
      </NavLink>

      {shouldShowSubItems && item.subItems && (
        <ul
          className="subnav-scrollbar-hidden ml-7 mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-2 pr-1.5"
          role="list"
        >
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
      )}
    </li>
  );
}

export default function Sidebar() {
  const [canHover, setCanHover] = useState(false);
  const [active, setActive] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHoverSupport = () => {
      setCanHover(mediaQuery.matches);
    };

    updateHoverSupport();
    mediaQuery.addEventListener("change", updateHoverSupport);

    return () => {
      mediaQuery.removeEventListener("change", updateHoverSupport);
    };
  }, []);

  const expanded = !canHover || active;
  const activeSearch = new URLSearchParams(location.search);

  return (
    <aside
      className={`
        relative flex h-screen flex-col flex-shrink-0 overflow-hidden border-r border-slate-200 bg-slate-50/80
        transition-[width] duration-300 ease-in-out
        ${expanded ? "w-[272px]" : "w-[76px]"}
      `}
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
      <style>{`
        .subnav-scrollbar-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .subnav-scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="flex items-center gap-3 overflow-hidden border-b border-slate-200 px-4 py-5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-slate-950 shadow-sm">
          <Cpu size={16} className="text-white" />
        </div>
        <div
          className={`overflow-hidden transition-all duration-200 ${expanded ? "w-auto opacity-100" : "w-0 opacity-0"}`}
        >
          <p className="whitespace-nowrap text-[13px] font-bold tracking-wide text-slate-950">
            IoT<span className="text-slate-500">Platform</span>
          </p>
          <p className="whitespace-nowrap text-[10px] uppercase tracking-widest text-slate-500">
            Control Center
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-4">
        {expanded && (
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Navigation
          </p>
        )}
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
    </aside>
  );
}
