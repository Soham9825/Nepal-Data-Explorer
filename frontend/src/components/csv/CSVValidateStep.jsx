import React from 'react';
import CSVPreviewTable from './CSVPreviewTable';
import CSVColumnTypes from './CSVColumnTypes';
import { BtnOutline, BtnPrimary } from '../ui/Button';
import { Icon } from '../ui/Icon';

export default function CSVValidateStep({
  fileName, headers, rows, totalRowCount, isSampled, warning,
  columns, overrides, onOverride, onBack, onNext,
}) {
  return (
    <div className="space-y-6">
      <CSVColumnTypes
        columns={columns}
        overrides={overrides}
        onOverride={onOverride}
        warning={warning}
      />
      <CSVPreviewTable
        fileName={fileName}
        headers={headers}
        rows={rows}
        totalRowCount={totalRowCount}
        isSampled={isSampled}
        onReplace={onBack}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BtnOutline onClick={onBack}>
          <Icon name="arrow_back" size={16} />
          Change file
        </BtnOutline>
        <BtnPrimary onClick={onNext}>
          Looks good — Build chart
          <Icon name="arrow_forward" size={16} />
        </BtnPrimary>
      </div>
    </div>
  );
}