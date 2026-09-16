import { useEffect } from 'react';
import { Icon } from '../ui/Icon';

export default function NewsModal({ news, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!news) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-sm max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-surface-container-lowest">
          <div className="flex items-center gap-3">
            {news.icon && <span className="text-2xl">{news.icon}</span>}
            <h3 className="text-xl font-bold text-onSurface font-sans line-clamp-1">
              {news.headline || news.title}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-sm transition-colors">
            <Icon name="close" size={24} color="#5c403c" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="flex items-center gap-4 mb-4 text-sm text-onSurface-variant flex-wrap">
            {news.tag && (
              <span
                className="px-2 py-1 rounded-sm text-xs font-bold"
                style={{
                  background: news.tagBg || '#f0f0f0',
                  color: news.tagColor || '#b70011',
                }}
              >
                {news.tag}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Icon name="calendar_today" size={14} color="#5c403c" />
              {news.time || news.date || 'Dec 2023'}
            </span>
            {news.readTime && (
              <span className="flex items-center gap-1">
                <Icon name="access_time" size={14} color="#5c403c" />
                {news.readTime}
              </span>
            )}
          </div>

          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 leading-relaxed font-sans">
              {news.content ||
                news.description ||
                `This is the full article content for "${news.headline || news.title}". 
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
                nisi ut aliquip ex ea commodo consequat.`}
            </p>

            <div className="mt-4 p-4 bg-gray-50 rounded-sm border border-gray-200">
              <h4 className="font-bold text-sm text-onSurface mb-2">Key Highlights</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Important policy update affecting the sector</li>
                <li>Statistical data and analysis included</li>
                <li>Expert opinions and recommendations</li>
                <li>Future outlook and projections</li>
              </ul>
            </div>

            {news.aiInsights && (
              <div className="mt-4 p-4 bg-blue-50 rounded-sm border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="auto_awesome" size={16} color="#0051d5" />
                  <h4 className="font-bold text-sm text-secondary">AI Insights</h4>
                </div>
                <p className="text-sm text-gray-700">{news.aiInsights}</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-onSurface-variant cursor-pointer hover:text-primary transition-colors">
            <Icon name="share" size={16} color="#5c403c" />
            <span>Share this article</span>
          </div>
          <div className="flex gap-2">
            {news.url && (
              <a
                href={news.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-sm hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Icon name="open_in_new" size={16} color="#ffffff" />
                Read original
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-onSurface-variant hover:bg-gray-200 rounded-sm transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-sm hover:brightness-110 transition-all flex items-center gap-2"
            >
              <Icon name="print" size={16} color="#ffffff" />
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}