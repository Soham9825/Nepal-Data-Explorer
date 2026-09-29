import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { collectionsApi } from '../../../services/auth';

let collectionCache = null;
let collectionCacheTime = 0;
const COLLECTION_CACHE_MS = 15000;

/** Bookmark a chart into one or more of the user's collections. */
export default function SaveViewButton({ item, alreadySaved, onSaved, onRemoved }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [initialIds, setInitialIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    const useLoadedCollections = (event) => {
      collectionCache = event.detail || [];
      collectionCacheTime = Date.now();
    };
    const invalidateCollections = () => {
      collectionCacheTime = 0;
    };
    window.addEventListener('nde-collections-loaded', useLoadedCollections);
    window.addEventListener('nde-collections-updated', invalidateCollections);
    return () => {
      window.removeEventListener('nde-collections-loaded', useLoadedCollections);
      window.removeEventListener('nde-collections-updated', invalidateCollections);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const dismissOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('mousedown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [open]);

  const openPicker = async () => {
    if (open || loading) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError('');
    if (collectionCache && Date.now() - collectionCacheTime < COLLECTION_CACHE_MS) {
      setCollections(collectionCache);
      const cachedIds = new Set(collectionCache
        .filter((collection) => collection.items.some((savedItem) => savedItem.chart_key === item.chart_key))
        .map((collection) => collection.id));
      setInitialIds(cachedIds);
      setSelectedIds(cachedIds);
      return;
    }
    setLoading(true);
    try {
      const payload = await collectionsApi.list();
      const nextCollections = payload.collections || [];
      collectionCache = nextCollections;
      collectionCacheTime = Date.now();
      setCollections(nextCollections);
      const nextSelected = new Set();
      nextCollections.forEach((collection) => {
        if (collection.items.some((savedItem) => savedItem.chart_key === item.chart_key)) {
          nextSelected.add(collection.id);
        }
      });
      setInitialIds(nextSelected);
      setSelectedIds(nextSelected);
      if (nextSelected.size) onSaved?.(item.chart_key);
      else onRemoved?.(item.chart_key);
    } catch (err) {
      setError(err.message || 'Could not load your collections.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookmarkClick = async () => {
    if (!alreadySaved) {
      await openPicker();
      return;
    }
    if (loading || saving) return;
    setOpen(false);
    setLoading(true);
    setError('');
    try {
      const { saved } = await collectionsApi.toggle({ ...item, note: '' });
      if (saved) {
        onSaved?.(item.chart_key);
        collectionCacheTime = 0;
      }
      else {
        onRemoved?.(item.chart_key);
        if (collectionCache) {
          collectionCache = collectionCache.map((collection) => ({
            ...collection,
            items: collection.items.filter((savedItem) => savedItem.chart_key !== item.chart_key),
          }));
          collectionCacheTime = Date.now();
        }
      }
    } catch (err) {
      setError(err.message || 'Could not remove this saved chart.');
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollection = (collectionId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  const saveSelection = async () => {
    const changes = collections.filter((collection) => initialIds.has(collection.id) !== selectedIds.has(collection.id));
    if (!changes.length) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError('');
    const results = await Promise.allSettled(changes.map((collection) => {
      const existing = collection.items.find((savedItem) => savedItem.chart_key === item.chart_key);
      return selectedIds.has(collection.id)
        ? collectionsApi.addItem(collection.id, { ...item, note: '' })
        : existing
          ? collectionsApi.removeItem(collection.id, existing.id)
          : Promise.resolve(null);
    }));
    const updatedById = new Map();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value?.collection) {
        updatedById.set(changes[index].id, result.value.collection);
      }
    });
    const nextCollections = collections.map((collection) => updatedById.get(collection.id) || collection);
    collectionCache = nextCollections;
    collectionCacheTime = Date.now();
    setCollections(nextCollections);

    const actualIds = new Set(nextCollections
      .filter((collection) => collection.items.some((savedItem) => savedItem.chart_key === item.chart_key))
      .map((collection) => collection.id));
    setInitialIds(actualIds);
    setSelectedIds(actualIds);
    if (actualIds.size) onSaved?.(item.chart_key);
    else onRemoved?.(item.chart_key);

    const failed = results.find((result) => result.status === 'rejected');
    if (failed) setError(failed.reason?.message || 'Some collection changes could not be saved.');
    else setOpen(false);
    setSaving(false);
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={handleBookmarkClick}
        disabled={loading || saving}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={alreadySaved ? 'Remove this chart from saved collections' : 'Save chart to a collection'}
        title={alreadySaved ? 'Remove from all collections' : 'Save to a collection'}
        className={'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-outline-variant bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-wait ' + (alreadySaved ? 'border-primary text-primary' : 'text-onSurface-variant hover:border-primary hover:text-primary')}
      >
        <Icon
          name={loading ? 'progress_activity' : 'bookmark'}
          size={18}
          color="currentColor"
          style={{
            fontVariationSettings: alreadySaved ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 400",
            transition: 'font-variation-settings 120ms ease',
          }}
        />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={'Choose collections for ' + item.title}
          className="absolute right-0 top-full z-50 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-sm border border-outline-variant bg-surface p-3 text-left shadow-xl"
        >
          <div className="mb-2 flex items-start justify-between gap-3 border-b border-outline-variant pb-2">
            <div className="min-w-0">
            <h3 className="text-sm font-bold text-onSurface">Choose collections</h3>
              <p className="mt-0.5 truncate text-xs text-onSurface-variant" title={item.title}>
                {item.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close collection picker"
              className="rounded-sm p-1 text-onSurface-variant hover:bg-background hover:text-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="close" size={17} />
            </button>
          </div>

          {loading ? (
            <p className="py-3 text-center text-xs text-onSurface-variant">Loading collections…</p>
          ) : error ? (
            <p role="alert" className="py-2 text-xs text-red-700">{error}</p>
          ) : collections.length === 0 ? (
            <div className="py-2">
              <p className="text-xs leading-5 text-onSurface-variant">Create a collection first, then save this chart there.</p>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                Create collection <Icon name="arrow_forward" size={14} />
              </Link>
            </div>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto py-1">
              {collections.map((collection) => {
                const checked = selectedIds.has(collection.id);
                return (
                  <li key={collection.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      disabled={saving}
                      onClick={() => toggleCollection(collection.id)}
                      className="flex w-full items-center gap-3 rounded-sm border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-outline-variant hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                    >
                      <span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border ' + (checked ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-surface')}>
                        {checked && <Icon name="check" size={12} color="#fff" />}
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary/5 text-primary">
                        <Icon name="folder" size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-onSurface">{collection.name}</span>
                        <span className="block text-[11px] text-onSurface-variant">{collection.items.length} saved {collection.items.length === 1 ? 'view' : 'views'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && !error && collections.length > 0 && (
            <div className="mt-2 border-t border-outline-variant pt-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-onSurface-variant">
                <span>{selectedIds.size ? selectedIds.size + ' selected' : 'Select where to save this chart'}</span>
                <Link to="/profile" onClick={() => setOpen(false)} className="font-semibold text-primary hover:underline">Manage collections</Link>
              </div>
              <button
                type="button"
                onClick={saveSelection}
                disabled={saving || selectedIds.size === 0}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-primary px-3 text-xs font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Icon name="progress_activity" size={15} /> : <Icon name="bookmark" size={15} />}
                {saving ? 'Saving…' : 'Save to ' + selectedIds.size + (selectedIds.size === 1 ? ' collection' : ' collections')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
