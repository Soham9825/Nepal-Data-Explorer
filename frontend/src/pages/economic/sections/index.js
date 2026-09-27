/**
 * The section registry.
 *
 * Each section file exports a descriptor rather than a bare component: a `subtitle`
 * and `action` for the card header, and the `content` component for the body.
 * `subtitle` and `action` are pure functions of the view model, so a section keeps
 * its header control next to the chart that control changes.
 *
 * The panel reads this map instead of branching on the section id, which is what
 * keeps adding a section to a one-line change in `TABS` and one file here.
 */
import { SECTION_CATALOG } from '../constants';
import { APPI_SECTION } from './AppiSection';
import { APPI_TABLE_SECTION } from './AppiTableSection';
import { ECONOMIES_SECTION } from './EconomiesSection';
import { ECONOMY_WIDE_SECTION } from './EconomyWideSection';
import { PARTNERS_SECTION } from './PartnersSection';
import { PROVINCE_SECTION } from './ProvinceSection';
import { SALARY_SECTION } from './SalarySection';
import { SECTORAL_SECTION } from './SectoralSection';
import { TRADE_SECTION } from './TradeSection';
import { TRADE_BALANCE_SECTION } from './TradeBalanceSection';
import { WORLD_OUTPUT_SECTION } from './WorldOutputSection';

const DESCRIPTORS = {
  sectoral: SECTORAL_SECTION,
  overall: ECONOMY_WIDE_SECTION,
  growth: WORLD_OUTPUT_SECTION,
  economies: ECONOMIES_SECTION,
  trade: TRADE_SECTION,
  partners: PARTNERS_SECTION,
  balance: TRADE_BALANCE_SECTION,
  salary: SALARY_SECTION,
  appi: APPI_SECTION,
  appi_table: APPI_TABLE_SECTION,
  province: PROVINCE_SECTION,
};

export const SECTIONS = SECTION_CATALOG.map((section) => ({
  ...DESCRIPTORS[section.id],
  id: section.id,
  label: section.label,
  // The card title is the catalog label, so a section is never titled twice.
  title: section.label,
}));

export const SECTION_BY_ID = SECTIONS.reduce((byId, section) => {
  byId[section.id] = section;
  return byId;
}, {});
