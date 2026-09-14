import { useCallback, useRef, useState } from 'react';
import Papa from 'papaparse';
import { SectionCard } from '../ui/Card';
import { BtnOutline } from '../ui/Button';
import { Icon } from '../ui/Icon';

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_COLUMNS = 5000;
const BINARY_SIGNATURES = [
  [0x89, 0x50, 0x4E, 0x47], // PNG
  [0xFF, 0xD8, 0xFF],       // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x50, 0x4B, 0x03, 0x04], // ZIP/DOCX/XLSX
  [0xD0, 0xCF, 0x11, 0xE0], // OLE (DOC/XLS)
  [0x52, 0x61, 0x72, 0x21], // RAR
  [0x1F, 0x8B],             // GZIP
  [0x42, 0x5A, 0x68],       // BZ2
  [0x37, 0x7A, 0xBC, 0xAF], // 7Z
  [0x49, 0x44, 0x33],       // MP3
  [0x66, 0x74, 0x79, 0x70], // MP4
  [0x4F, 0x67, 0x67, 0x53], // OGG
  [0x52, 0x49, 0x46, 0x46], // RIFF (WAV/WEBP)
];

function detectMimeType(arrayBuffer) {
  const header = new Uint8Array(arrayBuffer.slice(0, 16));
  for (const sig of BINARY_SIGNATURES) {
    if (sig.every((byte, i) => header[i] === byte)) return true;
  }
  return false;
}

function hasConsistentDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { consistent: true, delimiter: null };
  const delimiters = [',', '\t', ';', '|'];
  let bestDelimiter = null;
  let bestScore = 0;
  for (const d of delimiters) {
    const counts = lines.map((line) => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === d && !inQuotes) count++;
      }
      return count;
    });
    const first = counts[0];
    if (first === 0) continue;
    const matches = counts.filter((c) => c === first).length;
    const score = matches / counts.length;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = d;
    }
  }
  return { consistent: bestScore >= 0.8, delimiter: bestDelimiter };
}

async function readFirstChunk(file, bytes = 8192) {
  return new Promise((resolve) => {
    const slice = file.slice(0, bytes);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(slice);
  });
}

async function validateFileContent(file) {
  const chunk = await readFirstChunk(file);
  if (!chunk) return { valid: false, message: 'Unable to read the file.' };
  if (detectMimeType(chunk)) {
    return { valid: false, message: 'This file appears to be a binary file (image, PDF, etc.), not a CSV.' };
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(chunk);
  } catch {
    try {
      text = new TextDecoder('latin1').decode(chunk);
    } catch {
      return { valid: false, message: 'Unable to decode the file. Please ensure it is a valid text-based CSV.' };
    }
  }
  const printableRatio = text.replace(/[^\x20-\x7E\t\r\n]/g, '').length / Math.max(1, text.length);
  if (printableRatio < 0.85) {
    return { valid: false, message: 'This file does not appear to contain readable text. Please upload a valid CSV.' };
  }
  const { consistent } = hasConsistentDelimiter(text);
  if (!consistent) {
    return { valid: false, message: 'This file does not have consistent column delimiters. Please upload a valid CSV.' };
  }
  return { valid: true };
}

export async function validateCSV(file) {
  if (!file) {
    return { valid: false, data: [], meta: {}, errors: [], warning: null, message: 'Please select a CSV file.' };
  }
  const fileName = file.name || '';
  if (!fileName.toLowerCase().endsWith('.csv')) {
    return { valid: false, data: [], meta: {}, errors: [], warning: null, message: 'Invalid file. Only CSV files are supported.' };
  }
  if (file.size === 0) {
    return { valid: false, data: [], meta: {}, errors: [], warning: null, message: 'The CSV file is empty.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, data: [], meta: {}, errors: [], warning: null, message: 'File is too large. Maximum allowed size is 100 MB.' };
  }
  const contentCheck = await validateFileContent(file);
  if (!contentCheck.valid) {
    return { valid: false, data: [], meta: {}, errors: [], warning: null, message: contentCheck.message };
  }
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: '',
      dynamicTyping: false,
      worker: true,
      error: (error) => {
        resolve({ valid: false, data: [], meta: {}, errors: [error], warning: null, message: error?.message || 'Unable to read this file as a CSV.' });
      },
      complete: (results) => {
        const data = results?.data || [];
        const errors = results?.errors || [];
        const meta = results?.meta || {};
        const fields = meta.fields || [];

        if (fields.length === 0) {
          resolve({ valid: false, data: [], meta, errors, warning: null, message: 'Invalid CSV. No column headers were found.' });
          return;
        }
        if (fields.length > MAX_COLUMNS) {
          resolve({ valid: false, data: [], meta, errors, warning: null, message: `CSV contains too many columns. Maximum allowed is ${MAX_COLUMNS}.` });
          return;
        }

        const emptyHeaderIndex = fields.findIndex((field) => !String(field).trim());
        if (emptyHeaderIndex !== -1) {
          resolve({ valid: false, data: [], meta, errors, warning: null, message: `Invalid CSV. Column ${emptyHeaderIndex + 1} has an empty header.` });
          return;
        }

        const normalizedHeaders = fields.map((field) => String(field).trim().toLowerCase());
        const duplicates = normalizedHeaders.filter((header, index) => normalizedHeaders.indexOf(header) !== index);
        if (duplicates.length > 0) {
          const uniqueDuplicates = [...new Set(duplicates)];
          resolve({ valid: false, data: [], meta, errors, warning: null, message: `Invalid CSV. Duplicate column name${uniqueDuplicates.length > 1 ? 's' : ''}: ${uniqueDuplicates.join(', ')}` });
          return;
        }

        const validRows = data.filter((row) => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some((value) => value !== null && value !== undefined && String(value).trim() !== '');
        });

        if (validRows.length === 0) {
          resolve({ valid: false, data: [], meta, errors, warning: null, message: 'The CSV contains column headers but no data rows.' });
          return;
        }

        let warning = null;
        if (errors.length > 0) {
          warning = `${errors.length} minor CSV issue${errors.length > 1 ? 's were' : ' was'} detected, but the dataset could still be parsed.`;
        }

        resolve({ valid: true, data: validRows, meta, errors, warning, message: null });
      },
    });
  });
}

export default function CSVUploadCard({ inputRef, fileName, error, warning, loading, onClear, onChange }) {
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

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && onChange) {
      const syntheticEvent = { target: { files: [file] } };
      onChange(syntheticEvent);
    }
  }, [onChange]);

  return (
    <SectionCard
      title="Upload a dataset"
      subtitle="Only CSV files are supported."
      action={fileName && !loading && (
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
          <span className="mt-2 text-[11px] text-onSurface-variant/60">
            Maximum file size: 100 MB
          </span>
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
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-amber-600" role="alert">
          <Icon name="warning" size={17} />
          {warning}
        </p>
      )}
    </SectionCard>
  );
}
