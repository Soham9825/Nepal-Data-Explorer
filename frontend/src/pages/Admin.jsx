import { useEffect, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { SectionCard } from "../components/ui/Card";
import { BtnPrimary } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import Loader from "../components/common/Loader";
import ErrorMessage from "../components/common/ErrorMessage";
import auth from "../services/auth";
import { API_BASE_URL } from "../config";

const ADMIN_USERS_URL = `${API_BASE_URL}/accounts/api/admin/users/`;
const DJANGO_ADMIN_URL = `${API_BASE_URL}/admin/`;

const RoleBadge = ({ isSuperuser, isStaff }) => {
  if (isSuperuser) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "#b70011" }}>
        <Icon name="shield" size={13} /> Superadmin
      </span>
    );
  }
  if (isStaff) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "#0051d5" }}>
        <Icon name="admin_panel_settings" size={13} /> Staff
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold bg-surface-container-lowest text-onSurface-variant">
      User
    </span>
  );
};

export default function Admin() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const currentUser = auth.getCachedUser();

  const loadUsers = () => {
    setError(null);
    setUsers(null);
    (async () => {
      try {
        const res = await fetch(ADMIN_USERS_URL, {
          headers: auth.authenticatedHeaders(),
          credentials: "include",
        });
        if (!res.ok) {
          if (res.status === 401) throw new Error("Your session has expired. Please sign in again.");
          if (res.status === 403) throw new Error("You do not have administrator access.");
          throw new Error("Could not load admin data.");
        }
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        setError(err);
      }
    })();
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = (users || []).filter((user) =>
    `${user.username} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  const adminCount = (users || []).filter((user) => user.is_staff || user.is_superuser).length;

  return (
    <DashboardLayout pageTitle="Admin Panel">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-onSurface">Administration</h2>
          <p className="mt-1 text-sm text-onSurface-variant">
            Manage users and access the Django administration console.
          </p>
        </div>
        <a href={DJANGO_ADMIN_URL} target="_blank" rel="noreferrer">
          <BtnPrimary>
            <Icon name="open_in_new" size={16} /> Django Admin
          </BtnPrimary>
        </a>
      </div>

      {/* Account summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SectionCard className="rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-onSurface-variant">Signed in as</p>
          <p className="mt-2 truncate text-lg font-bold text-onSurface">
            {currentUser?.username || "Administrator"}
          </p>
          <p className="mt-1 truncate text-sm text-onSurface-variant">{currentUser?.email || ""}</p>
        </SectionCard>
        <SectionCard className="rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-onSurface-variant">Registered users</p>
          <p className="mt-2 text-lg font-bold text-onSurface">{users ? users.length : "…"}</p>
        </SectionCard>
        <SectionCard className="rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-onSurface-variant">Administrators</p>
          <p className="mt-2 text-lg font-bold text-onSurface">{users ? adminCount : "…"}</p>
        </SectionCard>
      </div>

      {/* User management */}
      <SectionCard
        title="Users"
        subtitle="Search and review registered accounts. Account management lives in the Django admin console."
        className="rounded-xl"
        contentClassName="p-0"
      >
        {error ? (
          <div className="p-5">
            <ErrorMessage title="Could not load users" message={error.message} onRetry={loadUsers} />
          </div>
        ) : users === null ? (
          <Loader />
        ) : (
          <>
            <div className="p-5 pb-0">
              <div className="relative max-w-sm">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-onSurface-variant">
                  <Icon name="search" size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Search by username or email…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-md border border-outline-variant bg-white py-2 pl-10 pr-3 text-sm text-onSurface outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-left text-xs font-bold uppercase tracking-wider text-onSurface-variant">
                    <th className="py-3 pr-4">Username</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Role</th>
                    <th className="py-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-sm text-onSurface-variant">
                        No matching users.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-outline-variant last:border-b-0">
                        <td className="py-3 pr-4 font-semibold text-onSurface">{user.username}</td>
                        <td className="py-3 pr-4 text-onSurface-variant">{user.email}</td>
                        <td className="py-3 pr-4">
                          <RoleBadge isSuperuser={user.is_superuser} isStaff={user.is_staff} />
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs"
                            style={{ color: user.is_active ? "#0f7a3d" : "#b70011" }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: user.is_active ? "#0f7a3d" : "#b70011" }}
                            />
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </DashboardLayout>
  );
}