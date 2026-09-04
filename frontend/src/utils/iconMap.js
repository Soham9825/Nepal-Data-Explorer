// utils/iconMap.js



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