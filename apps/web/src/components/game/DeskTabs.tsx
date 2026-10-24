import type { Desk } from '@ms/engine';

/** Blender-rendered desk icon (art/blender/desk_icons.py). Decorative: the label carries the meaning. */
export const deskIcon = (id: Desk | 'DASHBOARD'): string => `/art/desks/${id === 'DASHBOARD' ? 'world' : id.toLowerCase()}.webp`;

const tabs: { id: Desk | 'DASHBOARD'; label: string; short: string }[] = [
  { id: 'DASHBOARD', label: 'World', short: 'World' },
  { id: 'STOCKS', label: 'Stocks', short: 'Stocks' },
  { id: 'IPO', label: 'IPOs', short: 'IPOs' },
  { id: 'FUNDS', label: 'Funds & SIP', short: 'Funds' },
  { id: 'FIXED_INCOME', label: 'Fixed income', short: 'Fixed' },
  { id: 'COMMODITIES', label: 'Commodities', short: 'Gold' },
  { id: 'GLOBAL', label: 'Global', short: 'Global' },
  { id: 'CRYPTO', label: 'Crypto', short: 'Crypto' },
  { id: 'PREDICTION', label: 'Forecasts', short: 'Forecast' },
];

export function DeskTabs({ active, unlocked, onChange }: { active: Desk | 'DASHBOARD'; unlocked: Desk[]; onChange: (desk: Desk | 'DASHBOARD') => void }) {
  return (
    <nav className="desk-tabs" aria-label="Market desks" data-tour="desks">
      {tabs.map((tab, index) => {
        const locked = tab.id !== 'DASHBOARD' && !unlocked.includes(tab.id);
        return (
          <button key={tab.id} className={`${active === tab.id ? 'active' : ''} ${locked ? 'locked' : ''}`} onClick={() => onChange(tab.id)} aria-disabled={locked} title={locked ? 'Locked in this mode' : `${tab.label} (${index + 1})`}>
            <img className="desk-icon" src={deskIcon(tab.id)} alt="" width={24} height={24} decoding="async" />
            <span className="tab-long">{tab.label}</span><span className="tab-short">{tab.short}</span>
            {locked && <small>⌑</small>}
            {active === tab.id && <i className="tab-ink" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}
