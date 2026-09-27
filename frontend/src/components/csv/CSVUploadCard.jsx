import { useCallback, useRef, useState } from 'react';
import { SectionCard } from '../ui/Card';
import { BtnOutline } from '../ui/Button';
import { Icon } from '../ui/Icon';

export default function CSVUploadCard({
  inputRef,
  fileName,
  error,
  warning,
  loading,
  onClear,
  onChange,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file && onChange) {
        const syntheticEvent = { target: { files: [file] } };
        onChange(syntheticEvent);
      }
    },
    [onChange]
  );

  return (
    <SectionCard
      title="Upload a dataset"
      subtitle="Only CSV and TSV files are supported."
      action={
        fileName &&
        !loading && (
          <BtnOutline onClick={onClear} className="normal-case tracking-normal">
            <Icon name="close" size={16} />
            Clear
          </BtnOutline>
        )
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        onChange={onChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        disabled={loading}
        className={`flex min-h-40 w-full cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 text-center transition-all duration-200 disabled:cursor-wait ${
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.01]'
            : 'border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10'
        }`}
      >
        <Icon name="upload_file" size={34} color="#b70011" />
        <span className="mt-3 text-sm font-bold text-onSurface">
          {fileName || 'Choose a CSV file'}
        </span>
        <span className="mt-1 text-xs text-onSurface-variant">
          {loading
            ? 'Reading and profiling the file…'
            : fileName
              ? 'Click to choose a different file'
              : 'Click to browse or drag and drop'}
        </span>
        {!fileName && !loading && (
          <span className="mt-2 text-[11px] text-caption">Maximum file size: 100 MB</span>
        )}
      </button>
      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-onSurface-variant">
          <Icon name="sync" size={17} className="animate-spin" />
          Reading and profiling the file, this can take a moment…
        </p>
      )}
      {error && (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary" role="alert">
          <Icon name="error" size={17} />
          {error}
        </p>
      )}
      {warning && (
        <p
          className="mt-4 flex items-center gap-2 text-sm font-semibold text-amber-600"
          role="alert"
        >
          <Icon name="warning" size={17} />
          {warning}
        </p>
      )}
    </SectionCard>
  );
}
