// Unit tests for the pure workspace helpers. Node 24 runs the .ts file directly.
//   npm run test:unit
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DIVISION_CODE,
  brandThemeCss,
  divisionColor,
  hexToHsl,
  newDivisionId,
  nextOrganizationId,
  nextProjectNumber,
} from '../../src/lib/workspace.ts';

describe('nextProjectNumber', () => {
  it('starts each division series at 001', () => {
    assert.equal(nextProjectNumber([], 'BLD'), 'PRJ-BLD-001');
  });

  it('continues from the highest number in the same series', () => {
    const existing = ['PRJ-BLD-001', 'PRJ-BLD-004', 'PRJ-ENG-009', undefined];
    assert.equal(nextProjectNumber(existing, 'BLD'), 'PRJ-BLD-005');
    assert.equal(nextProjectNumber(existing, 'ENG'), 'PRJ-ENG-010');
  });

  it('uses PRJ-NNN when there is no division', () => {
    assert.equal(nextProjectNumber(['PRJ-BLD-007'], undefined), 'PRJ-001');
    assert.equal(nextProjectNumber(['PRJ-001', 'PRJ-012'], ''), 'PRJ-013');
  });

  it('keeps legacy series valid (migrated GPT / SDE codes)', () => {
    assert.equal(nextProjectNumber(['PRJ-GPT-041'], 'GPT'), 'PRJ-GPT-042');
  });

  it('grows past 999 without truncating', () => {
    assert.equal(nextProjectNumber(['PRJ-999'], undefined), 'PRJ-1000');
  });
});

describe('nextOrganizationId', () => {
  it('uses up to three initials of the client name', () => {
    assert.equal(nextOrganizationId('Acme Facilities LLC', []), 'ORG-AFL-001');
    assert.equal(nextOrganizationId('noor', []), 'ORG-N-001');
  });

  it('counts past the highest existing id with the same initials', () => {
    assert.equal(nextOrganizationId('Acme Facilities LLC', ['ORG-AFL-001', 'ORG-AFL-003', 'ORG-XYZ-009']), 'ORG-AFL-004');
  });

  it('ignores punctuation and extra spaces', () => {
    assert.equal(nextOrganizationId('  Al-Futtaim   & Sons ', []), 'ORG-AS-001');
  });

  it('falls back to CL when the name has no letters', () => {
    assert.equal(nextOrganizationId('123', []), 'ORG-CL-001');
  });
});

describe('hexToHsl', () => {
  it('converts a hex colour to the "H S% L%" form the theme variables use', () => {
    assert.equal(hexToHsl('#16a34a'), '142 76% 36%');
    assert.equal(hexToHsl('#2563EB'), '221 83% 53%');
    assert.equal(hexToHsl('#000000'), '0 0% 0%');
    assert.equal(hexToHsl('#fff'), '0 0% 100%');
  });

  it('returns null for anything that is not a hex colour', () => {
    assert.equal(hexToHsl(''), null);
    assert.equal(hexToHsl('green'), null);
    assert.equal(hexToHsl('#12345'), null);
    assert.equal(hexToHsl(undefined), null);
  });
});

describe('brandThemeCss', () => {
  it('re-hues the light and dark themes to the brand colour', () => {
    const css = brandThemeCss('#2563eb');
    assert.match(css, /:root\s*\{[^}]*--primary: 221 83% 50%;/);
    assert.match(css, /:root\s*\{[^}]*--border: 221 20% 90%;/);
    assert.match(css, /\.dark\s*\{[^}]*--background: 221 30% 8%;/);
    assert.match(css, /\.dark\s*\{[^}]*--primary: 221 83% 53%;/); // already in the readable 45–60% range
  });

  it('keeps buttons readable by clamping very light or dark brand colours', () => {
    assert.match(brandThemeCss('#fde047'), /:root\s*\{[^}]*--primary: 50 98% 50%;/);
    assert.match(brandThemeCss('#0b1d3a'), /:root\s*\{[^}]*--primary: 217 68% 25%;/);
    assert.match(brandThemeCss('#0b1d3a'), /\.dark\s*\{[^}]*--primary: 217 68% 45%;/);
  });

  it('never touches the semantic success colour', () => {
    assert.doesNotMatch(brandThemeCss('#2563eb'), /--success/);
  });

  it('returns empty CSS for an invalid colour (keeps the default theme)', () => {
    assert.equal(brandThemeCss('nope'), '');
    assert.equal(brandThemeCss(undefined), '');
  });
});

describe('divisions', () => {
  it('codes are 2-4 uppercase letters', () => {
    assert.ok(DIVISION_CODE.test('BLD'));
    assert.ok(DIVISION_CODE.test('GPT'));
    assert.ok(!DIVISION_CODE.test('b'));
    assert.ok(!DIVISION_CODE.test('ABCDE'));
    assert.ok(!DIVISION_CODE.test('A1'));
  });

  it('colours cycle through a fixed palette', () => {
    assert.equal(typeof divisionColor(0), 'string');
    assert.notEqual(divisionColor(0), divisionColor(1));
    assert.equal(divisionColor(0), divisionColor(100 * 6));
  });

  it('ids are unique', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newDivisionId()));
    assert.equal(ids.size, 50);
  });
});
