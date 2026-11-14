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
  // TODO(Phase 2): enable once the booking list page exists.
  { key: "bookings", label: "รายการจอง", href: "/backoffice/bookings", icon: "list", group: "frontdesk", requiredRole: "staff", available: false },
  // TODO(Phase 2): enable once the calendar page exists.
  { key: "calendar", label: "ปฏิทินการจอง", href: "/backoffice/calendar", icon: "calendar", group: "frontdesk", requiredRole: "staff", available: false },
  // TODO(Phase 3): dashboard.
  { key: "dashboard", label: "Dashboard", href: "/backoffice/dashboard", icon: "chart", group: "admin", requiredRole: "admin", available: false },
  // TODO(Phase 1): admin settings pages.
  { key: "tables", label: "จัดการโต๊ะ", href: "/backoffice/tables", icon: "tables", group: "admin", requiredRole: "admin", available: false },
  { key: "hours", label: "เวลาทำการ / วันหยุด", href: "/backoffice/hours", icon: "clock", group: "admin", requiredRole: "admin", available: false },
  { key: "users", label: "ผู้ใช้งาน", href: "/backoffice/users", icon: "users", group: "admin", requiredRole: "admin", available: false },
];

export function getMenuForRole(role: AppRole): MenuItem[] {
  return MENU.filter((item) => hasRole(role, item.requiredRole));
}
