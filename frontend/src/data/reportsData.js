export const reports = [
  {
    title: 'Nepal Economic Outlook FY2023/24',
    type: 'PDF',
    size: '3.4 MB',
    date: 'Nov 2023',
    icon: 'description',
    preview: {
      kind: 'pdf',
      summary: 'A 42-page compiled outlook covering GDP growth, inflation trends, trade balance, and remittance inflows for FY2023/24.',
    },
  },
  {
    title: 'Tourism Statistics Annual Report 2023',
    type: 'PDF',
    size: '2.1 MB',
    date: 'Dec 2023',
    icon: 'description',
    preview: {
      kind: 'pdf',
      summary: 'Annual arrivals by nationality, purpose of visit, average length of stay, and revenue by province.',
    },
  },
  {
    title: 'Provincial GDP Dataset 2019–2023',
    type: 'CSV',
    size: '890 KB',
    date: 'Jan 2024',
    icon: 'table_chart',
    preview: {
      kind: 'table',
      columns: ['Province', '2019', '2020', '2021', '2022', '2023'],
      rows: [
        ['Koshi', '412.3', '398.1', '430.5', '455.2', '481.9'],
        ['Madhesh', '520.7', '505.4', '540.2', '568.8', '601.3'],
        ['Bagmati', '890.1', '860.5', '915.4', '968.2', '1024.6'],
        ['Gandaki', '310.4', '298.7', '325.1', '341.9', '360.2'],
      ],
    },
  },
  {
    title: 'Consumer Price Index Monthly Data',
    type: 'CSV',
    size: '420 KB',
    date: 'Jan 2024',
    icon: 'table_chart',
    preview: {
      kind: 'table',
      columns: ['Month', 'CPI', 'YoY %'],
      rows: [
        ['Jan 2024', '134.2', '5.8%'],
        ['Feb 2024', '134.9', '5.6%'],
        ['Mar 2024', '135.4', '5.4%'],
      ],
    },
  },
  {
    title: 'Trade Balance Historical 2010–2023',
    type: 'XLSX',
    size: '1.2 MB',
    date: 'Jan 2024',
    icon: 'table_chart',
    preview: {
      kind: 'table',
      columns: ['Year', 'Exports (NPR bn)', 'Imports (NPR bn)', 'Balance'],
      rows: [
        ['2021', '141.1', '1614.2', '-1473.1'],
        ['2022', '157.3', '1721.5', '-1564.2'],
        ['2023', '162.8', '1598.9', '-1436.1'],
      ],
    },
  },
  {
    title: 'AI Forecast Results — GDP/Inflation',
    type: 'CSV',
    size: '340 KB',
    date: 'Jan 2024',
    icon: 'auto_awesome',
    preview: {
      kind: 'table',
      columns: ['Year', 'GDP Growth (Predicted)', 'Inflation (Predicted)', 'Confidence'],
      rows: [
        ['2024', '4.9%', '6.1%', '88%'],
        ['2025', '5.2%', '5.8%', '81%'],
        ['2026', '5.4%', '5.6%', '74%'],
      ],
    },
  },
];

export const quickActions = [
  { title: 'Generate PDF Report', desc: 'Full dashboard with charts & AI insights', icon: 'picture_as_pdf', color: '#b70011' },
  { title: 'Export Raw CSV', desc: 'All indicators — clean, structured data', icon: 'table_chart', color: '#0051d5' },
  { title: 'Download AI Forecast', desc: 'Predictions with confidence intervals', icon: 'auto_awesome', color: '#7a5100' },
];

export const typeColors = {
  PDF: { color: '#b70011', bg: '#ffdad6' },
  CSV: { color: '#0051d5', bg: '#dbe1ff' },
  XLSX: { color: '#7a5100', bg: '#ffddb0' },
};