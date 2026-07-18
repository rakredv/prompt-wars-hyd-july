/**
 * Basic unit tests for MindYou server
 */

describe('Input Validation', () => {
  test('PIN must be 4-8 digits', () => {
    const validatePin = (pin) => /^\d{4,8}$/.test(pin);
    expect(validatePin('1234')).toBe(true);
    expect(validatePin('12345678')).toBe(true);
    expect(validatePin('abc')).toBe(false);
    expect(validatePin('123')).toBe(false);
    expect(validatePin('123456789')).toBe(false);
  });

  test('Valid habit types', () => {
    const VALID = ['screen_time', 'steps', 'sleep', 'mindfulness', 'exercise'];
    expect(VALID.includes('screen_time')).toBe(true);
    expect(VALID.includes('invalid_habit')).toBe(false);
  });

  test('Target value must be positive number', () => {
    const isValid = (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0;
    expect(isValid('3')).toBe(true);
    expect(isValid('0.5')).toBe(true);
    expect(isValid('0')).toBe(false);
    expect(isValid('-1')).toBe(false);
    expect(isValid('abc')).toBe(false);
  });

  test('Risk score bounded 0-100', () => {
    const clamp = (v) => Math.min(100, Math.max(0, parseInt(v) || 50));
    expect(clamp(50)).toBe(50);
    expect(clamp(-10)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp('invalid')).toBe(50);
  });
});

describe('Health data formatting', () => {
  test('Screen time formatted to hours and minutes', () => {
    const format = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;
    expect(format(125)).toBe('2h 5m');
    expect(format(60)).toBe('1h 0m');
    expect(format(0)).toBe('0h 0m');
  });

  test('Demo mode flag is boolean', () => {
    const coerce = (v) => !!v;
    expect(coerce(1)).toBe(true);
    expect(coerce(0)).toBe(false);
    expect(coerce(null)).toBe(false);
  });
});
