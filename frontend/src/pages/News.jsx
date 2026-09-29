import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tag } from '../components/ui/Tag';
import { Icon } from '../components/ui/Icon';
import Loader from '../components/common/Loader';
import NewsModal from '../components/national/NewsModal';
import { API_BASE_URL } from '../config';

const NEWS_API_URL = `${API_BASE_URL}/api/news/`;
const CATEGORY_COLORS = {
  Economy: '#0051d5',
  Tourism: '#0f7a3d',
  Government: '#7a5100',
  Politics: '#5c403c',
  'Natural Disaster': '#b70011',
};
const CANONICAL_CATEGORIES = ['Economy', 'Tourism', 'Government', 'Politics', 'Natural Disaster'];
const PALETTE = [
  '#0051d5',
  '#b70011',
  '#7a5100',
  '#316bf3',
  '#9a6800',
  '#0f7a3d',
  '#5c403c',
  '#dc2626',
];

const formatDate = (value) => {
  if (!value) return 'Recently';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
};

function ArticleThumb({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-28 h-24 md:w-32 md:h-28 flex-shrink-0 bg-primary flex items-center justify-center rounded-sm px-2">
        <span className="text-white text-[11px] font-bold uppercase tracking-[0.05em] text-center leading-tight font-hanken">
          Nepal Data Explorer
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-28 h-24 md:w-32 md:h-28 object-cover rounded-sm flex-shrink-0"
    />
  );
}

const isToday = (value) => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  );
};

export default function News() {
  const [cat, setCat] = useState('All');
  const [source, setSource] = useState('All');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedNews, setSelectedNews] = useState(null);

  const loadNews = useCallback(async (showSpinner) => {
    if (showSpinner) setRefreshing(true);
    try {
      const response = await fetch(`${NEWS_API_URL}?limit=30`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`News API error: ${response.status}`);
      const data = await response.json();
      const articles = Array.isArray(data)
        ? data
        : Array.isArray(data.articles)
          ? data.articles
          : [];
      setNews(articles);
      if (!articles.length) setError('No recent headlines available right now.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNews(false);
  }, [loadNews]);

  const sources = useMemo(() => {
    const counts = {};
    news.forEach((n) => {
      const name = n.source || 'News';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [news]);

  const sourceOptions = useMemo(() => ['All', ...sources.map((s) => s.name)], [sources]);

  const categories = useMemo(() => {
    const present = [...new Set(news.map((n) => n.category).filter(Boolean))];
    const extra = present.filter((c) => !CANONICAL_CATEGORIES.includes(c));
    return ['All', ...CANONICAL_CATEGORIES.filter((c) => present.includes(c)), ...extra];
  }, [news]);

  const filtered = useMemo(
    () =>
      news.filter(
        (n) => (cat === 'All' || n.category === cat) && (source === 'All' || n.source === source)
      ),
    [news, cat, source]
  );

  const stats = useMemo(
    () => [
      { icon: 'newspaper', label: 'Headlines', value: String(news.length), color: '#b70011' },
      { icon: 'podcasts', label: 'News sources', value: String(sources.length), color: '#0051d5' },
      {
        icon: 'today',
        label: 'Published today',
        value: String(news.filter((n) => isToday(n.published)).length),
        color: '#0f7a3d',
      },
      {
        icon: 'bolt',
        label: 'Newest',
        value: news.length ? formatDate(news[0].published) : '—',
        color: '#7a5100',
      },
    ],
    [news, sources]
  );

  const openArticle = (article) => {
    if (article.url) {
      window.open(article.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setSelectedNews({
      headline: article.title,
      tag: article.source || 'News',
      tagColor: CATEGORY_COLORS[article.category] || '#b70011',
      tagBg: '#f0f0f0',
      time: formatDate(article.published),
      content:
        article.summary ||
        'A full summary was not provided by the feed. Open the article on the source site to read it.',
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-onSurface font-hanken">National Headlines</h3>
          <p className="text-onSurface-variant text-sm font-hanken mt-1">
            Live RSS aggregation from leading Nepali news outlets
          </p>
        </div>
        <button
          onClick={() => loadNews(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-outline-variant rounded-sm bg-surface text-onSurface text-xs font-bold uppercase tracking-[0.04em] font-hanken cursor-pointer transition-colors hover:border-primary hover:text-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="refresh" size={16} color={refreshing ? '#8a8a8a' : '#0051d5'} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-surface border border-outline-variant p-5 card-shadow flex items-center gap-3"
            style={{ borderTop: `3px solid ${s.color}` }}
          >
            <Icon name={s.icon} size={28} color={s.color} />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-onSurface-variant uppercase tracking-[0.05em] font-hanken">
                {s.label}
              </div>
              <div className="text-lg font-bold text-onSurface font-hanken truncate">{s.value}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.04em] text-onSurface-variant font-hanken w-20">
            Topic:
          </span>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-4 py-2 border font-sans font-bold text-xs cursor-pointer transition-all duration-150 uppercase tracking-[0.04em] font-hanken ${
                cat === c
                  ? 'bg-secondary text-white border-secondary hover:brightness-95'
                  : 'bg-white text-onSurface border-outline-variant hover:bg-surface-low hover:border-onSurface-variant'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.04em] text-onSurface-variant font-hanken w-20">
            Source:
          </span>
          {sourceOptions.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-4 py-2 border font-sans font-bold text-xs cursor-pointer transition-all duration-150 uppercase tracking-[0.04em] font-hanken ${
                source === s
                  ? 'bg-primary text-white border-primary hover:brightness-95'
                  : 'bg-white text-onSurface border-outline-variant hover:bg-surface-low hover:border-onSurface-variant'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Articles */}
      {loading ? (
        <Loader size="lg" />
      ) : error && !news.length ? (
        <div className="text-sm text-danger bg-white border border-outline-variant p-5 rounded-sm">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-onSurface-variant bg-white border border-outline-variant p-5 rounded-sm">
          No stories match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((n, index) => {
            const tagColor = CATEGORY_COLORS[n.category] || PALETTE[index % PALETTE.length];
            return (
              <div
                key={`${n.url || n.title}-${index}`}
                className="bg-surface border border-outline-variant rounded-sm cursor-pointer transition-all duration-200 card-shadow hover:shadow-lg overflow-hidden"
                style={{ borderLeft: `3px solid ${tagColor}` }}
                role="button"
                tabIndex={0}
                onClick={() => openArticle(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openArticle(n);
                  }
                }}
              >
                <div className="flex gap-4 p-4">
                  <ArticleThumb src={n.image} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Tag label={n.category || 'News'} color={tagColor} bg="#f0f0f0" />
                      <span className="text-[11px] font-bold text-onSurface-variant uppercase tracking-[0.04em] font-hanken">
                        {n.source}
                      </span>
                      <span className="text-xs text-onSurface-variant font-hanken ml-auto">
                        {formatDate(n.published)}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-onSurface leading-relaxed mb-2 font-hanken line-clamp-2">
                      {n.title}
                    </h4>
                    {n.summary && (
                      <p className="text-[13px] text-onSurface-variant leading-relaxed mb-3 font-hanken line-clamp-2">
                        {n.summary}
                      </p>
                    )}
                    <span className="text-xs font-bold text-secondary flex items-center gap-1 font-sans uppercase tracking-[0.04em] transition-colors hover:text-primary hover:underline font-hanken">
                      Read More <Icon name="arrow_forward" size={14} color="#0051d5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && news.length > 0 && (
        <div className="text-xs text-onSurface-variant font-hanken">
          Showing {filtered.length} of {news.length} recent headlines · updates every 10 minutes
        </div>
      )}

      {news.length > 0 && (
        <style>{`
          .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        `}</style>
      )}

      <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />
    </div>
  );
}
