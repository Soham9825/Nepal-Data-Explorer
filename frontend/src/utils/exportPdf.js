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

/** Values that stand in for "no figure" rather than being text. */
const BLANK_CELLS = new Set(['', '-', '–', '—', 'n/a', 'na', 'null', 'none', '.']);

function isBlankCell(value) {
  return BLANK_CELLS.has(
    String(value ?? '')
      .trim()
      .toLowerCase()
  );
}

/**
 * Is this cell a plain figure, possibly signed, grouped, decimal or a percentage?
 *
 * Deliberately narrow. Years, counts and rates qualify; "Trekking & Mountaineering" does
 * not. The check only gates alignment and padding, so a false positive costs whitespace
 * rather than corrupting a value.
 */
function isNumericValue(value) {
  return /^[+-]?[\d,]*\.?\d+\s*%?$/.test(String(value).trim());
}

/** Split a figure into the parts that have to line up separately. */
function splitNumeric(value) {
  const text = String(value).trim();
  const match = text.match(/^([+-]?)([\d,]*)\.?(\d*)\s*(%?)$/);
  if (!match) return { sign: match?.[1] ?? '', int: text, dec: '', suffix: '' };
  return {
    sign: match[1],
    int: match[2].replace(/,/g, '') || '0',
    dec: match[3],
    suffix: match[4],
  };
}

/**
 * Should thousands separators be added to this column?
 *
 * No for years. Grouping a year turns 1993 into "1,993", which is wrong rather than
 * merely inelegant, so a column of four-digit values in a plausible year range is left
 * alone, as is any column whose header says it holds years or fiscal years.
 */
function shouldGroupThousands(column, parts) {
  if (/year|yr\b|fiscal/i.test(column)) return false;
  return !parts.every(
    (part) => part.int.length === 4 && Number(part.int) >= 1900 && Number(part.int) <= 2100
  );
}

/**
 * Decide how every column in the document should be typeset.
 *
 * Built once from *all* rows, not per table, so every table in one export agrees on where
 * a column sits. Deriving widths table by table made two tables from the same dashboard
 * disagree about where "Year" began, which reads as the data being scrambled rather than
 * as two tables being laid out separately.
 *
 * A numeric column records the widest integer part and the deepest decimal, which is what
 * lets every figure be padded to one width with the decimal points stacked — the vertical
 * rule a reader actually uses to compare magnitudes.
 *
 * Placeholders are skipped when deciding whether a column is numeric. A year column with
 * one missing value is still a year column, and should not collapse to left-aligned text
 * because of a single "-".
 */
function buildColumnProfile(columns, rows) {
  return columns.map((column) => {
    const values = rows.map((row) => row[column]).filter((value) => !isBlankCell(value));
    const text = values.map((value) => String(value).trim());
    const figures = text.filter(isNumericValue);
    const profile = {
      column,
      numeric: values.length > 0 && figures.length === values.length,
      group: false,
      intWidth: 0,
      decWidth: 0,
      suffix: '',
      width: 0,
    };

    if (profile.numeric) {
      const parts = figures.map(splitNumeric);
      profile.group = shouldGroupThousands(column, parts);
      for (const part of parts) {
        const digits = Number(part.int);
        // The width has to be measured on the *rendered* integer, since adding separators
        // makes a value wider than the digits it came from.
        const rendered =
          profile.group && Number.isFinite(digits) ? digits.toLocaleString('en-US') : part.int;
        profile.intWidth = Math.max(profile.intWidth, rendered.length);
        profile.decWidth = Math.max(profile.decWidth, part.dec.length);
        if (part.suffix) profile.suffix = part.suffix;
      }
      profile.width =
        profile.intWidth +
        (profile.decWidth ? 1 + profile.decWidth : 0) +
        profile.suffix.length +
        6;
    } else {
      // A text column is measured by its longest single word, because that is what decides
      // the wrap width; measuring whole cells would let one long sentence set the width.
      const longestWord = text.reduce(
        (longest, value) =>
          Math.max(
            longest,
            value.split(/\s+/).reduce((best, part) => Math.max(best, part.length), 0)
          ),
        column.length
      );
      profile.width = longestWord + 6;
    }
    return profile;
  });
}

/**
 * Share `total` points across the columns in proportion to what each needs.
 *
 * Two constraints fight each other here, and both have to hold at once:
 *
 * - No column may be narrower than `MIN_WIDTH`, or its figures become unreadable.
 * - No column may be wider than `MAX_WIDTH`, or one long free-text column swallows the
 *   table and squeezes the figures beside it.
 *
 * The cap is therefore derived from the column count rather than fixed. A hard 200pt cap
 * is unsatisfiable for a three-column table on a 762pt content width — three capped
 * columns can only ever reach 600pt, so any allocator asked to fill the width has to
 * either leave a gap or drive a column negative. Scaling the cap with the available width
 * keeps the range reachable for any number of columns.
 *
 * Weights are turned into point shares *before* clamping, so two columns needing 9 and 19
 * characters do not both land on the same floor and come out identical. Whatever the
 * clamps take or give is then redistributed across the columns that still have headroom
 * in the needed direction, so the widths fill `total` exactly and the table ends flush
 * with the margin.
 */
function allocateColumnWidths(profile, total) {
  const count = profile.length;
  if (!count) return [];
  const MIN_WIDTH = 44;
  // Comfortably above the even share, so a text column can grow without the caps making
  // the target unreachable, but never so high that it can take the whole table.
  const MAX_WIDTH = Math.max(220, (total / count) * 2.2);

  const weights = profile.map((column) => Math.max(1, column.width));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => (weight / weightSum) * total);
  const pinned = widths.map((width) => width < MIN_WIDTH || width > MAX_WIDTH);
  widths.forEach((width, index) => {
    if (pinned[index]) widths[index] = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
  });

  for (let pass = 0; pass < count + 2; pass += 1) {
    const residual = total - widths.reduce((sum, width) => sum + width, 0);
    if (Math.abs(residual) < 0.01) break;
    const growing = residual > 0;

    // Only columns with room in the direction we need can absorb the correction.
    const free = widths
      .map((width, index) => ({ index, headroom: growing ? MAX_WIDTH - width : width - MIN_WIDTH }))
      .filter(({ index, headroom }) => !pinned[index] && headroom > 0.01);
    if (!free.length) break;
    const headroomSum = free.reduce((sum, entry) => sum + entry.headroom, 0);
    if (headroomSum <= 0) break;

    for (const { index, headroom } of free) {
      widths[index] += (headroom / headroomSum) * residual;
      if (Math.abs(widths[index] - (growing ? MAX_WIDTH : MIN_WIDTH)) < 0.01) pinned[index] = true;
    }
  }

  const rounded = widths.map((width) => Math.floor(width * 100) / 100);
  // Fold the sub-point rounding drift into the widest column so the total is exact.
  const drift = Math.round((total - rounded.reduce((sum, width) => sum + width, 0)) * 100) / 100;
  rounded[rounded.indexOf(Math.max(...rounded))] += drift;
  return rounded;
}

/**
 * Render one value into the fixed shape its column was profiled for.
 *
 * Numeric cells are grouped (unless the column holds years), padded to a fixed number of
 * decimals, and left-padded to the column's integer width, so every figure in a column is
 * the same width and the decimal points sit on one vertical line. Text is passed through
 * with the underscores cleaned up, to match the column headers.
 */
function formatForColumn(value, column) {
  if (isBlankCell(value)) {
    // Keep a visible placeholder so a missing figure still holds its column's alignment.
    return value == null || String(value).trim() === '' ? '' : String(value).trim();
  }
  if (!column.numeric) return String(value).replace(/_/g, ' ');

  const parts = splitNumeric(value);
  const digits = Number(parts.int);
  const intText =
    column.group && Number.isFinite(digits) ? digits.toLocaleString('en-US') : parts.int;
  const paddedInt = intText.padStart(column.intWidth, ' ');
  const decText = column.decWidth
    ? `.${(parts.dec || '').padEnd(column.decWidth, '0')}`.slice(0, column.decWidth + 1)
    : '';
  return `${paddedInt}${decText}${column.suffix}`;
}

/**
 * The shared autotable column configuration: an explicit width and alignment per column,
 * which is what turns auto-widthed cells into a table with a straight left edge, a
 * straight right edge and figures sitting against the decimal rule.
 */
function tableLayout(profile, widths) {
  return {
    columnStyles: profile.reduce((styles, column, index) => {
      styles[index] = {
        cellWidth: widths[index],
        halign: column.numeric ? 'right' : 'left',
      };
      return styles;
    }, {}),
  };
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

  const stamp = `Generated on ${formatDate()}`;
  // The band behind this header is ACCENT, so every line drawn on it has to be light. The
  // stamp used to be set in TEXT_DARK, which put near-black text on the red band.
  const STAMP_WIDTH = 150;

  doc.setTextColor(TEXT_LIGHT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(title, MARGIN, 36, { maxWidth: PAGE_WIDTH - MARGIN * 2 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const subtitleText = subtitle || `Generated ${formatDate()}`;
  // Capped short of the stamp so a long subtitle cannot run underneath it.
  doc.text(subtitleText, MARGIN, 54, {
    maxWidth: PAGE_WIDTH - MARGIN * 2 - STAMP_WIDTH,
  });

  doc.setTextColor('#fbeaea');
  doc.setFontSize(9);
  doc.text(stamp, PAGE_WIDTH - MARGIN, 52, { align: 'right' });
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
  const profile = buildColumnProfile(columns, csvData);
  const widths = allocateColumnWidths(profile, CONTENT_WIDTH);
  const rows = csvData.map((row) =>
    columns.map((column, index) => formatForColumn(row[column], profile[index]))
  );

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
    headStyles: {
      fillColor: ACCENT,
      textColor: TEXT_LIGHT,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    ...tableLayout(profile, widths),
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
  // One profile and one width set for the whole document. Every group table below reuses
  // them, so a reader moving between two tables in the same PDF finds each column where
  // they last left it.
  const profile = buildColumnProfile(columns, csvData);
  const widths = allocateColumnWidths(profile, CONTENT_WIDTH);
  const layout = tableLayout(profile, widths);

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

    // Columns are profiled across the whole document, so a group that happens to be short
    // is still typeset to the same widths as one with long values in it.
    const groupColumns = resolveColumns(groupRows);
    const bodyRows = groupRows.map((row) =>
      groupColumns.map((column) => formatForColumn(row[column], profile[columns.indexOf(column)]))
    );

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
      headStyles: {
        fillColor: ACCENT,
        textColor: TEXT_LIGHT,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      alternateRowStyles: { fillColor: ROW_ALT },
      // A group is missing the `Dataset` column it was split on, so its own indices are
      // remapped onto the document-wide widths rather than reusing the first N of them.
      columnStyles: groupColumns.reduce((styles, column, index) => {
        const source = columns.indexOf(column);
        const template = source === -1 ? {} : layout.columnStyles[source];
        styles[index] = { ...template, cellWidth: widths[source === -1 ? 0 : source] };
        return styles;
      }, {}),
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
