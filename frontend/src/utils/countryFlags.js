const COUNTRY_FLAGS = {
  Afghanistan: '🇦🇫',
  Australia: '🇦🇺',
  Bangladesh: '🇧🇩',
  Bhutan: '🇧🇹',
  Canada: '🇨🇦',
  China: '🇨🇳',
  France: '🇫🇷',
  Germany: '🇩🇪',
  India: '🇮🇳',
  Italy: '🇮🇹',
  Japan: '🇯🇵',
  Malaysia: '🇲🇾',
  Myanmar: '🇲🇲',
  Nepal: '🇳🇵',
  Netherlands: '🇳🇱',
  Singapore: '🇸🇬',
  'Sri Lanka': '🇱🇰',
  Srilanka: '🇱🇰',
  'United States of America': '🇺🇸',
  SouthKorea: '🇰🇷',
  'South Korea': '🇰🇷',
  Spain: '🇪🇸',
  Thailand: '🇹🇭',
  UK: '🇬🇧',
  'United Kingdom': '🇬🇧',
  USA: '🇺🇸',
  US: '🇺🇸',
  'United States': '🇺🇸',
  Britain: '🇬🇧',
};


export function getCountryFlag(country) {
  const name = String(country || '').trim();
  const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');
  const matchingName = Object.keys(COUNTRY_FLAGS).find(
    (countryName) => countryName.toLowerCase().replace(/[^a-z]/g, '') === normalizedName,
  );
  return COUNTRY_FLAGS[name] || (matchingName && COUNTRY_FLAGS[matchingName]) || '🌐';
}

const COUNTRY_CODES = {
  Afghanistan: 'AFG',
  Australia: 'AUS',
  Bangladesh: 'BAN',
  Bhutan: 'BHU',
  Canada: 'CAN',
  China: 'CHN',
  France: 'FRA',
  Germany: 'GER',
  India: 'IND',
  Italy: 'ITA',
  Japan: 'JPN',
  Malaysia: 'MAS',
  Myanmar: 'MYA',
  Nepal: 'NEP',
  Netherlands: 'NED',
  Singapore: 'SIN',
  'Sri Lanka': 'SRI',
  Srilanka: 'SRI',
  'United States of America': 'USA',
  SouthKorea: 'KOR',
  'South Korea': 'KOR',
  Spain: 'ESP',
  Thailand: 'THA',
  UK: 'GBR',
  'United Kingdom': 'GBR',
  USA: 'USA',
  US: 'USA',
  'United States': 'USA',
  Britain: 'GBR',
};

export function getCountryCode(country) {
  return COUNTRY_CODES[String(country || '').trim()] || String(country || '').trim().slice(0, 3).toUpperCase();
}

export function formatCountryCode(country) {
  return `${getCountryFlag(country)} ${getCountryCode(country)}`;
}

export function formatCountryName(country) {
  const name = String(country || '').trim();
  return `${getCountryFlag(name)} ${name}`;
}
