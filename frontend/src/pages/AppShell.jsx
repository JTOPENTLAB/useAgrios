import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Sprout,
  ShoppingCart,
  Package,
  Wallet as WalletIcon,
  Users,
  AlertTriangle,
  Truck,
  Sparkles,
  LogOut,
  Inbox,
  Banknote,
  BarChart3,
  Video,
  Crown,
  Bookmark,
  Mail,
  HeartPulse,
  TrendingUp,
  Bell,
  LineChart,
  Briefcase,
  LandPlot,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import NotificationsBell from "@/components/NotificationsBell";

const NAV = {
  farmer: [
    { to: "/app/farmer", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/app/farmer/listings", label: "My Listings", icon: Sprout },
    { to: "/app/farmer/offers", label: "Offers", icon: Inbox },
    { to: "/app/orders", label: "Orders", icon: Package },
    { to: "/app/farmer/earnings", label: "Earnings", icon: TrendingUp },
    { to: "/app/wallet", label: "Wallet", icon: WalletIcon },
    { to: "/app/farmer/loans", label: "Loans", icon: Banknote },
    { to: "/app/farmer/funding-requests", label: "Raise funding", icon: LandPlot },
    { to: "/app/market", label: "Market intel", icon: LineChart },
    { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/app/farmer/ai", label: "AI Tools", icon: Sparkles },
    { to: "/app/farmer/videos", label: "Video scripts", icon: Video },
    { to: "/app/digest", label: "Market Pulse", icon: Mail },
  ],
  buyer: [
    { to: "/app/home", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/app/marketplace", label: "Marketplace", icon: ShoppingCart },
    { to: "/app/buyer/saved", label: "Saved", icon: Bookmark },
    { to: "/app/buyer/alerts", label: "Price alerts", icon: Bell },
    { to: "/app/orders", label: "My Orders", icon: Package },
    { to: "/app/wallet", label: "Wallet", icon: WalletIcon },
    { to: "/app/market", label: "Market intel", icon: LineChart },
    { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/app/buyer/plans", label: "Plans", icon: Crown },
    { to: "/app/digest", label: "Market Pulse", icon: Mail },
  ],
  logistics: [
    { to: "/app/jobs", label: "Jobs Board", icon: Truck, end: true },
    { to: "/app/wallet", label: "Earnings", icon: WalletIcon },
  ],
  admin: [
    { to: "/app/admin", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/app/admin/users", label: "Users", icon: Users },
    { to: "/app/admin/loans", label: "Loans", icon: Banknote },
    { to: "/app/admin/disputes", label: "Disputes", icon: AlertTriangle },
    { to: "/app/admin/reconcile", label: "Reconcile", icon: HeartPulse },
    { to: "/app/admin/opportunities", label: "Opportunities", icon: Briefcase },
    { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/app/marketplace", label: "Marketplace", icon: ShoppingCart },
    { to: "/app/jobs", label: "Logistics", icon: Truck },
  ],
  investor: [
    { to: "/app/investor", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/app/opportunities", label: "Opportunities", icon: Briefcase },
    { to: "/app/portfolio", label: "Portfolio", icon: LineChart },
    { to: "/app/wallet", label: "Wallet", icon: WalletIcon },
    { to: "/app/digest", label: "Market Pulse", icon: Mail },
  ],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[user?.role] || [];

  const doLogout = () => {
    logout();
    nav("/login");
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2" data-testid="shell-brand">
            <div className="w-9 h-9 rounded-xl bg-brand grid place-items-center text-white font-heading font-extrabold">A</div>
            <span className="font-heading font-extrabold text-xl text-ink">AGRIOS</span>
            <span className="hidden sm:inline ml-3 af-chip capitalize" data-testid="user-role-chip">{user?.role}</span>
          </Link>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <div className="font-semibold text-sm text-ink" data-testid="user-name">{user?.full_name}</div>
              <div className="text-xs text-ink-muted">{user?.email}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand/10 text-brand grid place-items-center font-bold">
              {user?.full_name?.[0]}
            </div>
            <button onClick={doLogout} className="af-btn-ghost" data-testid="logout-btn" title="Log out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid lg:grid-cols-[240px_1fr] gap-6">
        <aside className="lg:sticky lg:top-20 h-fit">
          <nav className="af-card p-3 flex lg:flex-col gap-1 overflow-x-auto" data-testid="sidebar-nav">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                    isActive ? "bg-brand text-white" : "text-ink-soft hover:bg-zinc-100"
                  }`
                }
                data-testid={`nav-${it.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <it.icon className="w-4 h-4 flex-shrink-0" />
                <span>{it.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
