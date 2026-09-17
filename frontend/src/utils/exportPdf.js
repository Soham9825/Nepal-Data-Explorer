import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadBlob } from './download';

const ACCENT = '#b70011';
const ACCENT_DARK = '#7a0a12';
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

function createDoc() {
  return new jsPDF({ orientation: PAGE_ORIENTATION, unit: 'pt', format: PAGE_FORMAT });
}

function drawCoverPage(doc, { title, subtitle, source, meta = {} }) {
  const pageWidth = PAGE_WIDTH;
  const pageHeight = PAGE_HEIGHT;

  // Primary branding first — accent header band opens with the product name
  doc.setFillColor(ACCENT);
  doc.rect(0, 0, pageWidth, 224, 'F');
  doc.setFillColor(ACCENT_DARK);
  doc.rect(0, 224, pageWidth, 8, 'F');

  doc.setTextColor(TEXT_LIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('NEPAL DATA EXPLORER', MARGIN, 48);

  // Dashboard title
  doc.setTextColor(TEXT_LIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text(title.split('\n')[0], MARGIN, 104, { maxWidth: pageWidth - MARGIN * 2 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor('#fbeaea');
  doc.text(meta.documentType || 'PDF Document', MARGIN, 132, { maxWidth: pageWidth - MARGIN * 2 });

  // Fiscal year + generated date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor('#ffffff');
  doc.text(`Fiscal Year: ${meta.fiscalYear || 'All periods'}`, MARGIN, 164, {
    maxWidth: pageWidth - MARGIN * 2,
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor('#fbeaea');
  const contextBits = [meta.selectedProvince, meta.indicator].filter(Boolean);
  if (contextBits.length) {
    doc.text(contextBits.join('  ·  '), MARGIN, 186, { maxWidth: pageWidth - MARGIN * 2 });
  }
  doc.text(`Generated: ${meta.generated || formatDate()}`, MARGIN, 206, {
    maxWidth: pageWidth - MARGIN * 2,
  });

  // Body area
  let y = 296;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(TEXT_MUTED);
    const subtitleLines = doc.splitTextToSize(subtitle, pageWidth - MARGIN * 2);
    doc.text(subtitleLines, MARGIN, y);
    y += subtitleLines.length * 16 + 22;
  }

  // Overview facts strip
  const facts = [
    { label: 'Records', value: meta.totalRecords ?? '' },
    { label: 'Groups', value: meta.groups ?? '' },
    { label: 'Fields', value: meta.fields ?? '' },
    { label: 'Prepared', value: meta.prepared ?? '' },
  ];
  const factBoxWidth = (pageWidth - MARGIN * 2) / facts.length;
  facts.forEach((fact, index) => {
    const x = MARGIN + index * factBoxWidth;
    doc.setFillColor(index % 2 === 0 ? '#fdf3f2' : '#eef4ff');
    doc.roundedRect(x, y, factBoxWidth - 14, 68, 5, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(ACCENT);
    doc.text(String(fact.value ?? '—'), x + 8, y + 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED);
    doc.text(fact.label.toUpperCase(), x + 8, y + 44);
  });
  y += 96;

  // Scope blurb
  doc.setDrawColor('#d9d0ce');
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT_MUTED);
  const scope = [
    'This document consolidates the datasets displayed on the Nepal Data Explorer dashboard.',
    'It presents the data tables and live visualizations behind every chart shown on the page,',
    'suitable for research, policy analysis and offline review.',
  ];
  doc.text(scope, MARGIN, y, { maxWidth: pageWidth - MARGIN * 2 });
  y += scope.length * 15 + 14;

  // Source footer
  if (source) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MUTED);
    doc.text(`Source: ${source}`, MARGIN, y);
  }

  // Bottom accent strip
  doc.setFillColor(ACCENT);
  doc.rect(0, pageHeight - 22, pageWidth, 22, 'F');
  doc.setTextColor(TEXT_LIGHT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(FOOTER_TEXT, MARGIN, pageHeight - 9);
  doc.text(`Generated ${formatDate()}`, pageWidth - MARGIN, pageHeight - 9, { align: 'right' });
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
  // Start at page 2 — the cover page has its own footer
  for (let page = 2; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(ACCENT);
    doc.setLineWidth(1);
    doc.line(MARGIN, PAGE_HEIGHT - 34, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 34);
    doc.setTextColor(TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(FOOTER_TEXT, MARGIN, PAGE_HEIGHT - 22);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 22, {
      align: 'right',
    });
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
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: TEXT_DARK,
      cellPadding: 4,
      valign: 'middle',
      lineColor: '#e9e2e0',
      lineWidth: 0.4,
    },
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
    meta = {},
  } = options;

  const columns = resolveColumns(csvData);
  const hasDatasetColumn = columns.includes('Dataset');
  const groups = hasDatasetColumn
    ? Array.from(new Set(csvData.map((row) => row.Dataset ?? '')))
        .filter(Boolean)
        .map((name) => [name, csvData.filter((row) => String(row.Dataset ?? '') === name)])
    : [[title, csvData]];

  const doc = createDoc();

  drawCoverPage(doc, {
    title,
    subtitle,
    source,
    meta: {
      totalRecords: csvData.length,
      groups: groups.length,
      fields: columns.length,
      prepared: formatDate(),
      ...meta,
    },
  });

  doc.addPage();

  let y = 92;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(ACCENT_DARK);
  doc.text('What is included', MARGIN, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT_DARK);
  const intro =
    `This PDF document contains the data currently displayed on the dashboard ` +
    `(${meta.fiscalYear ? `fiscal year ${meta.fiscalYear}, ` : ''}generated ${formatDate()}). ` +
    `Every table below is exported exactly as it appears on the page, with ` +
    `${csvData.length} record${csvData.length === 1 ? '' : 's'} across ${groups.length} dataset ` +
    `group${groups.length === 1 ? '' : 's'}:`;
  const introLines = doc.splitTextToSize(intro, CONTENT_WIDTH);
  doc.text(introLines, MARGIN, y);
  y += introLines.length * 16 + 6;

  // List each included dataset group with its record count
  const groupBoxHeight = 30;
  groups.forEach(([groupName, groupRows], index) => {
    if (y + groupBoxHeight > PAGE_HEIGHT - 80) {
      doc.addPage();
      y = 60;
    }
    doc.setFillColor(index % 2 === 0 ? '#eef4ff' : '#fdf3f2');
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, groupBoxHeight, 5, 5, 'F');
    doc.setDrawColor('#d9d0ce');
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, groupBoxHeight, 5, 5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(ACCENT_DARK);
    doc.text(groupName, MARGIN + 14, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MUTED);
    doc.text(`${groupRows.length} record${groupRows.length === 1 ? '' : 's'}`, MARGIN + 14, y + 25);
    y += groupBoxHeight + 10;
  });

  y += 10;

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
      styles: {
        font: 'helvetica',
        fontSize: 8,
        textColor: TEXT_DARK,
        cellPadding: 4,
        valign: 'middle',
        lineColor: '#e9e2e0',
        lineWidth: 0.4,
      },
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
  downloadBlob(doc.output('blob'), slugPdfFilename(filename));
}
