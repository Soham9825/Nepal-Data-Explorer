import Papa from 'papaparse';
import auth from '../../services/auth';
import { API_BASE_URL } from '../../config';

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_COLUMNS = 5000;
const BINARY_SIGNATURES = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x50, 0x4b, 0x03, 0x04], // ZIP/DOCX/XLSX
  [0xd0, 0xcf, 0x11, 0xe0], // OLE (DOC/XLS)
  [0x52, 0x61, 0x72, 0x21], // RAR
  [0x1f, 0x8b], // GZIP
  [0x42, 0x5a, 0x68], // BZ2
  [0x37, 0x7a, 0xbc, 0xaf], // 7Z
  [0x49, 0x44, 0x33], // MP3
  [0x66, 0x74, 0x79, 0x70], // MP4
  [0x4f, 0x67, 0x67, 0x53], // OGG
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
    return {
      valid: false,
      message: 'This file appears to be a binary file (image, PDF, etc.), not a CSV.',
    };
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(chunk);
  } catch {
    try {
      text = new TextDecoder('latin1').decode(chunk);
    } catch {
      return {
        valid: false,
        message: 'Unable to decode the file. Please ensure it is a valid text-based CSV.',
      };
    }
  }
  const printableRatio = text.replace(/[^\x20-\x7E\t\r\n]/g, '').length / Math.max(1, text.length);
  if (printableRatio < 0.85) {
    return {
      valid: false,
      message: 'This file does not appear to contain readable text. Please upload a valid CSV.',
    };
  }
  const { consistent } = hasConsistentDelimiter(text);
  if (!consistent) {
    return {
      valid: false,
      message: 'This file does not have consistent column delimiters. Please upload a valid CSV.',
    };
  }
  return { valid: true };
}

export async function validateCSV(file) {
  if (!file) {
    return {
      valid: false,
      data: [],
      meta: {},
      errors: [],
      warning: null,
      message: 'Please select a CSV file.',
    };
  }
  const fileName = file.name || '';
  if (!fileName.toLowerCase().endsWith('.csv') && !fileName.toLowerCase().endsWith('.tsv')) {
    return {
      valid: false,
      data: [],
      meta: {},
      errors: [],
      warning: null,
      message: 'Invalid file. Only CSV files are supported.',
    };
  }
  if (file.size === 0) {
    return {
      valid: false,
      data: [],
      meta: {},
      errors: [],
      warning: null,
      message: 'The CSV file is empty.',
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      data: [],
      meta: {},
      errors: [],
      warning: null,
      message: 'File is too large. Maximum allowed size is 100 MB.',
    };
  }
  const contentCheck = await validateFileContent(file);
  if (!contentCheck.valid) {
    return {
      valid: false,
      data: [],
      meta: {},
      errors: [],
      warning: null,
      message: contentCheck.message,
    };
  }
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: '',
      dynamicTyping: false,
      worker: true,
      error: (error) => {
        resolve({
          valid: false,
          data: [],
          meta: {},
          errors: [error],
          warning: null,
          message: error?.message || 'Unable to read this file as a CSV.',
        });
      },
      complete: (results) => {
        const data = results?.data || [];
        const errors = results?.errors || [];
        const meta = results?.meta || {};
        const fields = meta.fields || [];

        if (fields.length === 0) {
          resolve({
            valid: false,
            data: [],
            meta,
            errors,
            warning: null,
            message: 'Invalid CSV. No column headers were found.',
          });
          return;
        }
        if (fields.length > MAX_COLUMNS) {
          resolve({
            valid: false,
            data: [],
            meta,
            errors,
            warning: null,
            message: `CSV contains too many columns. Maximum allowed is ${MAX_COLUMNS}.`,
          });
          return;
        }

        const emptyHeaderIndex = fields.findIndex((field) => !String(field).trim());
        if (emptyHeaderIndex !== -1) {
          resolve({
            valid: false,
            data: [],
            meta,
            errors,
            warning: null,
            message: `Invalid CSV. Column ${emptyHeaderIndex + 1} has an empty header.`,
          });
          return;
        }

        const normalizedHeaders = fields.map((field) => String(field).trim().toLowerCase());
        const duplicates = normalizedHeaders.filter(
          (header, index) => normalizedHeaders.indexOf(header) !== index
        );
        if (duplicates.length > 0) {
          const uniqueDuplicates = [...new Set(duplicates)];
          resolve({
            valid: false,
            data: [],
            meta,
            errors,
            warning: null,
            message: `Invalid CSV. Duplicate column name${uniqueDuplicates.length > 1 ? 's' : ''}: ${uniqueDuplicates.join(', ')}`,
          });
          return;
        }

        const validRows = data.filter((row) => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some(
            (value) => value !== null && value !== undefined && String(value).trim() !== ''
          );
        });

        if (validRows.length === 0) {
          resolve({
            valid: false,
            data: [],
            meta,
            errors,
            warning: null,
            message: 'The CSV contains column headers but no data rows.',
          });
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

export async function validateCSVOnServer(file) {
  const apiBaseUrl = API_BASE_URL;
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${apiBaseUrl}/api/datasets/files/validate-upload/`, {
    method: 'POST',
    credentials: 'include',
    headers: auth.authenticatedHeaders(),
    body: formData,
  });
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok || !result.valid) {
    throw new Error(result.detail || 'The server could not validate this CSV.');
  }
  return result;
}

/**
 * Ask the backend to clean, type and (optionally) fill/drop missing values.
 * Returns typed rows (missing values are null) plus a cleaning report, so the
 * visualisation always has renderable data even when the file has gaps.
 */
export async function prepareCSV(file, options = {}) {
  const apiBaseUrl = API_BASE_URL;
  const formData = new FormData();
  formData.append('file', file);
  if (options.types && Object.keys(options.types).length) {
    formData.append('types', JSON.stringify(options.types));
  }
  if (options.transforms && Object.keys(options.transforms).length) {
    formData.append('transforms', JSON.stringify(options.transforms));
  }
  const response = await fetch(`${apiBaseUrl}/api/datasets/files/prepare-upload/`, {
    method: 'POST',
    credentials: 'include',
    headers: auth.authenticatedHeaders(),
    body: formData,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.valid) {
    throw new Error(result.detail || 'The server could not prepare this CSV.');
  }
  return result;
}
