import { MessageSquare, Users, Phone, Settings, LayoutDashboard, Shield } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof MessageSquare;
  adminOnly?: boolean;
  desktopOnly?: boolean;
}

export const navItems: NavItem[] = [
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, desktopOnly: true },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true, desktopOnly: true },
];
