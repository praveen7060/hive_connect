import type { ComponentType } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { NAV_ITEMS } from "../../app/router/navigation";
import CommunicationManagementPage from "./components/CommunicationManagement/CommunicationPage";
import DeviceManagementPage from "./components/DeviceManagement/DevicePage";
import ItemManagementPage from "./components/ItemManagement/ItemPage";
import ItemTypeManagementPage from "./components/ItemtypeManagement/ItemtypePage";
import MessagingManagementPage from "./components/MessageManagement/MessagePage";
import ParameterManagementPage from "./components/ParameterManagement/ParameterPage";
import VendorManagementPage from "./components/VendorManagement/VendorPage";

const deviceInventoryItem = NAV_ITEMS.find((item) => item.id === "devices");
const subItems = deviceInventoryItem?.subItems ?? [];

const sectionByQueryKey: Record<string, ComponentType> = {
  vendorPage: VendorManagementPage,
  parameterPage: ParameterManagementPage,
  itemTypePage: ItemTypeManagementPage,
  communicationPage: CommunicationManagementPage,
  messagingPage: MessagingManagementPage,
  itemPage: ItemManagementPage,
  devicePage: DeviceManagementPage,
};

export default function DeviceInventoryPage() {
  const [searchParams] = useSearchParams();
  const activeSubItem = subItems.find((subItem) => searchParams.has(subItem.queryKey));
  const fallbackSubItem = subItems[0];

  if (!activeSubItem && fallbackSubItem) {
    return <Navigate to={`/devices?${fallbackSubItem.queryKey}`} replace />;
  }

  if (!activeSubItem) {
    return (
      <section className="">
        <p className="expo-card-title text-slate-950">Device Inventory</p>
        <p className="expo-body mt-2 text-slate-600">
          No Device Inventory sub-pages are currently configured.
        </p>
      </section>
    );
  }

  const ActiveSection = sectionByQueryKey[activeSubItem.queryKey];

  if (!ActiveSection && fallbackSubItem) {
    return <Navigate to={`/devices?${fallbackSubItem.queryKey}`} replace />;
  }

  if (!ActiveSection) {
    return (
      <section className="">
        <p className="expo-card-title text-slate-950">Device Inventory</p>
        <p className="expo-body mt-2 text-slate-600">
          No page component is mapped for this sub-heading yet.
        </p>
      </section>
    );
  }

  return <ActiveSection />;
}

