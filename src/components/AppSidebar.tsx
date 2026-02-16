"use client";

const navItems = [
  { key: "dashboard", icon: "📊", label: "Dashboard" },
  { key: "accounts", icon: "👥", label: "Accounts" },
  { key: "calls", icon: "📞", label: "Calls" },
  { key: "calendar", icon: "📅", label: "Calendar" },
];

interface AppSidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

export function AppSidebar({ activePage, onNavigate }: AppSidebarProps) {
  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col bg-[#1A1D23]">
      {/* Logo */}
      <div className="px-6 pt-7 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🚀</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              PilotCRM
            </h1>
            <p className="text-[11px] text-gray-500">Account Management</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const active = activePage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[#E85D04]/15 text-[#E85D04]"
                  : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E85D04] text-xs font-bold text-white">
            CS
          </div>
          <div>
            <p className="text-sm font-medium text-white">Cem S.</p>
            <p className="text-[11px] text-gray-500">Account Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
