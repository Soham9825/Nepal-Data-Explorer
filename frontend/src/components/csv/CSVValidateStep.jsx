import CSVPreviewTable from './CSVPreviewTable';
import CSVColumnTypes from './CSVColumnTypes';
import CSVMissingStrategy from './CSVMissingStrategy';
import { BtnOutline, BtnPrimary } from '../ui/Button';
import { Icon } from '../ui/Icon';

import CSVQualitySummary from './CSVQualitySummary';

export default function CSVValidateStep({
  fileName, headers, rows, totalRowCount, isSampled, warning, error,
  columns, overrides, missingStrategies, onOverride, onStrategy,
  onBack, onNext, nextLoading, quality,
}) {
  return (
    <div className="space-y-6">
      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          <Icon name="error" size={17} />
          {error}
        </p>
      )}
      {quality && <CSVQualitySummary quality={quality} />}
      <CSVColumnTypes
        columns={columns}
        overrides={overrides}
        onOverride={onOverride}
        warning={warning}
      />
      <CSVMissingStrategy
        columns={columns}
        strategies={missingStrategies}
        onStrategy={onStrategy}
      />
      <CSVPreviewTable
        fileName={fileName}
        headers={headers}
        rows={rows}
        totalRowCount={totalRowCount}
        isSampled={isSampled}
        onReplace={onBack}
        quality={quality}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BtnOutline onClick={onBack}>
          <Icon name="arrow_back" size={16} />
          Change file
        </BtnOutline>
        <BtnPrimary onClick={onNext} disabled={nextLoading}>
          {nextLoading ? 'Preparing data…' : 'Looks good — Build chart'}
          {!nextLoading && <Icon name="arrow_forward" size={16} />}
        </BtnPrimary>
      </div>
    </div>
  );
}