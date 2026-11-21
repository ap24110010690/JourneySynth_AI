import React from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Cpu,
  Database,
  FileCode2,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { PageKey } from '../types';

interface NavItem {
  key: PageKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'dataset', label: 'Dataset Preparation', icon: Database },
  { key: 'generation', label: 'Synthetic Generation', icon: Cpu },
  { key: 'validation', label: 'Data Validation', icon: ShieldCheck },
  { key: 'analytics', label: 'Journey Analytics', icon: BarChart3 },
  { key: 'explorer', label: 'Customer Explorer', icon: Users },
  { key: 'model-testing', label: 'Model Testing', icon: FlaskConical },
  { key: 'api-docs', label: 'API Documentation', icon: FileCode2 },
  { key: 'history', label: 'Generation History', icon: History },
  { key: 'settings', label: 'Settings', icon: Settings },
];

interface LayoutProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  backendHealthy: boolean | null;
  activeDatasetName?: string;
  onQuickGenerate: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  activePage,
  onNavigate,
  backendHealthy,
  activeDatasetName,
  onQuickGenerate,
  children,
}) => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const currentNav = NAV_ITEMS.find((n) => n.key === activePage) || NAV_ITEMS[0];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#091020] border-r border-slate-800/80">
      <div className="px-5 py-5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center border border-blue-400/20 shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-slate-100 text-base tracking-tight whitespace-nowrap">
              JourneySynth AI
            </div>
            <div className="text-[11px] text-slate-400 whitespace-nowrap">
              Generate. Validate. Understand.
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onNavigate(item.key);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {user && (
        <div className="p-3 mx-3 mb-2 rounded-xl bg-slate-900/90 border border-slate-800/90">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0 border border-blue-400/30">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">{user.full_name}</div>
                <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-3.5 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center justify-between gap-2">
          <span>FastAPI Engine</span>
          <span className={backendHealthy ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
            {backendHealthy === null ? 'Checking' : backendHealthy ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070D19] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-full h-full z-10">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-[#091020]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">JourneySynth AI</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-slate-100 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 min-w-0">
            <span>Active Dataset:</span>
            <span className="text-slate-200 font-medium truncate max-w-[240px]">
              {activeDatasetName || 'sample_journey_data.csv'}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onQuickGenerate}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Generate Journeys</span>
            </button>

            {user && (
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[130px]">{user.full_name}</span>
                  <span className="text-[10px] text-blue-400 font-mono leading-none">{user.role || 'Analyst'}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0 border border-blue-400/30">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
