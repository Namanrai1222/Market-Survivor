import { describe, expect, it } from 'vitest';
import { addTradingDays, isOpen, nextOpenDay, testConfig, weekday } from '../src';

const cal = testConfig.calendars;

describe('world clock calendars', () => {
  it('story starts on Tuesday 1 Jan 2030', () => expect(weekday('2030-01-01')).toBe(2));

  it('weekends: equities closed, crypto open', () => {
    expect(isOpen('IN', '2030-01-05', cal)).toBe(false);
    expect(isOpen('US', '2030-01-06', cal)).toBe(false);
    expect(isOpen('CRYPTO', '2030-01-05', cal)).toBe(true);
  });

  it('India fixed-date holiday on a weekday', () => {
    expect(isOpen('IN', '2030-10-02', cal)).toBe(false); // Wednesday
    expect(isOpen('IN', '2030-10-03', cal)).toBe(true);
  });

  it('US rule-based holidays: Memorial Day and Thanksgiving 2030', () => {
    expect(isOpen('US', '2030-05-27', cal)).toBe(false); // last Monday of May
    expect(isOpen('US', '2030-11-28', cal)).toBe(false); // 4th Thursday of November
    expect(isOpen('US', '2030-11-21', cal)).toBe(true);
    expect(isOpen('IN', '2030-11-28', cal)).toBe(true); // US holidays don't close India
  });

  it('next open day skips the weekend and holidays', () => {
    expect(nextOpenDay('IN', '2030-01-04', cal)).toBe('2030-01-07'); // Fri → Mon
    expect(addTradingDays('IN', '2030-10-01', 1, cal)).toBe('2030-10-03');
    expect(addTradingDays('IN', '2030-01-01', 0, cal)).toBe('2030-01-01');
  });
});
