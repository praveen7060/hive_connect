import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AppWindow,
  BarChart2,
  Bell,
  HardDrive,
  Layers,
  LayoutDashboard,
  Package,
  RefreshCw,
  Sliders,
  Users,
} from "lucide-react";

export interface AppNavItem {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
  subItems?: AppNavSubItem[];
  stats: Array<{
    label: string;
    value: string;
    helper: string;
  }>;
}

export interface AppNavSubItem {
  id: string;
  label: string;
  queryKey: string;
  viewPath: string;
}

export const NAV_ITEMS: AppNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    description: "Track fleet health, key system events, and the current operational posture in one place.",
    icon: LayoutDashboard,
    stats: [
      { label: "Live Devices", value: "1,284", helper: "Connected in the last 5 minutes" },
      { label: "Alerts Open", value: "18", helper: "Needs operator attention" },
      { label: "Success Rate", value: "99.2%", helper: "Command delivery this week" },
    ],
  },
  {
    id: "devices",
    label: "Device Management",
    path: "/devices",
    description: "Review enrolled devices, assigned sites, and lifecycle status across the fleet.",
    icon: HardDrive,
    subItems: [
      {
        id: "device-management",
        label: "Device Management",
        queryKey: "devicePage",
        viewPath: "Deviceinventory/pages/DeviceManagement",
      },
    ],
    stats: [
      { label: "Registered", value: "3,906", helper: "Total devices cataloged" },
      { label: "Dormant", value: "112", helper: "No heartbeat in 24 hours" },
      { label: "Warehouses", value: "14", helper: "Locations currently mapped" },
    ],
  },
  {
    id: "applications",
    label: "Applications",
    path: "/applications",
    description: "Manage registered mobile and web applications that can claim devices, scan enrollment QR codes, and issue commands.",
    icon: AppWindow,
    stats: [
      { label: "Registered Apps", value: "12", helper: "Configured across environments" },
      { label: "Claim Sessions", value: "38", helper: "Recent QR-driven enrollments" },
      { label: "Trusted Clients", value: "9", helper: "Active application keys in use" },
    ],
  },
  {
    id: "control",
    label: "Device Control",
    path: "/device-control",
    description: "Dispatch commands, schedule remote actions, and confirm execution feedback.",
    icon: Sliders,
    stats: [
      { label: "Queued Jobs", value: "24", helper: "Awaiting dispatch" },
      { label: "Last Action", value: "2 min", helper: "Since most recent command" },
      { label: "Failure Rate", value: "0.8%", helper: "Across the last 100 actions" },
    ],
  },
  {
    id: "groups",
    label: "Device Groups",
    path: "/device-groups",
    description: "Organize devices by site, environment, model, or rollout cohort.",
    icon: Layers,
    stats: [
      { label: "Smart Groups", value: "22", helper: "Rule-based collections" },
      { label: "Manual Groups", value: "9", helper: "Operator-curated lists" },
      { label: "Largest Group", value: "418", helper: "Devices in production east" },
    ],
  },
  {
    id: "telemetry",
    label: "Telemetry",
    path: "/telemetry",
    description: "Inspect incoming sensor streams, ingestion rates, and recent anomalies.",
    icon: Activity,
    stats: [
      { label: "Messages / Min", value: "48k", helper: "Current ingestion pace" },
      { label: "Drift Flags", value: "13", helper: "Metrics outside expected range" },
      { label: "Retention", value: "90d", helper: "Configured telemetry history" },
    ],
  },
  {
    id: "firmware",
    label: "Firmware Mgmt",
    path: "/firmware",
    description: "Catalog firmware packages, rollout readiness, and compatibility coverage.",
    icon: Package,
    stats: [
      { label: "Builds", value: "37", helper: "Published firmware versions" },
      { label: "Approved", value: "11", helper: "Cleared for rollout" },
      { label: "Blocked", value: "3", helper: "Pending QA sign-off" },
    ],
  },
  {
    id: "ota",
    label: "OTA Updates",
    path: "/ota-updates",
    description: "Monitor live update campaigns, retries, and staged deployment progress.",
    icon: RefreshCw,
    stats: [
      { label: "Campaigns Live", value: "4", helper: "Rolling out right now" },
      { label: "Retry Queue", value: "29", helper: "Devices scheduled to retry" },
      { label: "Completion", value: "76%", helper: "Average across active campaigns" },
    ],
  },
  {
    id: "alerts",
    label: "Alerts",
    path: "/alerts",
    description: "Triage incidents, policy violations, and threshold breaches requiring review.",
    icon: Bell,
    stats: [
      { label: "Critical", value: "6", helper: "Needs immediate response" },
      { label: "Acknowledged", value: "41", helper: "Being tracked by operators" },
      { label: "Muted Rules", value: "8", helper: "Temporarily suppressed policies" },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    path: "/monitoring",
    description: "Observe service uptime, broker health, and platform-wide operational trends.",
    icon: BarChart2,
    stats: [
      { label: "Platform Uptime", value: "99.97%", helper: "Past 30 days" },
      { label: "Broker Load", value: "61%", helper: "Current utilization" },
      { label: "Latency P95", value: "182ms", helper: "API response percentile" },
    ],
  },
  {
    id: "users",
    label: "User Management",
    path: "/users",
    description: "Manage operators, roles, and workspace access for the IoT control environment.",
    icon: Users,
    stats: [
      { label: "Active Users", value: "64", helper: "Signed in during the last 30 days" },
      { label: "Pending Invites", value: "7", helper: "Waiting for acceptance" },
      { label: "Admin Roles", value: "5", helper: "Privileged accounts in scope" },
    ],
  },
];

export const DEFAULT_ROUTE = NAV_ITEMS[0]?.path ?? "/dashboard";
