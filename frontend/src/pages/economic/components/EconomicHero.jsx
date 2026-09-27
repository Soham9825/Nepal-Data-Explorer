import { Icon } from '../../../components/ui/Icon';
import teaFactoryImage from '../../../assets/tea-factory-ilam-nepal.jpg';

export default function EconomicHero({ sectorYear, tradeYear, worldYear, gdpYear }) {
  return (
    <section
      className="relative overflow-hidden bg-cover bg-center"
      style={{
        minHeight: 180,
        backgroundImage: `linear-gradient(90deg, rgba(16, 24, 40, 0.88) 0%, rgba(16, 24, 40, 0.66) 55%, rgba(16, 24, 40, 0.44) 100%), url("${teaFactoryImage}")`,
      }}
      aria-labelledby="economic-hero-title"
    >
      <div className="relative flex min-h-[180px] flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1
            id="economic-hero-title"
            className="text-xl font-bold tracking-tight text-white sm:text-2xl"
          >
            Economic Data
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-white/75">
            Real growth, sector output, foreign trade, wages and province-wise GDP for Nepal.
          </p>
          <p className="mt-2 text-xs leading-5 text-white/60">
            Sectoral data through {sectorYear || '—'} · Trade through {tradeYear || '—'} · World
            output through {worldYear || '—'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-medium text-white/70">Reporting period</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white">
            <Icon name="calendar_month" size={16} color="#ffffff" aria-hidden="true" />
            {gdpYear ? `FY ${gdpYear}` : 'FY —'}
          </span>
        </div>
      </div>
    </section>
  );
}
