// ============================================================
// src/layout/DashboardLayout.jsx
// ============================================================
import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const CURRENT_USER = {
  name: 'Sunflower',
  role: 'Analyst · NPC',
  // avatarUrl: '/path/to/photo.jpg', // add when you have real avatars
};

export default function DashboardLayout({ children, pageTitle }) {
  const handleLogout = () => {
    // TODO: wire up real logout logic, e.g.:
    // localStorage.removeItem('authToken');
    // window.location.href = '/login';
    console.log('Logging out...');
  };

  return (
    <div className="h-screen bg-background">
      {/* Fixed Sidebar */}
      <aside className="fixed left-0 top-0 w-64 h-screen z-40">
        <Sidebar user={CURRENT_USER} onLogout={handleLogout} />
      </aside>

      {/* Main Area */}
      <div className="ml-64 flex h-screen flex-col">
        {/* Fixed Top Navigation */}
        <header className="fixed left-64 right-0 top-0 h-16 bg-surface border-b border-outline-variant z-30">
          <TopBar pageTitle={pageTitle} user={CURRENT_USER} />
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