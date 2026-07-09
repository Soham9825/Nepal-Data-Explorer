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
];

const bottomNav = [
  { id: "support", label: "Support", icon: "help_outline", path: "/support" },
];

const DEFAULT_USER = {
  name: "Sunflower",
  role: "Analyst · NPC",
};

export default function Sidebar({ user = DEFAULT_USER, onLogout }) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className="w-64 h-screen flex flex-col border-r border-outline-variant bg-surface shrink-0">

      {/* ================= Logo ================= */}
      <div className="h-16 px-5 border-b border-outline-variant flex items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-xl">
              public
            </span>
          </div>

          <div className="leading-none min-w-0">
            <h1 className="text-lg font-bold text-onSurface truncate">
              Nepal Data
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-onSurface-variant mt-1 truncate">
              Explorer
            </p>
          </div>
        </div>
      </div>

      {/* ================= Main Menu ================= */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant opacity-60">
          Menu
        </p>

        {navItems.map((item) => {
          const isActive =
            currentPath === item.path ||
            (item.path !== "/" && currentPath.startsWith(item.path));

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary text-white"
                  : "text-onSurface-variant hover:bg-surface-container-lowest hover:text-onSurface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="ml-auto h-6 w-1 rounded-full bg-white/30 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ================= Bottom ================= */}
      <div className="border-t border-outline-variant p-4">
        <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant opacity-60">
          General
        </p>

        {bottomNav.map((item) => {
          const isActive = currentPath === item.path;

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary text-white"
                  : "text-onSurface-variant hover:bg-surface-container-lowest hover:text-onSurface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="ml-auto h-6 w-1 rounded-full bg-white/30 shrink-0" />
              )}
            </Link>
          );
        })}

        {/* ================= User Card ================= */}
        <UserCard user={user} variant="card" onLogout={onLogout} className="mt-4" />
      </div>
    </aside>
  );
}