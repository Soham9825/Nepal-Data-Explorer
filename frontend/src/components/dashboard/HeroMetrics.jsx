
import MetricCard from '../cards/MetricCard';

export default function HeroMetrics({ metrics = [] }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((m) => (
        <MetricCard key={m.id} {...m} />
      ))}
    </section>
  );
}