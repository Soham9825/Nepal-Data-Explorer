import MetricCard from '../../../components/cards/MetricCard';
export default function EconomicKpiStrip({ cards }) {
  if (!cards?.length) return null;

  return (
    <div className="grid gap-6 md:grid-cols-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} change={card.change ?? ''} trend="up" />
      ))}
    </div>
  );
}
