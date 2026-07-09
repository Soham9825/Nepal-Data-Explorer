// utils/iconMap.js

const ICON_RULES = [
  { keywords: ['everest', 'annapurna', 'himal', 'mountain', 'peak', 'trek', 'langtang', 'manaslu'], icon: 'filter_hdr' },
  { keywords: ['national park', 'nat. park', 'jungle', 'wildlife', 'chitwan', 'bardiya', 'forest', 'reserve'], icon: 'forest' },
  { keywords: ['temple', 'stupa', 'buddha', 'lumbini', 'pashupatinath', 'monastery', 'shrine', 'heritage', 'pagoda'], icon: 'temple_buddhist' },
  { keywords: ['lake', 'phewa', 'rara', 'begnas', 'gosaikunda', 'tilicho', 'fewa'], icon: 'water' },
  { keywords: ['river', 'gorge', 'waterfall', 'rafting'], icon: 'water_drop' },
  { keywords: ['palace', 'durbar', 'fort', 'museum'], icon: 'account_balance' },
  { keywords: ['valley', 'hill', 'viewpoint'], icon: 'landscape' },
  { keywords: ['cave', 'gufa'], icon: 'terrain' },
];

const DEFAULT_ICON = 'location_on';

export function getPlaceIcon(name = '') {
  const normalized = name.toLowerCase();

  for (const rule of ICON_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.icon;
    }
  }

  return DEFAULT_ICON;
}