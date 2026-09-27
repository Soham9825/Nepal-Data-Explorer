import everestImage from '../../../assets/everest-himalayas.jpg';
import { Icon } from '../../../components/ui/Icon';

/**
 * The page banner: what the page is, and how far the data reaches.
 *
 * The three dates in the subheading are the honest answer to "how current is
 * this?" — arrivals and revenue are reported on different bases and stop at
 * different years, so a single reporting period would be misleading.
 */
export default function TourismHero({ arrivalYear, revenueFiscalYear, destinationYear }) {
  return (
    <section
      className="relative overflow-hidden bg-cover bg-center"
      style={{
        minHeight: 180,
        backgroundImage: `linear-gradient(90deg, rgba(16, 24, 40, 0.88) 0%, rgba(16, 24, 40, 0.66) 55%, rgba(16, 24, 40, 0.44) 100%), url("${everestImage}")`,
      }}
      aria-labelledby="tourism-hero-title"
    >
      <div className="relative flex min-h-[180px] flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1
            id="tourism-hero-title"
            className="text-xl font-bold tracking-tight text-white sm:text-2xl"
          >
            Tourism performance
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-white/75">
            Track arrivals, revenue, visitor behavior, source markets, and destinations.
          </p>
          <p className="mt-2 text-xs leading-5 text-white/60">
            Arrivals through {arrivalYear || '—'} · Revenue {revenueFiscalYear || '—'} ·
            Destinations through {destinationYear || '—'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-medium text-white/70">Reporting period</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white">
            <Icon name="calendar_month" size={16} color="#ffffff" />
            {revenueFiscalYear ? `FY ${revenueFiscalYear}` : 'FY —'}
          </span>
        </div>
      </div>
    </section>
  );
}
