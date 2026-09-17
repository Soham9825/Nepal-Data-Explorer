// ============================================================
// src/layout/DashboardLayout.jsx
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { auth } from '../../services/auth';

const DEFAULT_USER = {
  name: 'User',
  role: 'Analyst · NPC',
};

export default function DashboardLayout({ children, pageTitle }) {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
    window.localStorage.getItem('nepal-data-sidebar-collapsed') === 'true'
  ));
  const [currentUser, setCurrentUser] = useState(() => {
    const cachedUser = auth.getCachedUser();
    return cachedUser
      ? {
        name: cachedUser.username || cachedUser.email || DEFAULT_USER.name,
        role: cachedUser.role || (cachedUser.is_superuser || cachedUser.is_staff ? 'Administrator' : DEFAULT_USER.role),
        avatarUrl: cachedUser.avatarUrl,
        isStaff: cachedUser.is_staff || cachedUser.is_superuser || false,
      }
      : DEFAULT_USER;
  });

  useEffect(() => {
    window.localStorage.setItem('nepal-data-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    let mounted = true;
    auth.getCurrentUser()
      .then((user) => {
        if (!mounted || !user) return;
        setCurrentUser({
          name: user.username || user.email || DEFAULT_USER.name,
          role: user.role || (user.is_superuser || user.is_staff ? 'Administrator' : DEFAULT_USER.role),
          avatarUrl: user.avatarUrl,
          isStaff: user.is_staff || user.is_superuser || false,
        });
      })
      .catch((error) => {
        console.warn('Could not load current user', error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      if (!await auth.logout()) throw new Error('Logout failed');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Could not log out', error);
      window.alert('Could not log out. Please try again.');
    }
  };

  return (
    <div className="h-screen bg-background">
      {/* Fixed Sidebar */}
      <aside className={`fixed left-0 top-0 ${sidebarCollapsed ? "w-20" : "w-64"} h-screen z-40 transition-[width] duration-200`}>
        <Sidebar user={currentUser} onLogout={handleLogout} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      </aside>

      {/* Main Area */}
      <div className={`${sidebarCollapsed ? "ml-20" : "ml-64"} flex h-screen flex-col transition-[margin] duration-200`}>
        {/* Fixed Top Navigation */}
        <header className={`fixed ${sidebarCollapsed ? "left-20" : "left-64"} right-0 top-0 h-16 bg-surface border-b border-outline-variant z-30 transition-[left] duration-200`}>
          <TopBar pageTitle={pageTitle} user={currentUser} />
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pt-16">
          <div className="min-h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex-1 max-w-7xl w-full mx-auto px-8 py-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}