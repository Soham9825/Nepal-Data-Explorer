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
 */
export default function UserCard({ user, variant = 'compact', onLogout, className = '' }) {
  const currentUser = user || { name: 'Guest User', role: 'Viewer' };
  const initials = getInitials(currentUser.name);

  if (variant === 'card') {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl bg-surface-lowest p-3 min-w-0 ${className}`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white overflow-hidden">
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

        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-onSurface">{currentUser.name}</p>
          <p className="truncate text-xs text-onSurface-variant">{currentUser.role}</p>
        </div>

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
  return (
    <div
      className={`flex items-center gap-2 pl-4 border-l border-outline-variant min-w-0 ${className}`}
    >
      {currentUser.avatarUrl ? (
        <img
          src={currentUser.avatarUrl}
          alt={currentUser.name}
          className="w-8 h-8 rounded-sm object-cover shrink-0"
        />
      ) : (
        <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center text-white text-sm font-bold shrink-0">
          {initials}
        </div>
      )}
      <div className="hidden md:block min-w-0">
        <p className="text-sm font-semibold text-onSurface leading-tight truncate">
          {currentUser.name}
        </p>
        <p className="text-xs text-onSurface-variant leading-tight truncate">{currentUser.role}</p>
      </div>
    </div>
  );
}
