import { API_BASE_URL } from '../config';
import { auth } from './auth';

function filenameFromHeaders(headers, fallback) {
  const disposition = headers.get('Content-Disposition') || '';
  // RFC 5987 encoded names take precedence: filename*=UTF-8''<name>
  const encoded = disposition.match(/filename\*=(?:utf-8'')?([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // fall through to the plain filename/marker below
    }
  }
  const plain = disposition.match(/filename=([^;]+)/i);
  if (plain) return plain[1].trim().replace(/^"|"$/g, '');
  return headers.get('X-Report-Filename') || fallback;
}

async function downloadReport(endpoint, dashboardState, fallbackFilename) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...auth.authenticatedHeaders(),
    },
    body: JSON.stringify(dashboardState),
  });

  if (!response.ok) {
    let detail = 'Export generation failed';
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const filename = filenameFromHeaders(response.headers, fallbackFilename);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export const downloadNationalReport = (dashboardState = {}) =>
  downloadReport('/api/reports/national-dashboard/', dashboardState, 'National_Dataset_Report.pdf');

export const downloadTourismReport = (dashboardState = {}) =>
  downloadReport('/api/reports/tourism-dashboard/', dashboardState, 'Tourism_Dataset_Report.pdf');

export const downloadEconomicReport = (dashboardState = {}) =>
  downloadReport('/api/reports/economic-dashboard/', dashboardState, 'Economic_Dataset_Report.pdf');

export const downloadNationalCsv = (dashboardState = {}) =>
  downloadReport('/api/reports/national-csv/', dashboardState, 'National_Dataset.csv');

export const downloadTourismCsv = (dashboardState = {}) =>
  downloadReport('/api/reports/tourism-csv/', dashboardState, 'Tourism_Dataset.csv');

export const downloadEconomicCsv = (dashboardState = {}) =>
  downloadReport('/api/reports/economic-csv/', dashboardState, 'Economic_Dataset.csv');

export default {
  downloadNationalReport,
  downloadTourismReport,
  downloadEconomicReport,
  downloadNationalCsv,
  downloadTourismCsv,
  downloadEconomicCsv,
};
