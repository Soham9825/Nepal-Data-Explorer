// ============================================================
// src/layout/Sidebar.jsx
// ============================================================

import React from "react";
import { Link, useLocation } from "react-router-dom";
import UserCard from "../common/UserCard";

const navItems = [
  { id: "national", label: "National", icon: "dashboard", path: "/" },
  { id: "economic", label: "Economic", icon: "payments", path: "/economic" },
  { id: "tourism", label: "Tourism", icon: "flight", path: "/tourism" },
  { id: "compare", label: "Compare Data", icon: "compare_arrows", path: "/compare" },
  { id: "predictions", label: "AI Predictions", icon: "auto_awesome", path: "/predictions" },
  { id: "reports", label: "Reports", icon: "description", path: "/reports" },
  { id: "research", label: "Research Data", icon: "dataset", path: "/research" },

  // CSV Visualization
  { id: "csv-explorer", label: "CSV Explorer", icon: "upload_file", path: "/csv-explorer" },
];
const bottomNav = [
  { id: "support", label: "Support", icon: "help_outline", path: "/support" },
];

const DEFAULT_USER = {
  role: "Analyst · NPC",
};

export default function Sidebar({ user = DEFAULT_USER, onLogout, collapsed, onToggle }) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className={`${collapsed ? "w-20" : "w-64"} relative h-screen flex flex-col border-r border-outline-variant bg-surface shrink-0 shadow-sm transition-[width] duration-200`}>

      {/* ================= Logo ================= */}
      <div className={`h-16 border-b border-outline-variant flex items-center ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-xl">
              public
            </span>
          </div>

          {!collapsed && <div className="leading-none min-w-0">
            <h1 className="text-lg font-bold text-onSurface truncate">
              Nepal Data
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-onSurface-variant mt-1 truncate">
              Explorer
            </p>
          </div>}
        </div>
      </div>
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[4.25rem] z-50 flex h-7 w-7 items-center justify-center rounded-full border border-outline-variant bg-surface text-onSurface-variant shadow-md transition-colors hover:bg-primary hover:text-white"
      >
        <span className="material-symbols-outlined text-[18px]">
          {collapsed ? "chevron_right" : "chevron_left"}
        </span>
      </button>

      {/* ================= Main Menu ================= */}
      <nav className={`flex-1 space-y-1 overflow-y-auto ${collapsed ? "p-3 pt-12" : "p-4"}`}>
        {!collapsed && <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant opacity-60">Menu</p>}

        {navItems.map((item) => {
          const isActive =
            currentPath === item.path ||
            (item.path !== "/" && currentPath.startsWith(item.path));

          return (
            <Link
              key={item.id}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg py-3 text-sm font-medium transition-all duration-200 ${collapsed ? "justify-center px-2" : "gap-3 px-4"} ${
                isActive
                  ? "bg-primary text-white"
                  : "text-onSurface-variant hover:bg-surface-container-lowest hover:text-onSurface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto h-6 w-1 rounded-full bg-white/30 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ================= Bottom ================= */}
      <div className={`${collapsed ? "p-3" : "p-4"} border-t border-outline-variant`}>
        {!collapsed && <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant opacity-60">General</p>}

        {bottomNav.map((item) => {
          const isActive = currentPath === item.path;

          return (
            <Link
              key={item.id}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg py-3 text-sm font-medium transition-all duration-200 ${collapsed ? "justify-center px-2" : "gap-3 px-4"} ${
                isActive
                  ? "bg-primary text-white"
                  : "text-onSurface-variant hover:bg-surface-container-lowest hover:text-onSurface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto h-6 w-1 rounded-full bg-white/30 shrink-0" />
              )}
            </Link>
          );
        })}

        {/* ================= User Card ================= */}
        {collapsed ? (
          <div className="mt-4 flex justify-center" title={user.name}>
            <div className="flex items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                {user.name.trim().slice(0, 2).toUpperCase()}
              </div>
              {onLogout && (
                <button onClick={onLogout} className="rounded-lg p-2 hover:bg-surface-container-highest transition-colors" aria-label="Log out" title="Log out">
                  <span className="material-symbols-outlined text-[18px] text-onSurface-variant">logout</span>
                </button>
              )}
            </div>
          </div>
        ) : <UserCard user={user} variant="card" onLogout={onLogout} className="mt-4" />}
      </div>
    </aside>
  );
}