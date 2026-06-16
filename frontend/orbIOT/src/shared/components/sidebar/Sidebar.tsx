import { NavLink, useLocation } from "react-router-dom";
import { Leaf } from "lucide-react";
import { NAV_ITEMS, type AppNavItem } from "../../../app/router/navigation";

interface NavItemProps {
  item: AppNavItem;
  activePath: string;
}

function NavItem({ item, activePath }: NavItemProps) {
  const Icon = item.icon;
  const active = activePath === item.path || activePath.startsWith(`${item.path}/`);

  return (
    <li>
      <NavLink
        to={item.path}
        end
        className={() =>
          [
            "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] transition duration-200",
            active
              ? "bg-[#0f172a] text-white shadow-[0_14px_28px_rgba(15,23,42,0.22)]"
              : "text-[#66758a] hover:bg-[#f8fbff] hover:text-[#111827]",
          ].join(" ")
        }
      >
        <span
          className={[
            "absolute inset-y-2 left-0 w-[3px] rounded-r-full transition-opacity duration-200",
            "opacity-0",
          ].join(" ")}
        />
        <span
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg transition duration-200",
            active
              ? "text-[#2f6df6]"
              : "text-[#66758a] group-hover:text-[#111827]",
          ].join(" ")}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate ${active ? "font-black text-white" : "font-bold text-inherit"}`}>
            {item.label}
          </p>
          <p
            className={`truncate text-[11px] ${
              active ? "font-bold text-[#aeb8c8]" : "font-semibold text-[#9aa9bd]"
            }`}
          >
            {item.stats[0]?.label ?? "Operations"}
          </p>
        </div>
      </NavLink>

    </li>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";

  return (
    <aside className="hidden h-screen w-[296px] flex-shrink-0 border-r border-[#e5ebf4] bg-white xl:flex xl:flex-col">
      <div className="px-6 py-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a] text-[#2f6df6] shadow-[0_10px_22px_rgba(15,23,42,0.16)]">
            <Leaf size={17} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[13px] font-black uppercase leading-4 tracking-[0.04em] text-[#111827]">HIVE CONNECT</p>
            <p className="mt-1 text-[9px] font-black uppercase leading-3 tracking-[0.18em] text-[#9aa9bd]">
              OWN - ONBOARD - OPERATE
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-5 py-2">
        <p className="sr-only">Platform</p>
        <ul className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              activePath={location.pathname}
            />
          ))}
        </ul>
      </nav>

      {isDashboard ? (
      <div className="mx-5 mb-6 rounded-3xl border border-[#e5ebf4] bg-[#f8fbff] px-5 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <p className="text-[15px] font-semibold text-[#111827]">Fleet health</p>
        <div className="mt-5 flex items-end gap-2">
          <p className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-[#111827]">98.2%</p>
          <p className="text-[14px] font-semibold text-[#10b981]">^ 1.4%</p>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#e6edf7]">
          <div className="h-full w-[82%] rounded-full bg-[#2f6df6]" />
        </div>
      </div>
      ) : (
      <div className="mx-5 mb-6 border-t border-[#edf2f7] pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e40af] text-[16px] font-black text-white">
            RK
          </div>
          <div>
            <p className="text-[15px] font-black text-[#111827]">Ravi Kumar</p>
            <p className="text-[14px] font-semibold leading-5 text-[#94a3b8]">Fleet<br />Operator</p>
          </div>
        </div>
      </div>
      )}
    </aside>
  );
}
