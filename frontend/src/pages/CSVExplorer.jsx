import { useRef, useState } from 'react';
import CSVUploadCard from '../components/csv/CSVUploadCard';
import { prepareCSV } from '../components/csv/csvValidation';
import CSVValidateStep from '../components/csv/CSVValidateStep';
import CSVChartEngine from '../components/csv/CSVChartEngine';
import { SectionCard } from '../components/ui/Card';
import { BtnPrimary } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { recommendVisualization } from '../components/csv/chartData';

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

const profileFromColumns = (columns, rowCount) => {
  const numericColumns = columns
    .filter((column) => column.type === 'numeric')
    .map((column) => column.name);
  const dateColumns = columns
    .filter((column) => column.type === 'date')
    .map((column) => column.name);
  const dimensionColumns = columns
    .filter((column) => ['date', 'categorical', 'text', 'boolean'].includes(column.type))
    .map((column) => column.name);
  return {
    rowCount,
    columnCount: columns.length,
    columns,
    numericColumns,
    dateColumns,
    dimensionColumns,
  };
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
          <li
            key={step.label}
            className={`flex items-center gap-2 ${index < STEPS.length - 1 ? 'flex-1' : 'flex-none'}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                active
                  ? 'bg-primary text-white'
                  : done
                    ? 'bg-primary/15 text-primary'
                    : 'bg-surface-high text-onSurface-variant'
              }`}
            >
              {done ? <Icon name="check" size={16} /> : index + 1}
            </span>
            <span
              className={`whitespace-nowrap text-sm font-semibold ${active ? 'text-onSurface' : done ? 'text-primary' : 'text-onSurface-variant'}`}
            >
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
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [dataset, setDataset] = useState(EMPTY_DATASET);
  const [typeOverrides, setTypeOverrides] = useState({});
  const [missingStrategies, setMissingStrategies] = useState({});
  const [applied, setApplied] = useState(null);
  const [nextLoading, setNextLoading] = useState(false);

  const resetToUpload = () => {
    setStep('upload');
    setDataset(EMPTY_DATASET);
    setTypeOverrides({});
    setMissingStrategies({});
    setApplied(null);
    fileRef.current = null;
  };

  const parseFile = async (file) => {
    if (!file) return;

    setDataset({ ...EMPTY_DATASET, fileName: file.name, loading: true });
    setTypeOverrides({});
    setMissingStrategies({});
    setApplied(null);
    fileRef.current = file;

    try {
      const result = await prepareCSV(file);
      const profile = profileFromColumns(result.columns, result.row_count);
      setDataset({
        fileName: file.name,
        headers: result.headers,
        rows: result.rows,
        totalRowCount: result.total_row_count,
        isSampled: result.is_sampled,
        loading: false,
        profile,
        warning: result.warnings?.length ? result.warnings.join(' ') : null,
      });
      setStep('validate');
    } catch (err) {
      const detail =
        err?.message && !/fetch|network|failed to fetch/i.test(err.message) ? err.message : null;
      setDataset({
        ...EMPTY_DATASET,
        fileName: file.name,
        error: detail || 'Unable to prepare this file. Please choose a valid CSV.',
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

  const handleStrategy = (name, strategy) => {
    setMissingStrategies((current) => {
      const next = { ...current };
      if (strategy && strategy !== 'none') next[name] = strategy;
      else delete next[name];
      return next;
    });
  };

  const buildChart = async () => {
    if (!dataset.profile || !dataset.fileName) return;
    const activeStrategies = Object.fromEntries(
      Object.entries(missingStrategies).filter(([, strategy]) => strategy && strategy !== 'none')
    );
    setNextLoading(true);
    try {
      const result = await prepareCSV(fileRef.current, {
        types: typeOverrides,
        transforms: activeStrategies,
      });
      const profile = profileFromColumns(result.columns, result.row_count);
      setApplied({
        rows: result.rows,
        profile,
        recommendation: recommendVisualization(profile),
        key: `${dataset.fileName}:${JSON.stringify(typeOverrides)}:${JSON.stringify(activeStrategies)}`,
      });
      setStep('visualize');
    } catch (err) {
      const detail =
        err?.message && !/fetch|network|failed to fetch/i.test(err.message) ? err.message : null;
      setDataset((current) => ({ ...current, error: detail || 'The data could not be prepared.' }));
    } finally {
      setNextLoading(false);
    }
  };

  const { loading } = dataset;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-onSurface font-hanken">CSV Explorer</h1>
        <p className="mt-1 max-w-3xl text-sm text-onSurface-variant font-hanken">
          Import any CSV file, review how its columns are interpreted, then build a chart from your
          own data.
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
          error={dataset.error}
          columns={dataset.profile.columns}
          overrides={typeOverrides}
          missingStrategies={missingStrategies}
          onOverride={handleOverride}
          onStrategy={handleStrategy}
          onBack={resetToUpload}
          onNext={buildChart}
          nextLoading={nextLoading}
        />
      )}

      {step === 'visualize' && applied && (
        <>
          <SectionCard title="Suggested starting point" subtitle={applied.recommendation.reason}>
            <div className="flex items-center gap-3 text-sm text-onSurface">
              <Icon
                name={applied.recommendation.chartType === 'table' ? 'table_view' : 'auto_graph'}
                size={24}
                color="#0051d5"
              />
              <span>
                Recommended view:{' '}
                <strong className="capitalize">{applied.recommendation.chartType}</strong>. All
                controls remain available below.
              </span>
            </div>
          </SectionCard>
          <CSVChartEngine
            key={applied.key}
            fileName={dataset.fileName}
            headers={dataset.headers}
            rows={applied.rows}
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
