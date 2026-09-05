import React from 'react';
import { SectionCard } from '../ui/Card';
import { BtnOutline } from '../ui/Button';
import { Icon } from '../ui/Icon';

export default function CSVUploadCard({ inputRef, fileName, error, onClear, onChange }) {
  return (
    <SectionCard
      title="Upload a dataset"
      subtitle="Only CSV files are supported."
      action={fileName && (
        <BtnOutline onClick={onClear} className="normal-case tracking-normal">
          <Icon name="close" size={16} />
          Clear
        </BtnOutline>
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-40 w-full flex-col items-center justify-center border border-dashed border-primary bg-primary/5 px-6 text-center transition-colors hover:bg-primary/10"
      >
        <Icon name="upload_file" size={34} color="#b70011" />
        <span className="mt-3 text-sm font-bold text-onSurface">
          {fileName || 'Choose a CSV file'}
        </span>
        <span className="mt-1 text-xs text-onSurface-variant">
          Click to browse from your computer
        </span>
      </button>
      {error && (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary" role="alert">
          <Icon name="error" size={17} />
          {error}
        </p>
      )}
    </SectionCard>
  );
}
