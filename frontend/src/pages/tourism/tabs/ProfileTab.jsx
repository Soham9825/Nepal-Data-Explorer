import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { AGE_VISIBLE_ROWS, PURPOSE_VISIBLE_ROWS, RANKED_BAR_MAX_H } from '../constants';
import ChartPanel from '../components/ChartPanel';
import RankedBars from '../components/RankedBars';
import SelectControl from '../components/SelectControl';
import GenderPanel from './GenderPanel';
import TrekkingPanel from './TrekkingPanel';

/**
 * Visitor profile tab: why people come, who they are, and where they trek.
 *
 * Purpose and age sit side by side as two year-ranked readings of the same kind,
 * then gender and trekking get their own rows because each pairs a chart with a
 * year summary.
 */
export default function ProfileTab({
  purpose,
  age,
  gender,
  trekking,
  onPurposeYearChange,
  onAgeYearChange,
  onSexYearChange,
  onTrekkingYearChange,
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartPanel
          id="tourism-section-purpose"
          title="Purpose of visit"
          subtitle={`Recorded arrivals by purpose in ${purpose.year || 'the latest available year'}${
            purpose.scrolls ? ' — scroll to see all' : ''
          }`}
          action={
            <SelectControl
              label="Year"
              value={purpose.year}
              onChange={onPurposeYearChange}
              options={purpose.years.map((year) => ({ value: year, label: year }))}
            />
          }
          note="Shares use the sum of reported purpose categories for the selected year."
        >
          <RankedBars
            items={purpose.items}
            color={COLORS.activity}
            maxHeight={purpose.scrolls ? RANKED_BAR_MAX_H[PURPOSE_VISIBLE_ROWS] : undefined}
            emptyMessage="No purpose records are available for this year."
          />
        </ChartPanel>

        <ChartPanel
          id="tourism-section-age"
          title="Visitor age groups"
          subtitle={`Reported arrivals and shares in ${age.year || 'the latest available year'}${
            age.scrolls ? ' — scroll to see all' : ''
          }`}
          action={
            <SelectControl
              label="Year"
              value={age.year}
              onChange={onAgeYearChange}
              options={age.years.map((year) => ({ value: year, label: year }))}
            />
          }
          note="Shares use the source-reported total. The 46–60 and 60+ source bands overlap at age 60, so groups should be interpreted as published."
        >
          <RankedBars
            items={age.items}
            color={COLORS.arrivals}
            maxHeight={age.scrolls ? RANKED_BAR_MAX_H[AGE_VISIBLE_ROWS] : undefined}
            emptyMessage="No age records are available for this year."
          />
        </ChartPanel>
      </div>

      <GenderPanel gender={gender} onYearChange={onSexYearChange} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]">
        <TrekkingPanel trekking={trekking} onYearChange={onTrekkingYearChange} />
      </div>
    </div>
  );
}
