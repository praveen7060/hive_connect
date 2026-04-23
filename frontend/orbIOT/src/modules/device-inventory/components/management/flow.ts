import { NAV_ITEMS } from "../../../../app/router/navigation";

const deviceInventoryItem = NAV_ITEMS.find((item) => item.id === "devices");
const deviceQueryKeys = (deviceInventoryItem?.subItems ?? []).map((subItem) => subItem.queryKey);

export function getAdjacentDeviceQueryKey(
  currentQueryKey: string,
  direction: "previous" | "next"
): string | undefined {
  const currentIndex = deviceQueryKeys.indexOf(currentQueryKey);
  if (currentIndex < 0) return undefined;

  const adjacentIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
  if (adjacentIndex < 0 || adjacentIndex >= deviceQueryKeys.length) return undefined;

  return deviceQueryKeys[adjacentIndex];
}

export function buildDevicePageUrl(queryKey: string): string {
  return `/devices?${queryKey}`;
}
