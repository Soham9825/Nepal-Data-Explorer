const DEFAULT_ICON = 'location_on';

// Keyword => Material Symbols icon rules for place/province names.
const ICON_RULES = [
  { icon: 'forest', keywords: ['mountain', 'himal', 'forest', 'hill', 'nature', 'wildlife', 'trek'] },
  { icon: 'water', keywords: ['lake', 'river', 'pond', 'kunda', 'taal', 'water'] },
  { icon: 'temple', keywords: ['temple', 'mandir', 'pagoda', 'monastery', 'gompa', 'stupa', 'gumba'] },
  { icon: 'palace', keywords: ['palace', 'durbar', 'fort', 'kot', 'museum', 'heritage', 'gallery'] },
  { icon: 'park', keywords: ['park', 'garden', 'bagan', 'zoo', 'picnic', 'botanic'] },
  { icon: 'flight', keywords: ['airport', 'air', 'flight', 'runway'] },
  { icon: 'bed', keywords: ['hotel', 'resort', 'lodge', 'guest', 'homestay', 'inn'] },
  { icon: 'beach_access', keywords: ['beach', 'coast', 'coastal', 'sea'] },
  { icon: 'restaurant', keywords: ['restaurant', 'cafe', 'food', 'dining', 'thamel'] },
  { icon: 'city', keywords: ['city', 'town', 'municipality', 'nagar', 'metropolitan'] },
  { icon: 'camping', keywords: ['camp', 'campsite', 'base camp'] },
  { icon: 'shrine', keywords: ['shrine', 'masjid', 'mosque', 'church', 'gurdwara'] },
  { icon: 'landscape', keywords: ['view', 'point', 'pass', 'valley', 'ghat'] },
];

export function getPlaceIcon(name = '') {
  const normalized = name.toLowerCase();

  for (const rule of ICON_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.icon;
    }
  }

  return DEFAULT_ICON;
}