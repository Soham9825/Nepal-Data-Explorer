import { useEffect, useState } from 'react';
import { Tag } from '../components/ui/Tag';
import { Icon } from '../components/ui/Icon';
import { API_BASE_URL } from '../config';

const NEWS_API_URL = `${API_BASE_URL}/api/news/`;
const TAG_COLORS = ['#0051d5', '#7a5100', '#b70011', '#5c403c'];

const formatDate = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export default function News() {
  const [cat, setCat] = useState('All');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const categories = ['All', 'Economy', 'Tourism', 'Government', 'Finance', 'Agriculture'];
  useEffect(() => {
    fetch(NEWS_API_URL, { headers: { Accept: 'application/json' }, credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error(`News API error: ${response.status}`);
        return response.json();
      })
      .then((data) => setNews(Array.isArray(data) ? data : Array.isArray(data.articles) ? data.articles : []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = cat === 'All' ? news : news.filter(n => n.category === cat);

  return (
    <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">National Headlines</h3>
          <p className="text-onSurface-variant text-sm">Economic policy updates, NRB announcements, and sector news</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-4 py-2 border font-sans font-bold text-xs cursor-pointer transition-all duration-150 uppercase tracking-[0.04em] ${
                cat === c ? 'bg-secondary text-white border-secondary' : 'bg-white text-onSurface border-outline-variant'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading && <div className="text-sm text-onSurface-variant">Loading headlines...</div>}
        {error && <div className="text-sm text-danger">{error}</div>}
        {!loading && !error && <div className="grid grid-cols-2 gap-5">
          {filtered.map((n, index) => {
            const tagColor = TAG_COLORS[index % TAG_COLORS.length];
            return (
            <div
              key={`${n.url || n.title}-${index}`}
              className="bg-surface border border-outline-variant p-5 cursor-pointer transition-colors duration-150 card-shadow hover:border-[n.tagColor]"
              onMouseOver={(e) => (e.currentTarget.style.borderColor = tagColor)}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e6bdb8')}
            >
              <div className="flex justify-between items-center mb-3">
                <Tag label={n.category || 'News'} color={tagColor} bg="#f0f0f0" />
                <span className="text-xs text-onSurface-variant">{formatDate(n.published_at)}</span>
              </div>
              <h4 className="text-sm font-bold text-onSurface leading-relaxed mb-3.5">{n.title}</h4>
              <button className="bg-none border-none p-0 cursor-pointer text-xs font-bold text-secondary flex items-center gap-1 font-sans uppercase tracking-[0.04em]">
                Read More <Icon name="arrow_forward" size={14} color="#0051d5" />
              </button>
            </div>
            );
          })}
        </div>}
    </div>
  );
}