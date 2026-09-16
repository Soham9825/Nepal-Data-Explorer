import { describe, it, expect } from 'vitest';
import { getCountryFlag, getCountryCode, formatCountryName } from './countryFlags';

describe('countryFlags', () => {
  it('getCountryCode returns ISO codes instead of throwing', () => {
    expect(getCountryCode('Nepal')).toBe('NEP');
    expect(getCountryCode('India')).toBe('IND');
    expect(getCountryCode('United Kingdom')).toBe('GBR');
    expect(getCountryCode('Unknown Place')).toBe('UNK');
  });

  it('getCountryFlag returns a flag for known countries', () => {
    expect(getCountryFlag('Nepal')).toBe('🇳🇵');
    expect(getCountryFlag('India')).toBe('🇮🇳');
  });

  it('formatCountryName combines flag and name', () => {
    expect(formatCountryName('India')).toBe('🇮🇳 India');
  });
});