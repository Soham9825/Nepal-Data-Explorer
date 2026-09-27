import { useEffect, useRef, useState } from 'react';

const MOUNT_MARGIN = '800px 0px';

export default function LazySection({ minHeight, eager = false, children }) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(eager);

  useEffect(() => {
    if (mounted) return undefined;
    if (eager || typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setMounted(true);
        observer.disconnect();
      },
      { rootMargin: MOUNT_MARGIN }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [mounted, eager]);

  return (
    <div
      ref={ref}
      className="h-full"
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
    >
      {mounted ? children : null}
    </div>
  );
}
