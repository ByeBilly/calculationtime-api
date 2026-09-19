import { readFile } from 'node:fs/promises';

let taglinesPromise;

export async function dailyTagline(inputDate = new Date()) {
  const date = utcDateString(inputDate);
  const taglines = await loadTaglines();
  const index = seededIndex(date, taglines.length);
  const selected = taglines[index];

  return {
    date,
    tagline: selected.tagline,
    category: selected.category
  };
}

export function seededIndex(seed, size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('size must be a positive integer');
  }

  return fnv1a32(seed) % size;
}

export function utcDateString(inputDate = new Date()) {
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error('inputDate must be a valid Date or date string');
  }

  return date.toISOString().slice(0, 10);
}

export function secondsUntilNextUtcMidnight(inputDate = new Date()) {
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error('inputDate must be a valid Date or date string');
  }

  const nextMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(1, Math.ceil((nextMidnight - date.getTime()) / 1000));
}

export async function loadTaglines() {
  if (!taglinesPromise) {
    taglinesPromise = readFile(new URL('./data/dailyTaglines.json', import.meta.url), 'utf8')
      .then((raw) => JSON.parse(raw))
      .then(validateTaglines);
  }

  return taglinesPromise;
}

function validateTaglines(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('dailyTaglines.json must contain at least one tagline');
  }

  for (const [index, item] of value.entries()) {
    if (!item || typeof item.tagline !== 'string' || typeof item.category !== 'string') {
      throw new Error(`dailyTaglines.json item ${index} must include category and tagline strings`);
    }
  }

  return value;
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
