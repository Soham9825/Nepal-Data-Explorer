/**
 * CSV export rows for the Economic dashboard.
 *
 * The export is a long-format dump rather than one sheet per chart: every row
 * carries a `Dataset` name, so the nine series plus the two province-growth
 * measures land in a single file a reader can pivot. Rows that share a dataset
 * share a column set, which is what keeps the file usable in a spreadsheet.
 *
 * Built on each export rather than on each render: it walks the whole payload, and
 * the footer only reads it when a download is actually requested.
 */
import { ECONOMY_WIDE_SERIES, PARTNER_KEYS } from './constants';
import { formatValue, stripRealPrefix } from './format';
import { PROVINCE_ORDER } from '../../services/provinceGDP';

/** One long-format row per non-null value of `keys` on `row`. */
function perKeyRows(row, keys, build) {
  return keys.flatMap((key) => (row[key] == null ? [] : [build(key, row[key])]));
}

/** The headline figures the KPI cards show, repeated as rows so the file is complete. */
function indicatorRows({ worldOutput, trade }) {
  const latestWorld = worldOutput.rows.at(-1);
  return [
    ...(latestWorld
      ? [
          {
            Dataset: 'Key indicators',
            Indicator: 'World Output Growth',
            Value: `${formatValue(latestWorld.value)}%`,
            Period: latestWorld.year,
          },
        ]
      : []),
    {
      Dataset: 'Key indicators',
      Indicator: 'Total Exports',
      Value: trade.exports == null ? '—' : formatValue(trade.exports),
      Period: trade.year || '',
    },
    {
      Dataset: 'Key indicators',
      Indicator: 'Total Imports',
      Value: trade.imports == null ? '—' : formatValue(trade.imports),
      Period: trade.year || '',
    },
  ];
}

function worldOutputRows(worldOutput) {
  return worldOutput.rows.map((row) => ({
    Dataset: 'World Output Growth',
    Year: row.year,
    Value: row.value,
    Unit: '%',
  }));
}

function economiesRows(rows) {
  return rows.flatMap((row) =>
    perKeyRows(
      row,
      Object.keys(row).filter((key) => key !== 'year'),
      (context, value) => ({
        Dataset: 'Global Economies Growth',
        Year: stripRealPrefix(row.year),
        Economy: context,
        Value: value,
        Unit: '%',
      })
    )
  );
}

function economyWideRows(rows) {
  return rows.flatMap((row) =>
    ECONOMY_WIDE_SERIES.flatMap(({ key }) =>
      row[key] == null
        ? []
        : [
            {
              Dataset: 'Economy-wide Growth',
              'Fiscal Year': row.fiscal_year,
              Component: key,
              Value: row[key],
              Unit: '%',
            },
          ]
    )
  );
}

function tradeRows(history) {
  return history.map((row) => ({
    Dataset: 'Foreign Trade',
    Year: row.year,
    Group: row.exports != null ? 'Exports / Imports' : 'Imports',
    Exports: row.exports ?? '',
    Imports: row.imports ?? '',
  }));
}

function partnerRows(rows, flow) {
  return rows.flatMap((row) =>
    PARTNER_KEYS.flatMap((partner) =>
      row[partner] == null
        ? []
        : [
            {
              Dataset: 'Foreign Trade by Partner',
              'Fiscal Year': row.fiscal_year,
              Flow: flow,
              Partner: partner,
              Value: row[partner],
            },
          ]
    )
  );
}

function tradeBalanceRows(rows) {
  return rows.map((row) => ({
    Dataset: 'Foreign Trade by Partner',
    'Fiscal Year': row.fiscal_year,
    Flow: 'Trade balance',
    Value: row.value,
  }));
}

/**
 * The sectoral export carries the group a sector belongs to, because the flat list
 * the chart used to draw was flat here too and a spreadsheet of eighteen
 * unlabelled names answers none of the same questions the chart now answers. The
 * group total is exported as its own row and marked, so the subtotal is not
 * mistaken for a nineteenth sector.
 */
function sectoralRows(sectoral) {
  const rows = [];
  sectoral.groups.forEach((group) => {
    if (Number.isFinite(group.total)) {
      rows.push({
        Dataset: 'Sectoral Growth',
        Year: sectoral.year,
        Group: group.label,
        Sector: `${group.label} (group total)`,
        Value: group.total,
        Unit: '%',
      });
    }
    group.children.forEach((child) => {
      rows.push({
        Dataset: 'Sectoral Growth',
        Year: sectoral.year,
        Group: group.label,
        Sector: child.label,
        Value: child.value,
        Unit: '%',
      });
    });
  });
  return rows;
}

function salaryRows(rows) {
  return rows.map((row) => ({
    Dataset: 'Salary & Wage Rate Index',
    Year: row.year,
    Category: row.group,
    Value: row.value,
    Unit: 'Index',
  }));
}

function appiRows(rows) {
  return rows.map((row) => ({
    Dataset: 'Agriculture Producer Price Index',
    Product: row.product,
    'Base Year': row.base_year,
    Quarter: row.quarter,
    Value: row.value,
    Unit: 'Index',
  }));
}

/**
 * Province growth as one row per fiscal year and province, carrying both price
 * bases side by side. The endpoint nests the two measures, so the purchaser-price
 * value has to be looked up on its own series.
 */
function provinceGrowthRows(provinceGdp) {
  const provinces = provinceGdp?.provinces?.length ? provinceGdp.provinces : PROVINCE_ORDER;
  const purchaserByYear = new Map(
    (provinceGdp?.growth?.purchaser_price || []).map((row) => [row.fiscal_year, row])
  );

  return (provinceGdp?.growth?.basic_price || []).flatMap((row) =>
    provinces.map((province) => ({
      Dataset: 'Province-wise GDP growth',
      'Fiscal Year': row.fiscal_year,
      Province: province,
      'Growth Basic Price (%)': row[province] ?? '',
      'Growth Purchaser Price (%)': purchaserByYear.get(row.fiscal_year)?.[province] ?? '',
    }))
  );
}

/** Every row of `economic-dataset.csv`, in the order the sections read. */
export function buildEconomicCsvRows({
  data,
  worldOutput,
  trade,
  partners,
  balance,
  sectoral,
  provinceGdp,
}) {
  return [
    ...indicatorRows({ worldOutput, trade }),
    ...worldOutputRows(worldOutput),
    ...economiesRows(data?.economies_growth || []),
    ...economyWideRows(data?.overall_growth || []),
    ...tradeRows(trade.history),
    ...partnerRows(partners.exports, 'Exports'),
    ...partnerRows(partners.imports, 'Imports'),
    ...tradeBalanceRows(balance.rows),
    ...sectoralRows(sectoral),
    ...salaryRows(data?.salary_index || []),
    ...appiRows(data?.appi || []),
    ...provinceGrowthRows(provinceGdp),
  ];
}
