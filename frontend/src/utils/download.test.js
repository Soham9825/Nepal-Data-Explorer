import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadCSV, downloadBlob } from './download';

function captureDownload() {
  let capturedBlobText = '';
  let capturedFilename = '';
  class FakeBlob {
    constructor(chunks, options) {
      this.type = options?.type || '';
      this.parts = chunks;
      capturedBlobText = chunks.join('');
    }
  }
  globalThis.Blob = FakeBlob;

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(() => {
    const anchor = realCreateElement('a');
    Object.defineProperty(anchor, 'download', {
      set(value) {
        capturedFilename = value;
      },
      get() {
        return capturedFilename;
      },
    });
    vi.spyOn(anchor, 'click').mockImplementation(() => {});
    return anchor;
  });

  return {
    get text() {
      return capturedBlobText;
    },
    get filename() {
      return capturedFilename;
    },
  };
}

describe('downloadCSV', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does nothing when there are no rows', () => {
    const spy = captureDownload();
    downloadCSV([], 'x.csv');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(spy.filename).toBe('');
  });

  it('writes the exact displayed rows to the CSV blob', () => {
    const capture = captureDownload();
    const rows = [
      {
        Dataset: 'GDP trend',
        Year: '2023',
        Value: 3.9,
        Unit: '%',
      },
      {
        Dataset: 'Population distribution',
        Province: 'Bagmati',
        Population: '12345',
        Percentage: 20,
        Unit: 'people',
      },
    ];
    downloadCSV(rows, 'national-dataset.csv');

    expect(capture.filename).toBe('national-dataset.csv');
    expect(capture.text.startsWith('\uFEFFDataset,Year,Value,Unit')).toBe(true);
    expect(capture.text).toContain('GDP trend,2023,3.9,%');
    expect(capture.text).toContain('Population distribution,,,people,Bagmati,12345,20');
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('downloadBlob', () => {
  afterEach(() => vi.restoreAllMocks());

  it('triggers a same-page download with the given filename', () => {
    const capture = captureDownload();
    downloadBlob(new Blob(['data'], { type: 'text/plain' }), 'out.csv');
    expect(capture.filename).toBe('out.csv');
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
