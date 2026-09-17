import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadBlob } from './download';

const ACCENT = '#b70011';
const TEXT_LIGHT = '#ffffff';
const TEXT_DARK = '#16161d';
const TEXT_MUTED = '#5f5f6a';
const ROW_ALT = '#faf6f5';
const FOOTER_TEXT = 'Nepal Data Explorer';

const PAGE_FORMAT = 'a4';
const PAGE_ORIENTATION = 'landscape';
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function resolveColumns(rows = []) {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

function formatCell(value) {
  if (value == null) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toLocaleString('en-US');
  }
  return String(value);
}

function formatDate() {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function slugPdfFilename(base) {
  const clean = (base || 'dataset.pdf').replace(/\.(csv|pdf)$/i, '').replace(/[^a-z0-9-]+/gi, '-');
  return `${clean.replace(/^-+|-+$/g, '') || 'dataset'}.pdf`;
}

function reportPdfFilename(base) {
  const clean = (base || 'dataset.pdf').replace(/\.(csv|pdf)$/i, '').replace(/[^a-z0-9-]+/gi, '-');
  const slug = clean.replace(/^-+|-+$/g, '') || 'dataset';
  return `${/-report$/i.test(slug) ? slug : `${slug}-report`}.pdf`;
}

function createDoc() {
  return new jsPDF({ orientation: PAGE_ORIENTATION, unit: 'pt', format: PAGE_FORMAT });
}

function drawHeader(doc, { title, subtitle }) {
  doc.setFillColor(ACCENT);
  doc.rect(0, 0, PAGE_WIDTH, 72, 'F');

  doc.setTextColor(TEXT_LIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(title, MARGIN, 36, { maxWidth: PAGE_WIDTH - MARGIN * 2 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const subtitleText = subtitle || `Generated ${formatDate()}`;
  doc.text(subtitleText, MARGIN, 54);

  doc.setTextColor(TEXT_DARK);
  doc.setFontSize(9);
  doc.text(`Generated on ${formatDate()}`, PAGE_WIDTH - MARGIN, 52, { align: 'right' });
}

function drawPageFrame(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(ACCENT);
    doc.setLineWidth(1);
    doc.line(MARGIN, PAGE_HEIGHT - 34, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 34);
    doc.setTextColor(TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(FOOTER_TEXT, MARGIN, PAGE_HEIGHT - 22);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 22, { align: 'right' });
  }
}

function sectionHeading(doc, { title, note, startY }) {
  let y = startY;
  if (y > PAGE_HEIGHT - 140) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFillColor(ACCENT);
  doc.rect(MARGIN, y, 4, 18, 'F');
  doc.setTextColor(TEXT_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, MARGIN + 14, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED);
  doc.text(note || '', MARGIN + 14, y + 28);
  return y + 42;
}

function rasterizeSvg(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', width * scale);
    clone.setAttribute('height', height * scale);
    clone.style.width = `${width * scale}px`;
    clone.style.height = `${height * scale}px`;

    const source = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ canvas, width: width * scale, height: height * scale });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not rasterize the chart SVG'));
    };

    image.src = url;
  });
}

async function embedChartSections(doc, sections = [], startY) {
  let y = startY;
  for (const section of sections) {
    const svg = section?.element?.querySelector
      ? section.element.querySelector('svg')
      : section?.element;
    if (!svg) continue;

    let capture;
    try {
      capture = await rasterizeSvg(svg);
    } catch (error) {
      console.warn('Skipping a chart in the report (rasterization failed)', error);
      continue;
    }

    y = sectionHeading(doc, {
      title: section.title || 'Visualization',
      note: section.note || '',
      startY: y,
    });

    const imageWidth = CONTENT_WIDTH;
    const imageHeight = (capture.height * imageWidth) / capture.width;
    if (y + imageHeight > PAGE_HEIGHT - 48) {
      doc.addPage();
      y = MARGIN;
    }

    doc.addImage(capture.canvas, 'PNG', MARGIN, y, imageWidth, imageHeight);
    y += imageHeight + 24;

    if (y > PAGE_HEIGHT - 140) {
      doc.addPage();
      y = MARGIN;
    }
  }
  return y;
}

export function exportDataTablePdf(csvData = [], options = {}) {
  if (!csvData.length) return;
  const { title = 'Data Export', subtitle = '', filename } = options;
  const columns = resolveColumns(csvData);
  const rows = csvData.map((row) => columns.map((column) => formatCell(row[column])));

  const doc = createDoc();
  drawHeader(doc, { title, subtitle });

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 92,
    margin: { left: MARGIN, right: MARGIN, bottom: 48 },
    styles: { font: 'helvetica', fontSize: 8, textColor: TEXT_DARK, cellPadding: 4, valign: 'middle', lineColor: '#e9e2e0', lineWidth: 0.4 },
    headStyles: { fillColor: ACCENT, textColor: TEXT_LIGHT, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {},
  });

  drawPageFrame(doc);
  downloadBlob(doc.output('blob'), slugPdfFilename(filename));
}

export async function exportComprehensiveReportPdf(csvData = [], options = {}) {
  if (!csvData.length) return;
  const {
    title = 'Comprehensive Report',
    subtitle = 'Dataset overview, summary notes and full record breakdown',
    source = '',
    sections = [],
    filename,
  } = options;

  const columns = resolveColumns(csvData);
  const hasDatasetColumn = columns.includes('Dataset');
  const groups = hasDatasetColumn
    ? Array.from(new Set(csvData.map((row) => row.Dataset ?? '')))
        .filter(Boolean)
        .map((name) => [name, csvData.filter((row) => String(row.Dataset ?? '') === name)])
    : [[title, csvData]];

  const doc = createDoc();

  drawHeader(doc, { title: 'Comprehensive Report', subtitle });

  let y = 104;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(TEXT_DARK);
  doc.text(title, MARGIN, y);
  y += 20;

  if (source) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MUTED);
    doc.text(`Source: ${source}`, MARGIN, y);
    y += 18;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT_DARK);
  const intro = `This report was generated on ${formatDate()} from the live Nepal Data Explorer datasets. It contains ${csvData.length} records across ${groups.length} dataset group${groups.length === 1 ? '' : 's'} and ${columns.length} fields.`;
  const introLines = doc.splitTextToSize(intro, CONTENT_WIDTH);
  doc.text(introLines, MARGIN, y);
  y += introLines.length * 14 + 16;

  doc.setDrawColor(ACCENT);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 14;

  const facts = [
    { label: 'Total records', value: csvData.length },
    { label: 'Dataset groups', value: groups.length },
    { label: 'Fields', value: columns.length },
    { label: 'Report date', value: formatDate() },
  ];

  const factBoxWidth = CONTENT_WIDTH / facts.length;
  facts.forEach((fact, index) => {
    const x = MARGIN + index * factBoxWidth;
    doc.setFillColor(index % 2 === 0 ? '#fdf3f2' : '#eef4ff');
    doc.roundedRect(x, y, factBoxWidth - 12, 56, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(ACCENT);
    doc.text(String(fact.value), x + 6, y + 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED);
    doc.text(fact.label.toUpperCase(), x + 6, y + 42);
  });
  y += 76;

  if (sections.length) {
    y = sectionHeading(doc, {
      title: 'Visualizations',
      note: `${sections.length} chart${sections.length === 1 ? '' : 's'} captured from the live dashboard`,
      startY: y,
    });
    y = await embedChartSections(doc, sections, y);
  }

  groups.forEach(([groupName, groupRows]) => {
    y = sectionHeading(doc, {
      title: groupName,
      note: `${groupRows.length} record${groupRows.length === 1 ? '' : 's'}`,
      startY: y,
    });

    const groupColumns = resolveColumns(groupRows);
    const bodyRows = groupRows.map((row) => groupColumns.map((column) => formatCell(row[column])));

    autoTable(doc, {
      startY: y,
      head: [groupColumns],
      body: bodyRows,
      margin: { left: MARGIN, right: MARGIN, bottom: 48 },
      styles: { font: 'helvetica', fontSize: 8, textColor: TEXT_DARK, cellPadding: 4, valign: 'middle', lineColor: '#e9e2e0', lineWidth: 0.4 },
      headStyles: { fillColor: ACCENT, textColor: TEXT_LIGHT, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: ROW_ALT },
    });

    y = doc.lastAutoTable.finalY + 26;
  });

  if (y < PAGE_HEIGHT - 110) {
    y += 6;
    doc.setDrawColor('#d9d0ce');
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(TEXT_MUTED);
    const notes = `Notes: Figures reflect the most recently connected datasets in the Nepal Data Explorer. Values are exported as displayed on the source page. For the raw machine-readable version of this data, use the Export CSV button.`;
    doc.text(doc.splitTextToSize(notes, CONTENT_WIDTH), MARGIN, y);
  }

  drawPageFrame(doc);
  downloadBlob(doc.output('blob'), reportPdfFilename(filename));
}