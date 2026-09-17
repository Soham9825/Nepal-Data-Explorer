import { API_BASE_URL } from '../config';
import { auth } from './auth';

function filenameFromHeaders(headers, fallback) {
  const disposition = headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename=([^;]+)/i);
  if (match) return match[1].trim().replace(/^"|"$/g, '');
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
    throw new Error('Report generation failed');
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
  downloadReport(
    '/api/reports/national-dashboard/',
    dashboardState,
    'Nepal_Data_Explorer_National_Report.pdf',
  );

export const downloadTourismReport = (dashboardState = {}) =>
  downloadReport(
    '/api/reports/tourism-dashboard/',
    dashboardState,
    'Nepal_Data_Explorer_Tourism_Report.pdf',
  );

export const downloadEconomicReport = (dashboardState = {}) =>
  downloadReport(
    '/api/reports/economic-dashboard/',
    dashboardState,
    'Nepal_Data_Explorer_Economic_Report.pdf',
  );

export default { downloadNationalReport, downloadTourismReport, downloadEconomicReport };