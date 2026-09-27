
export default function TwoColumn({ left, right }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 min-h-0">{left}</div>
      <div className="lg:col-span-1 min-h-0">{right}</div>
    </div>
  );
}
