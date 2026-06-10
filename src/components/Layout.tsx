import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Users,
  Lightbulb,
  BookOpen,
  Settings,
  LogOut,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/belege", label: "Belege", icon: Receipt },
  { to: "/rechnungen", label: "Rechnungen", icon: FileText },
  { to: "/buchhaltung", label: "Buchhaltung", icon: BookOpen },
  { to: "/kunden", label: "Kunden", icon: Users, businessOnly: true },
  { to: "/insights", label: "KI-Insights", icon: Lightbulb },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export function Layout() {
  const { profile, user, signOut } = useAuth();
  const isBusiness = profile?.account_type !== "private";

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Wallet size={20} />
          </div>
          <div>
            <div className="font-bold leading-tight">BizManager</div>
            <div className="text-xs text-gray-500">KI-Buchhaltung Schweiz</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems
            .filter((item) => !item.businessOnly || isBusiness)
            .map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <div className="mb-2 truncate text-sm font-medium">
            {profile?.full_name ?? user?.email}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <LogOut size={16} /> Abmelden
          </button>
        </div>
      </aside>
      <main className="ml-60 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
