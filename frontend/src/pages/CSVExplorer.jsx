import { useRef, useState } from 'react';
import CSVUploadCard, { validateCSVOnServer } from '../components/csv/CSVUploadCard';
import CSVValidateStep from '../components/csv/CSVValidateStep';
import CSVChartEngine from '../components/csv/CSVChartEngine';
import { SectionCard } from '../components/ui/Card';
import { BtnPrimary } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { validateCSV } from '../components/csv/CSVUploadCard';
import {
  profileDataset, recommendVisualization,
} from '../components/csv/chartData';

const EMPTY_DATASET = {
  fileName: '',
  headers: [],
  rows: [],
  totalRowCount: 0,
  isSampled: false,
  loading: false,
  profile: null,
  warning: null,
  error: null,
};

const STEPS = [
  { icon: 'cloud_upload', label: 'Upload' },
  { icon: 'fact_check', label: 'Review & validate' },
  { icon: 'auto_graph', label: 'Visualize' },
];

function Stepper({ current }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.label} className={`flex items-center gap-2 ${index < STEPS.length - 1 ? 'flex-1' : 'flex-none'}`}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                active ? 'bg-primary text-white' : done ? 'bg-primary/15 text-primary' : 'bg-surface-high text-onSurface-variant'
              }`}
            >
              {done ? <Icon name="check" size={16} /> : index + 1}
            </span>
            <span className={`whitespace-nowrap text-sm font-semibold ${active ? 'text-onSurface' : done ? 'text-primary' : 'text-onSurface-variant'}`}>
              {step.label}
            </span>
            {index < STEPS.length - 1 && <span className="mx-2 h-px flex-1 bg-outline-variant" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function CSVExplorer() {
  const inputRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [dataset, setDataset] = useState(EMPTY_DATASET);
  const [typeOverrides, setTypeOverrides] = useState({});
  const [applied, setApplied] = useState(null);

  const resetToUpload = () => {
    setStep('upload');
    setDataset(EMPTY_DATASET);
    setTypeOverrides({});
    setApplied(null);
  };

  const parseFile = async (file) => {
    if (!file) return;

    setDataset({ ...EMPTY_DATASET, fileName: file.name, loading: true });
    setTypeOverrides({});
    setApplied(null);

    try {
      const serverValidation = await validateCSVOnServer(file);
      const result = await validateCSV(file);

      if (!result.valid) {
        setDataset({
          ...EMPTY_DATASET,
          fileName: file.name,
          error: result.message,
        });
        return;
      }

      const headers = (result.meta.fields || []).map((header) => String(header).trim()).filter(Boolean);
      const rows = result.data.filter((row) => row && Object.values(row).some((value) => String(value ?? '').trim() !== ''));

      if (!headers.length || !rows.length) {
        setDataset({
          ...EMPTY_DATASET,
          fileName: file.name,
          error: 'The CSV contains column headers but no data rows.',
        });
        return;
      }

      const profile = profileDataset(headers, rows);
      setDataset({
        fileName: file.name,
        headers,
        rows,
        totalRowCount: rows.length,
        isSampled: false,
        loading: false,
        profile,
          warning: [...(result.warning ? [result.warning] : []), ...(serverValidation.warnings || [])].join(' ') || null,
      });
      setStep('validate');
    } catch (err) {
      const detail = err?.message && !/fetch|network|failed to fetch/i.test(err.message) ? err.message : null;
      setDataset({
        ...EMPTY_DATASET,
        fileName: file.name,
        error: detail || 'Unable to read this file. Please choose a valid CSV file.',
      });
    }
  };

  const handleFileChange = (event) => {
    parseFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleOverride = (name, type) => {
    setTypeOverrides((current) => {
      const next = { ...current };
      if (type) next[name] = type;
      else delete next[name];
      return next;
    });
  };

  const buildChart = () => {
    if (!dataset.profile) return;
    const profile = profileDataset(dataset.headers, dataset.rows, typeOverrides);
    const recommendation = recommendVisualization(profile);
    setApplied({ profile, recommendation, key: `${dataset.fileName}:${JSON.stringify(typeOverrides)}` });
    setStep('visualize');
  };

  const { loading } = dataset;
  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-onSurface font-hanken">CSV Explorer</h1>
          <p className="mt-1 max-w-3xl text-sm text-onSurface-variant font-hanken">
            Import any CSV file, review how its columns are interpreted, then build a chart from your own data.
          </p>
        </div>
        <Stepper current={step === 'upload' ? 0 : step === 'validate' ? 1 : 2} />

        {step === 'upload' && (
          <CSVUploadCard
            inputRef={inputRef}
            fileName={dataset.fileName}
            error={dataset.error}
            warning={dataset.warning}
            loading={loading}
            onChange={handleFileChange}
            onClear={resetToUpload}
          />
        )}

        {step === 'validate' && dataset.profile && (
          <CSVValidateStep
            fileName={dataset.fileName}
            headers={dataset.headers}
            rows={dataset.rows}
            totalRowCount={dataset.totalRowCount}
            isSampled={dataset.isSampled}
            warning={dataset.warning}
            columns={dataset.profile.columns}
            overrides={typeOverrides}
            onOverride={handleOverride}
            onBack={resetToUpload}
            onNext={buildChart}
          />
        )}

        {step === 'visualize' && applied && (
          <>
            <SectionCard title="Suggested starting point" subtitle={applied.recommendation.reason}>
              <div className="flex items-center gap-3 text-sm text-onSurface">
                <Icon name={applied.recommendation.chartType === 'table' ? 'table_view' : 'auto_graph'} size={24} color="#0051d5" />
                <span>
                  Recommended view: <strong className="capitalize">{applied.recommendation.chartType}</strong>. All controls remain available below.
                </span>
              </div>
            </SectionCard>
            <CSVChartEngine
              key={applied.key}
              fileName={dataset.fileName}
              headers={dataset.headers}
              rows={dataset.rows}
              profile={applied.profile}
              recommendation={applied.recommendation}
            />
            <div className="flex justify-end">
              <BtnPrimary onClick={() => setStep('validate')}>
                <Icon name="arrow_back" size={16} />
                Back to review
              </BtnPrimary>
            </div>
          </>
        )}
      </div>
  );
}
