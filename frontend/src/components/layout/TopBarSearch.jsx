import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { Icon } from '../ui/Icon';
import { STATIC_INDEX, datasetItems, groupResults, rankResults } from '../../data/searchIndex';

/**
 * How many results a single group may show.
 *
 * Groups are capped rather than the whole list, so a broad query like "tourism" cannot
 * push the Tourism page — the highest-scoring result — below a wall of metric rows.
 * The count line still reports the true total, so nothing looks hidden without saying so.
 */
const MAX_PER_GROUP = 6;

/**
 * Shortest query that opens results.
 *
 * A single character matches nearly everything, because the scoring is substring based
 * and the keyword lists are long. Returning nineteen rows for "x" buries the page and
 * section a reader was about to type, so the panel waits for a second character instead.
 */
const MIN_QUERY_LENGTH = 2;

/**
 * Mark the part of a label the query matched.
 *
 * Long labels are truncated, so the match is often off-screen; marking it shows why a
 * result ranked at all. Only the earliest token hit is marked, because marking several
 * reads as noise on a single-line label.
 */
function Highlight({ text, query }) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  let at = -1;
  let length = 0;
  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index !== -1 && (at === -1 || index < at)) {
      at = index;
      length = token.length;
    }
  }
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-primary/20 text-onSurface">{text.slice(at, at + length)}</mark>
      {text.slice(at + length)}
    </>
  );
}

function ResultRow({ item, query, active, onSelect, position, rowRef }) {
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-surface-container text-onSurface-variant">
        <Icon name={item.icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-onSurface">
          <Highlight text={item.label} query={query} />
        </span>
        {item.description && (
          <span className="block truncate text-xs text-onSurface-variant">{item.description}</span>
        )}
      </span>
      <Icon
        name={item.external ? 'open_in_new' : 'arrow_forward'}
        size={16}
        className="shrink-0 text-onSurface-variant"
      />
    </>
  );

  const className =
    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 ' +
    (active ? 'bg-surface-high' : 'hover:bg-surface-high focus:bg-surface-high');

  // Datasets are files rather than routes, so they open in a new tab instead of
  // navigating. They stay real anchors so they keep middle-click and "copy link".
  if (item.external) {
    return (
      <a
        id={position}
        ref={rowRef}
        role="option"
        aria-selected={active}
        href={`${API_BASE_URL}${item.path}`}
        target="_blank"
        rel="noreferrer"
        onClick={onSelect}
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <button
      id={position}
      ref={rowRef}
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={`${className} focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40`}
    >
      {body}
    </button>
  );
}

export default function TopBarSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const activeRef = useRef(null);
  const [query, setQuery] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE_URL}/api/datasets/files/`)
      .then((response) => {
        if (!response.ok) throw new Error(`Dataset catalog error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!mounted) return;
        setDatasets(Array.isArray(data.reports) ? data.reports : []);
      })
      .catch(() => {
        if (mounted) setCatalogError(true);
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleOutsidePointer = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, []);

  // The CSV catalog joins the same index as everything else, so a dataset ranks
  // against pages and sections instead of being matched by a separate rule that
  // could not see them.
  const index = useMemo(() => [...STATIC_INDEX, ...datasetItems(datasets)], [datasets]);
  const ranked = useMemo(() => rankResults(index, query), [index, query]);
  // Groups are capped rather than the whole list, so a broad query like "tourism" cannot
  // push the Tourism page — the highest-scoring result — below a wall of metric rows.
  // The count line still reports the true total, so nothing looks hidden without saying so.
  //
  // Each item is tagged with its position in the flat order as it is built, which is what
  // the arrow keys and `aria-activedescendant` index by. Assigning it here rather than
  // with a counter during render keeps the positions stable across re-renders.
  const groups = useMemo(() => {
    let cursor = 0;
    return groupResults(ranked)
      .map((group) => ({
        ...group,
        items: group.items.slice(0, MAX_PER_GROUP).map((item) => ({ item, index: cursor++ })),
      }))
      .filter((group) => group.items.length > 0);
  }, [ranked]);

  const flatResults = useMemo(
    () => groups.flatMap((group) => group.items.map((e) => e.item)),
    [groups]
  );
  const resultCount = ranked.length;
  const hasResults = resultCount > 0;
  const normalizedQuery = query.trim();
  const isTooShort = normalizedQuery.length > 0 && normalizedQuery.length < MIN_QUERY_LENGTH;
  const showResults = open && Boolean(normalizedQuery) && !isTooShort;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    setActiveIndex((index) => (index >= flatResults.length ? 0 : index));
  }, [flatResults.length]);

  // Keeps the highlighted row inside the scroll box as the selection moves.
  useEffect(() => {
    if (open && normalizedQuery && hasResults) {
      activeRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open, normalizedQuery, hasResults]);

  const reset = () => {
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  };

  const openResult = (item) => {
    if (!item.external) {
      navigate(item.path);
    } else {
      window.open(`${API_BASE_URL}${item.path}`, '_blank', 'noopener,noreferrer');
    }
    reset();
  };

  /**
   * Arrow keys walk the list, Enter opens whatever is highlighted, Escape closes.
   *
   * Enter acts on the highlighted row rather than the top-ranked result, so the list is
   * navigable rather than a guess. The selection starts on the top hit, which is the
   * result Enter used to pick implicitly, so the common case is unchanged.
   */
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!flatResults.length) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        return (index + step + flatResults.length) % flatResults.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      const item = flatResults[activeIndex];
      if (!item) return;
      event.preventDefault();
      openResult(item);
    }
  };

  const showCatalogError = normalizedQuery && !catalogLoading && catalogError && !hasResults;
  const showEmpty = normalizedQuery && !catalogLoading && !catalogError && !hasResults;

  return (
    <div
      ref={containerRef}
      className="relative z-50 min-w-0 flex-1 lg:max-w-[320px] lg:flex-none lg:w-[300px]"
    >
      <div className="relative">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-onSurface-variant"
        />
        <input
          type="search"
          value={query}
          aria-label="Search pages, sections, and data"
          aria-controls="top-bar-search-results"
          aria-expanded={showResults}
          aria-activedescendant={
            showResults && flatResults.length ? `search-result-${activeIndex}` : undefined
          }
          autoComplete="off"
          placeholder="Search pages, sections, and data"
          onFocus={() => normalizedQuery && setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(Boolean(event.target.value.trim()));
          }}
          onKeyDown={handleKeyDown}
          // `type="search"` makes the browser draw its own clear button, which would
          // sit on top of the real one below. The field is styled from scratch here, so
          // the native decoration is suppressed.
          className="h-11 min-h-[44px] w-full cursor-text appearance-none rounded-sm border border-outline-variant bg-surface pl-9 pr-9 text-sm font-medium text-onSurface outline-none transition-colors duration-150 placeholder:text-onSurface-variant hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={reset}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-onSurface-variant transition-colors duration-150 hover:bg-surface-high hover:text-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {isTooShort && (
        <div className="card-shadow absolute right-0 top-[calc(100%+8px)] w-[min(360px,calc(100vw-2rem))] rounded-sm border border-outline-variant bg-surface">
          <p className="px-4 py-3 text-xs text-onSurface-variant">
            Keep typing &mdash; at least {MIN_QUERY_LENGTH} characters.
          </p>
        </div>
      )}

      {showResults && (
        <div
          id="top-bar-search-results"
          role="listbox"
          aria-label="Search results"
          className="card-shadow absolute right-0 top-[calc(100%+8px)] max-h-[min(420px,60vh)] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-sm border border-outline-variant bg-surface"
        >
          {groups.map((group) => (
            <div key={group.kind}>
              <p className="sticky top-0 z-10 border-b border-outline-variant bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant">
                {group.label}
              </p>
              {group.items.map(({ item, index }) => {
                const active = index === activeIndex;
                return (
                  <ResultRow
                    key={item.id}
                    item={item}
                    query={normalizedQuery}
                    active={active}
                    rowRef={active ? activeRef : undefined}
                    position={`search-result-${index}`}
                    onSelect={() => openResult(item)}
                  />
                );
              })}
            </div>
          ))}

          {catalogLoading && !hasResults && (
            <p className="px-4 py-4 text-sm text-onSurface-variant">Loading available data...</p>
          )}

          {showCatalogError && (
            <div className="px-4 py-4">
              <p className="text-sm font-bold text-onSurface">
                Data search is temporarily unavailable.
              </p>
              <p className="mt-1 text-xs leading-5 text-onSurface-variant">
                Pages and sections still work. More data will be available soon.
              </p>
            </div>
          )}

          {showEmpty && (
            <div className="px-4 py-4">
              <p className="text-sm font-semibold text-onSurface">
                No matching page, section or data.
              </p>
              <p className="mt-1 text-xs leading-5 text-onSurface-variant">
                Try a shorter word, such as &ldquo;trade&rdquo;, &ldquo;tourism&rdquo; or
                &ldquo;salary&rdquo;.
              </p>
            </div>
          )}

          {hasResults && (
            <p className="border-t border-outline-variant px-3 py-2 text-[10px] text-onSurface-variant">
              {resultCount} result{resultCount === 1 ? '' : 's'} &middot; &uarr;&darr; to move,
              Enter to open
            </p>
          )}
        </div>
      )}
    </div>
  );
}
