import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob } from './download';
import { exportDataTablePdf, exportComprehensiveReportPdf } from './exportPdf';

vi.mock('./download', () => ({
  downloadBlob: vi.fn(),
}));

const SAMPLE_ROWS = [
  { Dataset: 'GDP trend', Year: '2023', Value: '3.9', Unit: '%' },
  { Dataset: 'GDP trend', Year: '2024', Value: '4.1', Unit: '%' },
  { Dataset: 'Population', Province: 'Bagmati', Population: '29164578', Percentage: '20', Unit: 'people' },
];

const readBlob = async (blob) => blob.text();

describe('exportPdf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when there is no data', () => {
    exportDataTablePdf([], { filename: 'x.pdf' });
    exportComprehensiveReportPdf([], { filename: 'x.pdf' });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('exportDataTablePdf downloads a valid PDF blob', async () => {
    exportDataTablePdf(SAMPLE_ROWS, { title: 'Sample', filename: 'sample.csv' });
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = downloadBlob.mock.calls[0];
    expect(filename).toBe('sample.pdf');
    expect(blob.type).toBe('application/pdf');
    const content = await readBlob(blob);
    expect(content.slice(1, 4)).toBe('PDF');
  });

  it('exportComprehensiveReportPdf downloads a valid PDF blob', async () => {
    await exportComprehensiveReportPdf(SAMPLE_ROWS, {
      title: 'National Data',
      filename: 'national-dataset.csv',
    });
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = downloadBlob.mock.calls[0];
    expect(filename).toBe('national-dataset-report.pdf');
    expect(blob.type).toBe('application/pdf');
    const content = await readBlob(blob);
    expect(content.slice(1, 4)).toBe('PDF');
  });
});