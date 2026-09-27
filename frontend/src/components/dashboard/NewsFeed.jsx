import { useState } from 'react';
import NewsCard from '../cards/NewsCard';

const categories = ['All', 'Economy', 'Tourism', 'Finance', 'Government', 'Agriculture'];

export default function NewsFeed({ news = [] }) {
  const [filter, setFilter] = useState('All');

  const filteredNews = filter === 'All' ? news : news.filter((n) => n.category === filter);

  return (
    <div className="bg-surface border border-outline-variant rounded-sm flex flex-col card-shadow">
      <div className="p-6 border-b border-outline-variant bg-surface-lowest">
        <h3 className="font-bold text-on-surface text-xl font-sans">National Headlines</h3>
        <p className="text-on-surface-variant text-[12px] font-sans">
          Latest policy updates &amp; reports
        </p>
      </div>

      <div className="px-4 py-2 border-b border-outline-variant flex flex-wrap gap-1.5 bg-surface-lowest/50">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2.5 py-1 rounded-sm text-[10px] font-bold transition-colors font-sans ${
              filter === cat
                ? 'bg-primary text-white'
                : 'bg-surface border border-outline-variant text-on-surface-variant hover:bg-surface-highest'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[600px]">
        {filteredNews.length > 0 ? (
          filteredNews.map((n) => <NewsCard key={n.id} {...n} />)
        ) : (
          <div className="text-center py-8 text-on-surface-variant">
            <p className="text-sm">No news found for this category</p>
          </div>
        )}
      </div>

      <button className="w-full py-4 bg-surface-lowest border-t border-outline-variant text-[12px] font-bold text-primary hover:bg-surface-high transition-colors font-sans">
        View All Feed
      </button>
    </div>
  );
}
