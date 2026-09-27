import { CHART_HEIGHT } from '../constants';

export default function ChartBox({ children }) {
  return <div className={`${CHART_HEIGHT} min-h-0`}>{children}</div>;
}
