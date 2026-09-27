import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { downloadCSV } from '../../utils/download';
import { exportComprehensiveReportPdf } from '../../utils/exportPdf';

function toTitleCase(value) {
  return String(value)
    .replace(/\.[a-z]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sectionBaseName(csvFilename) {
  const base = toTitleCase(csvFilename)
    .replace(/\s+Dataset$/i, '')
    .replace(/\s+Data$/i, '');
  return base || 'Dataset';
}

function collectReportSections() {
  if (typeof document === 'undefined') return [];
  const charts = Array.from(document.querySelectorAll('main svg'))
    .filter((svg) => {
      const rect = svg.getBoundingClientRect();
      return rect.width >= 240 && rect.height >= 120;
    })
    .filter((svg) => !svg.parentElement?.closest('svg'));

  return charts.map((svg) => {
    let title = '';
    let node = svg.parentElement;
    for (let depth = 0; node && depth < 5; depth += 1) {
      const heading = node.querySelector('h1, h2, h3, h4, h5');
      if (heading && heading.textContent.trim()) {
        title = heading.textContent.trim().replace(/\s+/g, ' ');
        break;
      }
      node = node.parentElement;
    }
    return { title, element: svg };
  });
}

export default function DataFooter({
  csvData = [],
  csvFilename = 'dataset.csv',
  datasetLabel = '',
  reportTitle,
  pdfTitle,
  reportSubtitle,
  reportMeta = {},
  onDownloadReport,
  onDownloadCsv,
  preferFullCsv = false,
}) {
  const [reportStatus, setReportStatus] = useState({ state: 'idle', message: '' });
  const [csvStatus, setCsvStatus] = useState({ state: 'idle', message: '' });
  const [pdfStatus, setPdfStatus] = useState({ state: 'idle', message: '' });
  const displayTitle = reportTitle
    ? reportTitle
    : datasetLabel
      ? `${datasetLabel} Dataset`
      : `${toTitleCase(csvFilename)} Data`;
  const displayPdfTitle =
    pdfTitle || (datasetLabel ? `${datasetLabel} Dashboard PDF Document` : displayTitle);
  const pdfFilename = csvFilename.replace(/\.(csv)$/i, '.pdf');
  const baseName = datasetLabel || sectionBaseName(csvFilename);
  const csvButtonLabel = `${baseName} Dataset CSV`;
  const pdfButtonLabel = `${baseName} Dataset PDF`;
  const reportButtonLabel = `${baseName} Dataset Report`;

  const exportCsv = async () => {
    if (!preferFullCsv && csvData.length) {
      setCsvStatus({ state: 'success', message: 'Displayed dataset downloaded.' });
      downloadCSV(csvData, csvFilename);
      return;
    }
    if (typeof onDownloadCsv === 'function') {
      setCsvStatus({ state: 'loading', message: 'Preparing the full dataset...' });
      try {
        await onDownloadCsv();
        setCsvStatus({ state: 'success', message: 'Full dataset downloaded.' });
      } catch (error) {
        console.warn('Could not download the full dataset', error);
        setCsvStatus({
          state: 'error',
          message: 'Unable to prepare the dataset. Please try again.',
        });
      }
      return;
    }
    setCsvStatus({ state: 'error', message: 'No displayed data is available to download.' });
  };

  const exportPdf = async () => {
    if (!csvData.length) return;
    setPdfStatus({ state: 'loading', message: 'Preparing the PDF dataset...' });
    try {
      await exportComprehensiveReportPdf(csvData, {
        title: displayPdfTitle,
        subtitle:
          reportSubtitle ||
          `PDF document generated from the ${baseName} dashboard data exactly as displayed`,
        source: 'Nepal Data Explorer',
        sections: collectReportSections(),
        filename: pdfFilename,
        meta: { ...reportMeta, documentType: 'PDF Document' },
      });
      setPdfStatus({ state: 'success', message: 'PDF document downloaded.' });
    } catch (error) {
      console.warn('Could not generate the PDF dataset', error);
      setPdfStatus({
        state: 'error',
        message: 'Unable to prepare the PDF dataset. Please try again.',
      });
    }
  };
  const exportComprehensiveReport = async () => {
    if (typeof onDownloadReport === 'function') {
      setReportStatus({ state: 'loading', message: 'Generating comprehensive report...' });
      try {
        await onDownloadReport();
        setReportStatus({ state: 'success', message: 'Report downloaded successfully.' });
      } catch (error) {
        console.warn('Could not download the comprehensive report', error);
        setReportStatus({
          state: 'error',
          message: 'Unable to generate the report. Please try again.',
        });
      }
      return;
    }
    if (!csvData.length) return;
    try {
      await exportComprehensiveReportPdf(csvData, {
        title: displayTitle,
        subtitle:
          reportSubtitle ||
          `Comprehensive summary of the ${baseName} dashboard data, exported exactly as displayed`,
        source: 'Nepal Data Explorer',
        sections: collectReportSections(),
        filename: csvFilename,
        meta: { ...reportMeta, documentType: 'Comprehensive Report' },
      });
    } catch (error) {
      console.warn('Could not generate the comprehensive report', error);
    }
  };

  const statusMessage =
    reportStatus.state !== 'idle'
      ? reportStatus
      : pdfStatus.state !== 'idle'
        ? pdfStatus
        : csvStatus.state !== 'idle'
          ? csvStatus
          : null;

  return (
    <div className="bg-surface border border-outline-variant rounded-sm px-6 py-6 flex flex-col md:flex-row items-center justify-between card-shadow">
      <div className="mb-4 md:mb-0 text-center md:text-left">
        <h3 className="text-lg text-on-surface font-bold font-sans">Access Full Dataset</h3>
        <p className="text-on-surface-variant mt-1 text-sm font-sans">
          Download raw data for research or policy analysis.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={exportCsv}
            disabled={
              csvStatus.state === 'loading' ||
              (!csvData.length && typeof onDownloadCsv !== 'function')
            }
            className="flex items-center gap-2 rounded-sm border border-outline-variant px-4 py-2 text-on-surface transition-colors font-sans text-xs font-bold uppercase active:scale-95 hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon
              name={csvStatus.state === 'loading' ? 'hourglass_top' : 'description'}
              size={16}
              color="#0051d5"
            />
            <span>{csvStatus.state === 'loading' ? 'Preparing...' : csvButtonLabel}</span>
          </button>
          <button
            onClick={exportPdf}
            disabled={pdfStatus.state === 'loading' || !csvData.length}
            className="flex items-center gap-2 rounded-sm border border-outline-variant px-4 py-2 text-on-surface transition-colors font-sans text-xs font-bold uppercase active:scale-95 hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon
              name={pdfStatus.state === 'loading' ? 'hourglass_top' : 'picture_as_pdf'}
              size={16}
              color="#b70011"
            />
            <span>{pdfStatus.state === 'loading' ? 'Preparing...' : pdfButtonLabel}</span>
          </button>
          <button
            onClick={exportComprehensiveReport}
            disabled={
              reportStatus.state === 'loading' ||
              (!csvData.length && typeof onDownloadReport !== 'function')
            }
            className="flex items-center gap-2 rounded-sm border border-primary bg-primary px-5 py-2 text-on-primary font-sans text-xs font-bold uppercase shadow-md transition-all active:scale-95 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon
              name={reportStatus.state === 'loading' ? 'hourglass_top' : 'download'}
              size={16}
              color="#ffffff"
            />
            <span>{reportStatus.state === 'loading' ? 'Generating...' : reportButtonLabel}</span>
          </button>
        </div>
        {statusMessage && (
          <p
            className={[
              'text-xs font-sans text-caption',
              statusMessage.state === 'success' ? 'text-green-700' : 'text-nepal-crimson',
            ].join(' ')}
          >
            {statusMessage.message}
          </p>
        )}
      </div>
    </div>
  );
}
