function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Shared user identity block — used in TopBar and Sidebar.
 *
 * variant="compact"  -> avatar + name/role only (TopBar style, no card bg)
 * variant="card"     -> avatar + name/role + logout button, in a bg card (Sidebar style)
 *
 * Passing `onOpenProfile` makes the identity (avatar + name) clickable so the user
 * can reach their profile page; the logout button keeps its own handler.
 */
export default function UserCard({
  user,
  variant = 'compact',
  onLogout,
  onOpenProfile,
  className = '',
}) {
  const currentUser = user || { name: 'Guest User', role: 'Viewer' };
  const initials = getInitials(currentUser.name);

  const identity = (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-white">
      {currentUser.avatarUrl ? (
        <img
          src={currentUser.avatarUrl}
          alt={currentUser.name}
          className="w-full h-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );

  const nameRole = (
    <div className="min-w-0 flex-1 overflow-hidden">
      <p className="truncate text-sm font-semibold text-onSurface">{currentUser.name}</p>
      <p className="truncate text-xs text-onSurface-variant">{currentUser.role}</p>
    </div>
  );

  if (variant === 'card') {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl bg-surface-lowest p-3 min-w-0 ${className}`}
      >
        {onOpenProfile ? (
          <button
            onClick={onOpenProfile}
            title="Open profile"
            aria-label="Open profile"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:bg-surface-highest"
          >
            {identity}
            {nameRole}
          </button>
        ) : (
          <>
            {identity}
            {nameRole}
          </>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            className="shrink-0 rounded-lg p-2 hover:bg-surface-highest transition-colors"
            aria-label="Log out"
          >
            <span className="material-symbols-outlined text-[18px] text-onSurface-variant">
              logout
            </span>
          </button>
        )}
      </div>
    );
  }

  // compact variant (TopBar)
  const compactContent = (
    <>
      {currentUser.avatarUrl ? (
        <img
          src={currentUser.avatarUrl}
          alt={currentUser.name}
          className="w-8 h-8 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
          {initials}
        </div>
      )}
      <div className="hidden md:block min-w-0">
        <p className="text-sm font-semibold text-onSurface leading-tight truncate">
          {currentUser.name}
        </p>
        <p className="text-xs text-onSurface-variant leading-tight truncate">{currentUser.role}</p>
      </div>
    </>
  );

  // compact variant (TopBar) — a rounded pill so the hover highlight hugs the
  // identity instead of painting a full-height rectangle with hard corners.
  const compactClass = `flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 min-w-0 ${className}`;
  if (onOpenProfile) {
    return (
      <button
        onClick={onOpenProfile}
        title="Open profile"
        aria-label="Open profile"
        className={`${compactClass} border-l border-outline-variant transition-colors hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary`}
      >
        {compactContent}
      </button>
    );
  }

  return <div className={compactClass}>{compactContent}</div>;
}
