// ============================================================
// src/layout/TopBar.jsx
// ============================================================
import React, { useState, useEffect } from "react";
import UserCard from "../common/UserCard";

export default function TopBar({ pageTitle, user }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="max-w-7xl w-full mx-auto h-full px-8 flex items-center justify-between">
      {/* Left */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-onSurface">{pageTitle}</h2>

        <span className="text-xs bg-surface-container-lowest px-3 py-1 rounded-sm border border-outline-variant text-onSurface-variant">
          FY 2082/83
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-5">
        {/* Search */}
        <div className="relative hidden md:block">
          <input
            type="text"
            placeholder="Search indicators, provinces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-outline-variant rounded-sm text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-72 transition-all"
          />
          <span className="material-symbols-outlined text-[20px] text-onSurface-variant absolute left-2.5 top-1/2 -translate-y-1/2">
            search
          </span>
        </div>

        {/* Mobile Search */}
        <button className="ui-button md:hidden p-2 rounded-sm hover:bg-surface-container-lowest transition-colors">
          <span className="material-symbols-outlined text-[22px] text-onSurface-variant">
            search
          </span>
        </button>

        {/* Live Date & Time */}
        <div className="hidden lg:flex flex-col items-end leading-tight min-w-[140px]">
          <span className="text-sm font-semibold text-onSurface">
            {formattedTime}
          </span>
          <span className="text-xs text-onSurface-variant">
            {formattedDate}
          </span>
        </div>

        {/* User */}
        <UserCard user={user} variant="compact" />
      </div>
    </div>
  );
}