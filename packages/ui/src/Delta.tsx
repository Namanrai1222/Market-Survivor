import { direction, formatPct } from './format';

/** A signed percentage with ▲/▼ and up/down colour. Direction never relies on colour alone. */
export function Delta({ value, digits = 2, className = '' }: { value: number; digits?: number; className?: string }) {
  const d = direction(value, digits);
  const tone = d > 0 ? 'text-up' : d < 0 ? 'text-down' : 'text-mist-400';
  return (
    <span className={`tabular-nums whitespace-nowrap ${tone} ${className}`}>
      {d !== 0 && <span aria-hidden="true">{d > 0 ? '▲ ' : '▼ '}</span>}
      {formatPct(value, digits)}
    </span>
  );
}
