import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DataFooter from './DataFooter';
import { downloadCSV } from '../../utils/download';
import { exportComprehensiveReportPdf } from '../../utils/exportPdf';

vi.mock('../../utils/download', () => ({ downloadCSV: vi.fn() }));
vi.mock('../../utils/exportPdf', () => ({
  exportComprehensiveReportPdf: vi.fn(() => Promise.resolve()),
}));

const DISPLAYED_ROWS = [
  { Dataset: 'GDP trend', Year: '2023', Value: '3.9', Unit: '%' },
  { Dataset: 'GDP trend', Year: '2024', Value: '4.1', Unit: '%' },
];

describe('DataFooter export flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CSV exports the displayed csvData directly', async () => {
    render(
      <DataFooter
        csvData={DISPLAYED_ROWS}
        csvFilename="national-dataset.csv"
        datasetLabel="National"
        reportTitle="National Dashboard Report"
        reportMeta={{ fiscalYear: '2081/82' }}
      />
    );

    fireEvent.click(screen.getByText('National Dataset CSV'));

    await waitFor(() => expect(downloadCSV).toHaveBeenCalledTimes(1));
    expect(downloadCSV).toHaveBeenCalledWith(DISPLAYED_ROWS, 'national-dataset.csv');
  });

  it('PDF exports the displayed csvData with its own PDF-document title and fiscal year', async () => {
    render(
      <DataFooter
        csvData={DISPLAYED_ROWS}
        csvFilename="national-dataset.csv"
        datasetLabel="National"
        reportTitle="National Dashboard Report"
        reportMeta={{ fiscalYear: '2081/82' }}
      />
    );

    fireEvent.click(screen.getByText('National Dataset PDF'));

    await waitFor(() => expect(exportComprehensiveReportPdf).toHaveBeenCalledTimes(1));
    const [data, options] = exportComprehensiveReportPdf.mock.calls[0];
    expect(data).toBe(DISPLAYED_ROWS);
    expect(options.title).toBe('National Dashboard PDF Document');
    expect(options.meta).toEqual({
      fiscalYear: '2081/82',
      documentType: 'PDF Document',
    });
  });

  it('Report uses the backend handler when provided', async () => {
    const onDownloadReport = vi.fn();

    render(
      <DataFooter
        csvData={DISPLAYED_ROWS}
        csvFilename="national-dataset.csv"
        datasetLabel="National"
        reportTitle="National Dashboard Report"
        onDownloadReport={onDownloadReport}
        reportMeta={{ fiscalYear: '2081/82' }}
      />
    );

    fireEvent.click(screen.getByText('National Dataset Report'));

    await waitFor(() => expect(onDownloadReport).toHaveBeenCalledTimes(1));
    expect(exportComprehensiveReportPdf).not.toHaveBeenCalled();
  });
});
