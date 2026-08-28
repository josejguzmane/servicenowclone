import { durationToMs } from './token.service';

describe('durationToMs', () => {
  it('parses the supported units', () => {
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('24h')).toBe(86_400_000);
    expect(durationToMs('30d')).toBe(2_592_000_000);
  });

  it('rejects malformed durations instead of silently defaulting', () => {
    expect(() => durationToMs('15 minutes')).toThrow(/Invalid duration/);
    expect(() => durationToMs('1w')).toThrow(/Invalid duration/);
  });
});
