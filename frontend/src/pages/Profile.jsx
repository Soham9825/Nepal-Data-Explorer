import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import { BtnOutline, BtnPrimary } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { auth, collectionsApi, profileApi } from '../services/auth';

// Where each saved chart opens and which saved filters to restore.
const SAVED_NAV = {
  'tourism-overview-stay': { section: 'tourism-section-stay', params: ['stayRange'] },
  'tourism-overview-arrivals': { section: 'tourism-section-trends', params: ['arrivalRange'] },
  'tourism-overview-revenue': { section: 'tourism-section-trends', params: ['arrivalRange'] },
  'tourism-markets-source': { section: 'tourism-section-markets', params: ['sourceYear'] },
  'tourism-destinations-ranking': { section: 'tourism-section-destinations', params: ['province', 'visitorScope'] },
  'tourism-destinations-trend': { section: 'tourism-section-destination-trend', params: ['province', 'visitorScope'] },
  'tourism-profile-purpose': { section: 'tourism-section-purpose', yearParam: 'purposeYear' },
  'tourism-profile-age': { section: 'tourism-section-age', yearParam: 'ageYear' },
  'tourism-profile-gender': { section: 'tourism-section-gender', yearParam: 'sexYear' },
  'tourism-profile-trekking': { section: 'tourism-section-trekking', yearParam: 'trekkingYear' },
  'economic-sectoral': { path: '/economic', section: 'sectoral', params: ['sectorYear'] },
  'economic-overall': { path: '/economic', section: 'overall' },
  'economic-growth': { path: '/economic', section: 'growth', params: ['growthRange'] },
  'economic-economies': { path: '/economic', section: 'economies' },
  'economic-trade': { path: '/economic', section: 'trade', params: ['tradeRange'] },
  'economic-partners': { path: '/economic', section: 'partners', params: ['partnerView'] },
  'economic-balance': { path: '/economic', section: 'balance', params: ['balanceRange'] },
  'economic-salary': { path: '/economic', section: 'salary' },
  'economic-appi': { path: '/economic', section: 'appi' },
  'economic-province': { path: '/economic', section: 'province', params: ['selectedProvince', 'growthMetric'] },
  'province-dashboard-gdp': { path: (item) => `/provinces/${item.params?.provinceId || 1}`, section: 'gdp' },
  'province-dashboard-growth': { path: (item) => `/provinces/${item.params?.provinceId || 1}`, section: 'growth' },
  'province-dashboard-visits': { path: (item) => `/provinces/${item.params?.provinceId || 1}`, section: 'visits' },
  'province-dashboard-share': { path: (item) => `/provinces/${item.params?.provinceId || 1}`, section: 'share', params: ['shareYear'] },
};

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const roleLabel = (user) => {
  if (user?.is_superuser || user?.is_staff) return 'Administrator';
  return 'Analyst';
};

const shortDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => auth.getCachedUser() || { username: '', email: '' });
  const [collections, setCollections] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [notice, setNotice] = useState(null);
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const noticeTimer = useRef(null);

  const requestRemoveAvatar = () => {
    setConfirm({
      title: 'Remove profile picture?',
      text: 'Your current photo will be removed and replaced with your initials.',
      confirmLabel: 'Remove picture',
      onConfirm: () => {
        setConfirm(null);
        removeAvatar();
      },
    });
  };

  const flash = useCallback((text, kind = 'success') => {
    setNotice({ id: Date.now(), text, kind });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const loadCollections = useCallback(async () => {
    try {
      const data = await collectionsApi.list();
      setCollections(data.collections || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const notifyCollectionsUpdated = () => {
    window.dispatchEvent(new Event('nde-collections-updated'));
  };

  useEffect(() => {
    auth.getCurrentUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
    loadCollections();
  }, [loadCollections]);

  // Avatar is a two-step flow: pick a file to preview it, then press Save to
  // upload. Nothing is committed to the profile while the user is still deciding.
  const pickAvatar = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      flash('Only JPG, PNG or WebP images are allowed.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flash('Image must be under 5 MB.', 'error');
      return;
    }
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingUrl(URL.createObjectURL(file));
    setPendingFile(file);
  };

  const cancelAvatar = () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingUrl(null);
    setPendingFile(null);
  };

  const saveAvatar = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const updated = await profileApi.updateAvatar(pendingFile);
      setUser((prev) => ({ ...prev, ...updated }));
      setError('');
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
      setPendingUrl(null);
      setPendingFile(null);
      flash('Profile picture updated.');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user.avatarUrl) return;
    setUploading(true);
    try {
      const updated = await profileApi.removeAvatar();
      setUser((prev) => ({ ...prev, ...updated }));
      flash('Profile picture removed.');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const createCollection = async () => {
    if (!newName.trim() || savingCollection) return;
    setSavingCollection(true);
    try {
      const created = await collectionsApi.create({
        name: newName.trim(),
        description: newDescription.trim(),
      });
      setCollections((prev) => [created, ...(prev || [])]);
      notifyCollectionsUpdated();
      setNewName('');
      setNewDescription('');
      setCreating(false);
      flash(`Collection “${created.name}” created.`);
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSavingCollection(false);
    }
  };

  const renameCollection = async (id) => {
    try {
      const updated = await collectionsApi.rename(id, { name: renameValue.trim() });
      setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      notifyCollectionsUpdated();
      setRenamingId(null);
      flash(`Renamed to “${updated.name}”.`);
    } catch (err) {
      flash(err.message, 'error');
    }
  };

  const requestDeleteCollection = (collection) => {
    const count = collection.items.length;
    setConfirm({
      title: 'Delete collection?',
      text:
        count > 0
          ? `“${collection.name}” holds ${count} saved item${count === 1 ? '' : 's'}. Removing it also removes its bookmarks. This cannot be undone.`
          : `“${collection.name}” will be removed. This cannot be undone.`,
      confirmLabel: 'Delete collection',
      onConfirm: () => {
        setConfirm(null);
        deleteCollection(collection);
      },
    });
  };

  const deleteCollection = async (collection) => {
    try {
      await collectionsApi.remove(collection.id);
      setCollections((prev) => prev.filter((c) => c.id !== collection.id));
      notifyCollectionsUpdated();
      flash(`Collection “${collection.name}” deleted.`);
    } catch (err) {
      flash(err.message, 'error');
    }
  };

  const deleteItem = async (collectionId, item) => {
    try {
      const data = await collectionsApi.removeItem(collectionId, item.id);
      setCollections((prev) => prev.map((c) => (c.id === collectionId ? data.collection : c)));
      notifyCollectionsUpdated();
      flash(`Removed “${item.title}”.`);
    } catch (err) {
      flash(err.message, 'error');
    }
  };

  // Re-open a saved reading at its original chart with the captured filters.
  const openSaved = (item) => {
    const target = SAVED_NAV[item.chart_key];
    if (!target) {
      navigate('/tourism');
      return;
    }
    const params = new URLSearchParams();
    params.set('section', target.section);
    (target.params || [target.yearParam]).filter(Boolean).forEach((key) => {
      const value = item.params?.[key];
      if (value) params.set(key, value);
    });
    const path = typeof target.path === 'function' ? target.path(item) : target.path || '/tourism';
    navigate(`${path}?${params.toString()}`);
  };

  const totalItems = (collections || []).reduce((sum, c) => sum + c.items.length, 0);
  const initials = getInitials(user.username || user.email);
  const savedCollections = collections || [];

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-onSurface">Your profile</h1>
        <p className="mt-1 text-sm text-onSurface-variant">Manage your account and keep your research views organized.</p>
      </header>
      {/* Toast — confirmation/feedback, auto-dismisses but stays dismissible. */}
      {notice && (
        <div
          key={notice.id}
          role="status"
          className={`animate-toast-up fixed bottom-6 right-6 z-50 flex max-w-sm items-start justify-between gap-3 border px-4 py-3 text-sm font-medium shadow-2xl ${
            notice.kind === 'error'
              ? 'border-red-200 bg-white text-red-700'
              : 'border-green-200 bg-white text-green-800'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                notice.kind === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
              }`}
            >
              <Icon name={notice.kind === 'error' ? 'error' : 'check'} size={12} />
            </span>
            {notice.text}
          </span>
          <button
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
            className="shrink-0 rounded p-0.5 transition-colors hover:bg-surface-highest"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {/* Profile header */}
      <section className="card-shadow overflow-hidden rounded-sm border border-outline-variant bg-surface">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-primary/5 via-surface to-surface px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-bold text-white">
              {pendingUrl || user.avatarUrl ? (
                <img
                  src={pendingUrl || user.avatarUrl}
                  alt={user.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="m-auto">
                  {initials || <Icon name="person" size={28} color="#fff" />}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-onSurface">
                @{user.username || 'User'}
              </h1>
              <p className="truncate text-sm text-onSurface-variant">{user.email}</p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-surface-lowest px-2.5 py-1 text-xs font-semibold text-onSurface-variant">
                <Icon name="badge" size={14} />
                {roleLabel(user)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={pickAvatar}
            />
            {pendingUrl ? (
              <>
                <BtnPrimary onClick={saveAvatar} disabled={uploading}>
                  <Icon name="save" size={16} />
                  {uploading ? 'Saving…' : 'Save picture'}
                </BtnPrimary>
                <BtnOutline onClick={cancelAvatar} disabled={uploading}>
                  Cancel
                </BtnOutline>
              </>
            ) : (
              <>
                <BtnOutline onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Icon name="photo_camera" size={16} />
                  {uploading ? 'Uploading…' : 'Change picture'}
                </BtnOutline>
                {user.avatarUrl && (
                  <BtnOutline onClick={requestRemoveAvatar} disabled={uploading}>
                    <Icon name="no_photography" size={16} />
                    Remove
                  </BtnOutline>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-3 border-t border-outline-variant bg-background p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
          {[
            { label: 'Collections', value: collections?.length ?? '—', icon: 'folder' },
            { label: 'Saved views', value: collections ? totalItems : '—', icon: 'bookmark' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 border border-outline-variant bg-surface px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/5 text-primary">
                <Icon name={stat.icon} size={18} />
              </span>
              <div>
                <p className="text-lg font-bold leading-tight text-onSurface">{stat.value}</p>
                <p className="text-xs font-medium text-onSurface-variant">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <ErrorMessage
          title="Could not load saved collections"
          message={error}
          onRetry={loadCollections}
        />
      )}

      {/* Collections heading */}
      <div className="flex flex-col gap-4 border-b border-outline-variant pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-onSurface">Saved collections</h2>
          <p className="mt-1 max-w-2xl text-sm text-onSurface-variant">
            Keep useful chart views together. Save charts from Tourism, Economic, and Province pages.
          </p>
        </div>
        <BtnPrimary onClick={() => setCreating((open) => !open)}>
          <Icon name="add" size={16} />
          {creating ? 'Close form' : 'New collection'}
        </BtnPrimary>
      </div>

      {/* New collection form */}
      {creating && (
        <div className="card-shadow rounded-sm border border-primary/30 bg-surface p-5 sm:p-6">
          <h3 className="mb-4 text-base font-bold text-onSurface">Create a collection</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-onSurface-variant">
                Collection name
              </span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Tourism arrivals 2020–2025"
                maxLength={80}
                autoFocus
                className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm text-onSurface outline-none transition-colors focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-onSurface-variant">
                Description (optional)
              </span>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What this collection is for"
                maxLength={255}
                className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm text-onSurface outline-none transition-colors focus:border-primary"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <BtnPrimary onClick={createCollection} disabled={!newName.trim() || savingCollection}>
              {savingCollection ? 'Creating…' : 'Create collection'}
            </BtnPrimary>
            <BtnOutline onClick={() => setCreating(false)}>Cancel</BtnOutline>
          </div>
        </div>
      )}

      {/* Collections */}
      {loadingList ? (
        <div className="flex justify-center py-14">
          <Loader size="lg" />
        </div>
      ) : error ? null : !savedCollections.length ? (
        <div className="card-shadow rounded-sm border border-dashed border-outline-variant bg-surface px-5 py-14 text-center sm:py-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/5 text-primary">
            <Icon name="bookmark_add" size={34} color="#9aa1ad" />
          </div>
          <p className="mt-4 text-base font-bold text-onSurface">
            Your collections will show up here
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-onSurface-variant">
            Create a collection, then bookmark charts across Tourism, Economic, or Province to save
            the exact view and filters.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              to="/tourism"
              className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Icon name="flight" size={16} />Tourism charts
            </Link>
            <Link
              to="/economic"
              className="inline-flex items-center gap-1.5 rounded-sm border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-onSurface transition hover:border-primary hover:text-primary"
            >
              <Icon name="monitoring" size={16} />Economic charts
            </Link>
            <Link
              to="/provinces"
              className="inline-flex items-center gap-1.5 rounded-sm border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-onSurface transition hover:border-primary hover:text-primary"
            >
              <Icon name="map" size={16} />Province charts
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {savedCollections.map((collection) => (
            <section
              key={collection.id}
              className="card-shadow flex flex-col overflow-hidden rounded-sm border border-outline-variant bg-surface transition-colors duration-200 hover:border-primary"
            >
              {/* Collection header */}
              <header className="flex items-start justify-between gap-3 border-b border-outline-variant bg-background px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/5 text-primary">
                    <Icon name="folder" size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-onSurface">
                      {collection.name}
                    </h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-onSurface-variant">
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-semibold">
                        <Icon name="bookmark" size={13} />
                        {collection.items.length} saved
                      </span>
                      {collection.description && (
                        <span className="line-clamp-1" title={collection.description}>
                          {collection.description}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => {
                      setRenamingId(collection.id);
                      setRenameValue(collection.name);
                    }}
                    className="rounded-sm p-2 text-onSurface-variant transition-colors hover:bg-surface-highest hover:text-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Rename ${collection.name}`}
                    title="Rename collection"
                  >
                    <Icon name="edit" size={18} />
                  </button>
                  <button
                    onClick={() => requestDeleteCollection(collection)}
                    className="rounded-sm p-2 text-onSurface-variant transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    aria-label={`Delete ${collection.name}`}
                    title="Delete collection"
                  >
                    <Icon name="delete" size={18} />
                  </button>
                </div>
              </header>

              {renamingId === collection.id && (
                <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-3">
                  <input
                    aria-label={`New name for ${collection.name}`}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={80}
                    autoFocus
                    className="w-full max-w-sm rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                  <BtnPrimary
                    onClick={() => renameCollection(collection.id)}
                    disabled={!renameValue.trim()}
                  >
                    Save
                  </BtnPrimary>
                  <BtnOutline onClick={() => setRenamingId(null)}>Cancel</BtnOutline>
                </div>
              )}

              {/* Items */}
              {collection.items.length === 0 ? (
                <div className="flex flex-col items-start gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-onSurface-variant">
                    No saved views yet. Bookmark a chart from any dashboard to add it here.
                  </p>
                  <div className="flex shrink-0 gap-3 text-sm font-semibold">
                    <Link to="/tourism" className="text-primary hover:underline">Tourism</Link>
                    <Link to="/economic" className="text-primary hover:underline">Economic</Link>
                    <Link to="/provinces" className="text-primary hover:underline">Provinces</Link>
                  </div>
                </div>
              ) : (
                <ul className="flex-1 divide-y divide-outline-variant">
                  {collection.items.map((item) => (
                    <li
                      key={item.id}
                      className="group flex items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-background sm:px-5"
                    >
                      <button
                        onClick={() => openSaved(item)}
                        title="Open this saved chart"
                        className="min-w-0 flex-1 cursor-pointer rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="inline-flex w-full items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-onSurface transition-colors group-hover:text-primary">
                            {item.title}
                          </span>
                          <Icon
                            name="arrow_forward"
                            size={14}
                            className="shrink-0 text-primary opacity-60 transition-opacity group-hover:opacity-100"
                          />
                        </span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-onSurface-variant">
                            {item.subtitle}
                          </span>
                        )}
                        {item.note && (
                          <span className="mt-1 block line-clamp-2 text-xs italic text-onSurface-variant">
                            “{item.note}”
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-caption">
                          Saved {shortDate(item.created_at)}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteItem(collection.id, item)}
                        aria-label={`Remove ${item.title}`}
                        title="Remove from collection"
                        className="shrink-0 rounded-sm p-2 text-onSurface-variant transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {/* In-app confirmation for destructive actions — replaces the native browser dialog. */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirm(null);
          }}
        >
          <div className="w-full max-w-md border border-outline-variant bg-surface p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Icon name="delete" size={18} />
              </span>
              <div className="min-w-0">
                <h3 id="confirm-title" className="text-base font-bold text-onSurface">
                  {confirm.title}
                </h3>
                <p className="mt-1 text-sm text-onSurface-variant">{confirm.text}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <BtnOutline onClick={() => setConfirm(null)}>Cancel</BtnOutline>
              <BtnPrimary onClick={confirm.onConfirm}>{confirm.confirmLabel}</BtnPrimary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
