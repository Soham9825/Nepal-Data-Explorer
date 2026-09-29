// ============================================================
// src/layout/TopBar.jsx
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserCard from '../common/UserCard';
import TopBarSearch from './TopBarSearch';

export default function TopBar({ pageTitle, user }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    // From `lg` up both side groups are flex-1, so they take equal width and the
    // search sits dead centre instead of being shoved right by the title. Below
    // `lg` the title still competes for space with the user card, so the sides
    // shrink to their content and the search flexes to fill what is left.
    <div className="flex h-full w-full items-center gap-3 px-8">
      <div className="flex min-w-0 flex-none items-center gap-3 lg:flex-1">
        <h2 className="hidden truncate text-xl font-bold text-onSurface sm:block">{pageTitle}</h2>

        <span className="hidden rounded-sm border border-outline-variant bg-surface-lowest px-3 py-1 text-xs text-onSurface-variant md:inline-flex">
          FY 2082/83
        </span>
      </div>

      <TopBarSearch />

      {/* min-w-0 lets this group yield when the bar is tight, so the search keeps
          a usable width instead of the card being crushed to nothing. */}
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-3 lg:flex-1 lg:shrink">
        {/* The clock is decorative and wide, so it only appears once the bar
            has room for it without pushing the search off centre. */}
        <div className="hidden min-w-[140px] flex-col items-end leading-tight xl:flex">
          <span className="text-sm font-semibold text-onSurface">{formattedTime}</span>
          <span className="text-xs text-onSurface-variant">{formattedDate}</span>
        </div>

        <UserCard user={user} variant="compact" onOpenProfile={() => navigate('/profile')} />
      </div>
    </div>
  );
}
