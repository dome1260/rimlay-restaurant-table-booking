import { hasRole, type AppRole } from "./roles";

export type MenuIcon = "home" | "list" | "calendar" | "chart" | "tables" | "clock" | "users";

export type MenuItem = {
  key: string;
  label: string;
  href: string;
  icon: MenuIcon;
  group: "frontdesk" | "admin";
  requiredRole: AppRole;
  // Pages land in later phases; until then the item is shown but not clickable.
  available: boolean;
};

const MENU: MenuItem[] = [
  { key: "home", label: "หน้าหลัก", href: "/backoffice", icon: "home", group: "frontdesk", requiredRole: "staff", available: true },
  { key: "bookings", label: "รายการจอง", href: "/backoffice/bookings", icon: "list", group: "frontdesk", requiredRole: "staff", available: true },
  { key: "calendar", label: "ปฏิทินการจอง", href: "/backoffice/calendar", icon: "calendar", group: "frontdesk", requiredRole: "staff", available: true },
  // TODO(Phase 3): dashboard.
  { key: "dashboard", label: "Dashboard", href: "/backoffice/dashboard", icon: "chart", group: "admin", requiredRole: "admin", available: false },
  { key: "tables", label: "จัดการโต๊ะ", href: "/backoffice/tables", icon: "tables", group: "admin", requiredRole: "admin", available: true },
  { key: "hours", label: "เวลาทำการ / วันหยุด", href: "/backoffice/hours", icon: "clock", group: "admin", requiredRole: "admin", available: true },
  { key: "users", label: "ผู้ใช้งาน", href: "/backoffice/users", icon: "users", group: "admin", requiredRole: "admin", available: true },
];

export function getMenuForRole(role: AppRole): MenuItem[] {
  return MENU.filter((item) => hasRole(role, item.requiredRole));
}

const BOTTOM_NAV_SLOTS = 5;

// Phone bottom bar: up to 5 items. With more, the first 4 stay and the last slot becomes a
// "more" button that opens the rest. Items whose page does not exist yet are left out.
export function splitBottomNav(items: MenuItem[]): { bar: MenuItem[]; more: MenuItem[] } {
  const available = items.filter((item) => item.available);
  if (available.length <= BOTTOM_NAV_SLOTS) return { bar: available, more: [] };
  return { bar: available.slice(0, BOTTOM_NAV_SLOTS - 1), more: available.slice(BOTTOM_NAV_SLOTS - 1) };
}
