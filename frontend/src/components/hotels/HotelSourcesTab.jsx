import { useEffect, useState } from 'react';
import { SectionCard } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { hotelAPI } from '../../services/hotelAPI';

export default function HotelSourcesTab() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hotelAPI.dataSources()
      .then(setInfo)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SectionCard title="Data Sources & Provenance" subtitle="Loading source documentation…">
        <p className="flex items-center gap-2 text-sm text-onSurface-variant">
          <Icon name="sync" size={16} className="animate-spin" /> Loading…
        </p>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Data Sources & Provenance" subtitle="Source transparency">
        <p className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700" role="alert">
          <Icon name="error" size={16} /> {error}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Open Data vs Live Commercial Data"
        subtitle="What this module can and cannot provide"
      >
        <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Important limitation</p>
          <p className="mt-1">{info?.limitation}</p>
        </div>
      </SectionCard>

      <SectionCard title="Open data sources" subtitle="Free, no paid API keys required">
        <ul className="space-y-3">
          {(info?.open_data || []).map((src) => (
            <li key={src.name} className="rounded-lg border border-outline-variant p-3">
              <p className="text-sm font-bold text-onSurface">{src.name}</p>
              <p className="mt-0.5 text-sm text-onSurface-variant">{src.role}</p>
              {src.license && <p className="mt-0.5 text-xs text-onSurface-variant">License: {src.license}</p>}
              {src.attribution && <p className="mt-0.5 text-xs text-onSurface-variant">{src.attribution}</p>}
              {src.policy && <p className="mt-0.5 text-xs text-onSurface-variant">Policy: {src.policy}</p>}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Price sources" subtitle="Every price row carries source, source_url, and retrieved_at">
        <ul className="space-y-3">
          {(info?.price_sources || []).map((src) => (
            <li key={src.name} className="rounded-lg border border-outline-variant p-3">
              <p className="text-sm font-bold text-onSurface">{src.name}</p>
              <p className="mt-0.5 text-sm text-onSurface-variant">{src.role}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Configured endpoints" subtitle="Replaceable via environment variables; app works with defaults">
        <dl className="grid grid-cols-1 gap-2 font-mono text-xs md:grid-cols-3">
          <div className="rounded border border-outline-variant bg-surface-low p-2">
            <dt className="font-bold uppercase text-onSurface-variant">Overpass</dt>
            <dd className="mt-1 break-all">{info?.endpoints?.overpass}</dd>
          </div>
          <div className="rounded border border-outline-variant bg-surface-low p-2">
            <dt className="font-bold uppercase text-onSurface-variant">Nominatim</dt>
            <dd className="mt-1 break-all">{info?.endpoints?.nominatim}</dd>
          </div>
          <div className="rounded border border-outline-variant bg-surface-low p-2">
            <dt className="font-bold uppercase text-onSurface-variant">OSRM</dt>
            <dd className="mt-1 break-all">{info?.endpoints?.osrm}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-onSurface-variant">
          Optional env vars: OSM_USER_AGENT, OSM_CONTACT_EMAIL, OVERPASS_ENDPOINT, NOMINATIM_ENDPOINT, OSRM_ENDPOINT.
          Standard HTTP_PROXY / HTTPS_PROXY are honored when set, but never required.
        </p>
      </SectionCard>
    </div>
  );
}
