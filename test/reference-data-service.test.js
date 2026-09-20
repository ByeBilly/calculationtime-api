import test from 'node:test';
import assert from 'node:assert/strict';
import {
  brightStarsReference,
  constantsReference,
  constellationsReference,
  countriesReference,
  elementsReference,
  httpStatusReference,
  meteorShowersReference,
  mimeTypesReference,
  timezonesReference,
  unicodeBlocksReference
} from '../src/reference-data-service.js';

test('returns country and timezone reference data with filters', () => {
  const countries = countriesReference({ q: 'australia' });
  const australia = countries.data.find((country) => country.iso_alpha2 === 'AU');
  assert.ok(australia);
  assert.equal(australia.currencies[0].code, 'AUD');

  const zones = timezonesReference({ q: 'Australia/Sydney', at: '2026-09-21T00:00:00Z' });
  assert.equal(zones.count, 1);
  assert.equal(zones.data[0].time_zone, 'Australia/Sydney');
  assert.match(zones.data[0].current_utc_offset, /^UTC[+-]\d{2}:\d{2}$/);
});

test('returns developer and science reference tables', () => {
  assert.equal(elementsReference({ q: 'oxygen' }).data[0].symbol, 'O');
  assert.equal(constantsReference({ q: 'planck' }).data[0].symbol, 'h');
  assert.equal(httpStatusReference({ q: '429' }).data[0].phrase, 'Too Many Requests');
  assert.ok(mimeTypesReference({ extension: 'json' }).data.some((row) => row.mime_type === 'application/json'));
  assert.equal(unicodeBlocksReference({ q: 'currency' }).data[0].name, 'Currency Symbols');
});

test('returns astronomy reference tables', () => {
  assert.equal(constellationsReference({ q: 'crux' }).data[0].abbreviation, 'Cru');
  assert.equal(brightStarsReference({ q: 'sirius' }).data[0].constellation, 'Canis Major');
  assert.equal(meteorShowersReference({ q: 'perseids' }).data[0].radiant_constellation, 'Perseus');
});
