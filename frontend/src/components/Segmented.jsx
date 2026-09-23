/**
 * iOS-style segmented control: equal segments and a sliding selected "thumb" that animates between them.
 * options: [{ value, label, title? }]
 */
export default function Segmented({ options = [], value, onChange, label, size, tone = 'blue' }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const n = Math.max(1, options.length);
  return (
    <div className={size === 'sm' ? 'seg seg--sm' : 'seg'} data-tone={tone} role="group" aria-label={label} style={{ '--n': n, '--i': idx }}>
      <span className="seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={String(o.value)} type="button" className="seg__btn" aria-pressed={o.value === value} title={o.title} onClick={() => onChange?.(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
