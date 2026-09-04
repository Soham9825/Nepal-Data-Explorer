// ============================================================
// src/layout/TopBar.jsx
// ============================================================
import React, { useEffect, useState } from "react";
import UserCard from "../common/UserCard";

export default function TopBar({ pageTitle, user }) {
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