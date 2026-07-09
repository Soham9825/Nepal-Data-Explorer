// src/data/tourismData.js

// ============================================
// TOURISM STATISTICS CARDS DATA
// ============================================
export const TOURISM_STATS = [
  {
    label: 'Tourist Arrivals (2023)',
    value: '1,003,892',
    icon: 'groups',
    change: '+62.8%',
    sub: 'vs 2022'
  },
  {
    label: 'Tourism Revenue',
    value: 'Rs.670M',
    icon: 'trending_up',
    change: '+91.4%',
    sub: 'vs 2022'
  },
  {
    label: 'Trekking Permits',
    value: '157,000',
    icon: 'hiking',
    change: '+44%',
    sub: 'vs 2022'
  },
  {
    label: 'Avg. Stay (Days)',
    value: '12.4',
    icon: 'calendar_today',
    change: '+0.8',
    sub: 'vs 2022'
  }
];

// ============================================
// TOP DESTINATIONS DATA - Like in the image
// ============================================
export const TOURISM_ITEMS = [
  {
    label: 'Everest Base Camp',
    arrivals: '48,500',
    pct: 48,
    icon: 'location',
    color: '#7a5100',
    trend: '+12.5%',
    trendUp: true,
    rank: 1,
    province: 'Koshi Province',
    tag: 'Koshi'
  },
  {
    label: 'Annapurna Circuit',
    arrivals: '142,000',
    pct: 100,
    icon: 'location',
    color: '#0051d5',
    trend: '+8.1%',
    trendUp: true,
    rank: 2,
    province: 'Gandaki Province',
    tag: 'Gandaki'
  },
  {
    label: 'Lumbini',
    arrivals: '1,200,000',
    pct: 100,
    icon: 'location',
    color: '#2e7d32',
    trend: '+3.7%',
    trendUp: true,
    rank: 3,
    province: 'Lumbini Province',
    tag: 'Lumbini'
  },
  {
    label: 'Chitwan NP',
    arrivals: '220,000',
    pct: 18,
    icon: 'location',
    color: '#b70011',
    trend: '+6.3%',
    trendUp: true,
    rank: 4,
    province: 'Bagmati Province',
    tag: 'Bagmati'
  },
  {
    label: 'Pokhara',
    arrivals: '520,000',
    pct: 43,
    icon: 'location',
    color: '#6a1b9a',
    trend: '+11.2%',
    trendUp: true,
    rank: 5,
    province: 'Gandaki Province',
    tag: 'Gandaki'
  },
  {
    label: 'Langtang NP',
    arrivals: '35,000',
    pct: 35,
    icon: 'location',
    color: '#d97706',
    trend: '+5.8%',
    trendUp: true,
    rank: 6,
    province: 'Bagmati Province',
    tag: 'Bagmati'
  }
];

// ============================================
// CHART DATA
// ============================================
export const ARRIVALS_HISTORY = [
  { year: '2019', tourism: 1200 },
  { year: '2020', tourism: 450 },
  { year: '2021', tourism: 380 },
  { year: '2022', tourism: 850 },
  { year: '2023', tourism: 1140 }
];

export const REVENUE_HISTORY = [
  { year: '2019', revenue: 786 },
  { year: '2020', revenue: 146 },
  { year: '2021', revenue: 95 },
  { year: '2022', revenue: 398 },
  { year: '2023', revenue: 734 }
];

// ============================================
// FORECAST DATA
// ============================================
export const FORECAST_DATA = 
  'Arrivals projected to reach 1.18M — up ~17% — as Pokhara International Airport scales and Himalayan trekking demand rises.';

// ============================================
// EXPORT ALL DATA
// ============================================
export default {
  stats: TOURISM_STATS,
  destinations: TOURISM_ITEMS,
  arrivalsHistory: ARRIVALS_HISTORY,
  revenueHistory: REVENUE_HISTORY,
  forecast: FORECAST_DATA
};