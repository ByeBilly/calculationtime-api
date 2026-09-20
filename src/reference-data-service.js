import { STATUS_CODES } from 'node:http';
import countries from 'world-countries';
import mimeDb from 'mime-db';
import periodicTable from 'periodic-table';

const DATASET_VERSION = '2026-09-21';

const CONSTANTS = [
  { key: 'speed_of_light', symbol: 'c', value: 299792458, unit: 'm/s', category: 'physical', note: 'exact SI definition' },
  { key: 'gravitational_constant', symbol: 'G', value: 6.67430e-11, unit: 'm^3 kg^-1 s^-2', category: 'physical', note: 'CODATA conventional reference value' },
  { key: 'planck_constant', symbol: 'h', value: 6.62607015e-34, unit: 'J Hz^-1', category: 'physical', note: 'exact SI definition' },
  { key: 'elementary_charge', symbol: 'e', value: 1.602176634e-19, unit: 'C', category: 'physical', note: 'exact SI definition' },
  { key: 'boltzmann_constant', symbol: 'k', value: 1.380649e-23, unit: 'J/K', category: 'physical', note: 'exact SI definition' },
  { key: 'avogadro_constant', symbol: 'N_A', value: 6.02214076e23, unit: 'mol^-1', category: 'physical', note: 'exact SI definition' },
  { key: 'standard_gravity', symbol: 'g0', value: 9.80665, unit: 'm/s^2', category: 'physical', note: 'standard conventional value' },
  { key: 'pi', symbol: 'π', value: Math.PI, unit: 'dimensionless', category: 'mathematical', note: 'JavaScript double precision' },
  { key: 'euler_number', symbol: 'e', value: Math.E, unit: 'dimensionless', category: 'mathematical', note: 'JavaScript double precision' },
  { key: 'golden_ratio', symbol: 'φ', value: (1 + Math.sqrt(5)) / 2, unit: 'dimensionless', category: 'mathematical', note: 'computed from sqrt(5)' }
];

const MATERIAL_DENSITIES = [
  ['steel_mild', 'Mild steel', 'metal', 7850, 'kg/m3', 'typical engineering value'],
  ['steel_stainless', 'Stainless steel', 'metal', 8000, 'kg/m3', 'typical alloy range center'],
  ['aluminium', 'Aluminium', 'metal', 2700, 'kg/m3', 'typical pure aluminium value'],
  ['copper', 'Copper', 'metal', 8960, 'kg/m3', 'typical room-temperature value'],
  ['brass', 'Brass', 'metal', 8500, 'kg/m3', 'typical alloy value'],
  ['bronze', 'Bronze', 'metal', 8800, 'kg/m3', 'typical alloy value'],
  ['lead', 'Lead', 'metal', 11340, 'kg/m3', 'typical room-temperature value'],
  ['zinc', 'Zinc', 'metal', 7140, 'kg/m3', 'typical room-temperature value'],
  ['titanium', 'Titanium', 'metal', 4500, 'kg/m3', 'typical room-temperature value'],
  ['gold', 'Gold', 'metal', 19300, 'kg/m3', 'typical room-temperature value'],
  ['silver', 'Silver', 'metal', 10490, 'kg/m3', 'typical room-temperature value'],
  ['concrete_normal', 'Concrete, normal weight', 'masonry', 2400, 'kg/m3', 'typical construction value'],
  ['brick_common', 'Common brick', 'masonry', 1700, 'kg/m3', 'typical construction value'],
  ['limestone', 'Limestone', 'stone', 2180, 'kg/m3', 'typical building stone value'],
  ['marble', 'Marble', 'stone', 2500, 'kg/m3', 'typical building stone value'],
  ['granite', 'Granite', 'stone', 2700, 'kg/m3', 'typical building stone value'],
  ['glass_soda_lime', 'Soda-lime glass', 'glass', 2500, 'kg/m3', 'typical glass value'],
  ['water_fresh', 'Fresh water', 'liquid', 1000, 'kg/m3', 'near 4 C maximum density rounded'],
  ['seawater', 'Seawater', 'liquid', 1030, 'kg/m3', 'typical salinity rounded'],
  ['cooking_oil', 'Cooking oil', 'liquid', 920, 'kg/m3', 'typical range center'],
  ['mercury', 'Mercury', 'liquid_metal', 13595, 'kg/m3', 'near room-temperature value'],
  ['oak', 'Oak', 'wood', 710, 'kg/m3', 'approximate seasoned wood value'],
  ['pine', 'Pine', 'wood', 500, 'kg/m3', 'approximate seasoned wood value'],
  ['timber_general', 'Timber, general', 'wood', 600, 'kg/m3', 'planning value; species and moisture vary'],
  ['plywood', 'Plywood', 'wood', 600, 'kg/m3', 'typical sheet material value'],
  ['cork', 'Cork', 'wood', 240, 'kg/m3', 'approximate value'],
  ['abs_plastic', 'ABS plastic', 'plastic', 1050, 'kg/m3', 'typical polymer value'],
  ['polycarbonate', 'Polycarbonate', 'plastic', 1200, 'kg/m3', 'typical polymer value'],
  ['acrylic', 'Acrylic PMMA', 'plastic', 1180, 'kg/m3', 'typical polymer value'],
  ['expanded_polystyrene', 'Expanded polystyrene insulation', 'insulation', 25, 'kg/m3', 'typical low-density range center'],
  ['glass_wool', 'Glass wool insulation', 'insulation', 12, 'kg/m3', 'typical low-density value'],
  ['rockwool', 'Rock wool slab', 'insulation', 24, 'kg/m3', 'typical slab value'],
  ['air_sea_level', 'Air at sea level', 'gas', 1.225, 'kg/m3', 'dry air near 15 C at 1 atm']
].map(([key, name, category, density, unit, note]) => ({
  key,
  name,
  category,
  density,
  unit,
  note
}));

const UNICODE_BLOCKS = [
  ['Basic Latin', '0000', '007F', 'Latin, controls, ASCII punctuation'],
  ['Latin-1 Supplement', '0080', '00FF', 'Western European Latin extensions'],
  ['Latin Extended-A', '0100', '017F', 'European Latin extensions'],
  ['Greek and Coptic', '0370', '03FF', 'Greek letters and Coptic characters'],
  ['Cyrillic', '0400', '04FF', 'Cyrillic scripts'],
  ['Hebrew', '0590', '05FF', 'Hebrew script'],
  ['Arabic', '0600', '06FF', 'Arabic script'],
  ['Devanagari', '0900', '097F', 'Devanagari script'],
  ['Thai', '0E00', '0E7F', 'Thai script'],
  ['Hiragana', '3040', '309F', 'Japanese Hiragana'],
  ['Katakana', '30A0', '30FF', 'Japanese Katakana'],
  ['CJK Unified Ideographs', '4E00', '9FFF', 'Han ideographs'],
  ['Hangul Syllables', 'AC00', 'D7AF', 'Korean Hangul syllables'],
  ['General Punctuation', '2000', '206F', 'Common punctuation'],
  ['Currency Symbols', '20A0', '20CF', 'Currency signs'],
  ['Letterlike Symbols', '2100', '214F', 'Letterlike mathematical symbols'],
  ['Number Forms', '2150', '218F', 'Fractions and numerals'],
  ['Arrows', '2190', '21FF', 'Arrow symbols'],
  ['Mathematical Operators', '2200', '22FF', 'Math operators'],
  ['Miscellaneous Symbols', '2600', '26FF', 'Weather, zodiac, and common symbols'],
  ['Dingbats', '2700', '27BF', 'Decorative symbols'],
  ['Emoticons', '1F600', '1F64F', 'Emoji faces and people'],
  ['Supplemental Symbols and Pictographs', '1F900', '1F9FF', 'Emoji symbols']
].map(([name, start, end, description]) => ({
  name,
  start: `U+${start}`,
  end: `U+${end}`,
  start_codepoint: parseInt(start, 16),
  end_codepoint: parseInt(end, 16),
  description
}));

const CONSTELLATIONS = [
  ['Andromeda', 'Andromedae', 'And', 'NQ1'], ['Antlia', 'Antliae', 'Ant', 'SQ2'], ['Apus', 'Apodis', 'Aps', 'SQ3'],
  ['Aquarius', 'Aquarii', 'Aqr', 'SQ4'], ['Aquila', 'Aquilae', 'Aql', 'NQ4'], ['Ara', 'Arae', 'Ara', 'SQ3'],
  ['Aries', 'Arietis', 'Ari', 'NQ1'], ['Auriga', 'Aurigae', 'Aur', 'NQ2'], ['Boötes', 'Boötis', 'Boo', 'NQ3'],
  ['Caelum', 'Caeli', 'Cae', 'SQ1'], ['Camelopardalis', 'Camelopardalis', 'Cam', 'NQ2'], ['Cancer', 'Cancri', 'Cnc', 'NQ2'],
  ['Canes Venatici', 'Canum Venaticorum', 'CVn', 'NQ3'], ['Canis Major', 'Canis Majoris', 'CMa', 'SQ2'], ['Canis Minor', 'Canis Minoris', 'CMi', 'NQ2'],
  ['Capricornus', 'Capricorni', 'Cap', 'SQ4'], ['Carina', 'Carinae', 'Car', 'SQ2'], ['Cassiopeia', 'Cassiopeiae', 'Cas', 'NQ1'],
  ['Centaurus', 'Centauri', 'Cen', 'SQ3'], ['Cepheus', 'Cephei', 'Cep', 'NQ4'], ['Cetus', 'Ceti', 'Cet', 'SQ1'],
  ['Chamaeleon', 'Chamaeleontis', 'Cha', 'SQ2'], ['Circinus', 'Circini', 'Cir', 'SQ3'], ['Columba', 'Columbae', 'Col', 'SQ1'],
  ['Coma Berenices', 'Comae Berenices', 'Com', 'NQ3'], ['Corona Australis', 'Coronae Australis', 'CrA', 'SQ4'], ['Corona Borealis', 'Coronae Borealis', 'CrB', 'NQ3'],
  ['Corvus', 'Corvi', 'Crv', 'SQ3'], ['Crater', 'Crateris', 'Crt', 'SQ2'], ['Crux', 'Crucis', 'Cru', 'SQ3'],
  ['Cygnus', 'Cygni', 'Cyg', 'NQ4'], ['Delphinus', 'Delphini', 'Del', 'NQ4'], ['Dorado', 'Doradus', 'Dor', 'SQ1'],
  ['Draco', 'Draconis', 'Dra', 'NQ3'], ['Equuleus', 'Equulei', 'Equ', 'NQ4'], ['Eridanus', 'Eridani', 'Eri', 'SQ1'],
  ['Fornax', 'Fornacis', 'For', 'SQ1'], ['Gemini', 'Geminorum', 'Gem', 'NQ2'], ['Grus', 'Gruis', 'Gru', 'SQ4'],
  ['Hercules', 'Herculis', 'Her', 'NQ3'], ['Horologium', 'Horologii', 'Hor', 'SQ1'], ['Hydra', 'Hydrae', 'Hya', 'SQ2'],
  ['Hydrus', 'Hydri', 'Hyi', 'SQ1'], ['Indus', 'Indi', 'Ind', 'SQ4'], ['Lacerta', 'Lacertae', 'Lac', 'NQ4'],
  ['Leo', 'Leonis', 'Leo', 'NQ2'], ['Leo Minor', 'Leonis Minoris', 'LMi', 'NQ2'], ['Lepus', 'Leporis', 'Lep', 'SQ1'],
  ['Libra', 'Librae', 'Lib', 'SQ3'], ['Lupus', 'Lupi', 'Lup', 'SQ3'], ['Lynx', 'Lyncis', 'Lyn', 'NQ2'],
  ['Lyra', 'Lyrae', 'Lyr', 'NQ4'], ['Mensa', 'Mensae', 'Men', 'SQ1'], ['Microscopium', 'Microscopii', 'Mic', 'SQ4'],
  ['Monoceros', 'Monocerotis', 'Mon', 'NQ2'], ['Musca', 'Muscae', 'Mus', 'SQ3'], ['Norma', 'Normae', 'Nor', 'SQ3'],
  ['Octans', 'Octantis', 'Oct', 'SQ4'], ['Ophiuchus', 'Ophiuchi', 'Oph', 'SQ3'], ['Orion', 'Orionis', 'Ori', 'NQ1'],
  ['Pavo', 'Pavonis', 'Pav', 'SQ4'], ['Pegasus', 'Pegasi', 'Peg', 'NQ4'], ['Perseus', 'Persei', 'Per', 'NQ1'],
  ['Phoenix', 'Phoenicis', 'Phe', 'SQ1'], ['Pictor', 'Pictoris', 'Pic', 'SQ1'], ['Pisces', 'Piscium', 'Psc', 'NQ1'],
  ['Piscis Austrinus', 'Piscis Austrini', 'PsA', 'SQ4'], ['Puppis', 'Puppis', 'Pup', 'SQ2'], ['Pyxis', 'Pyxidis', 'Pyx', 'SQ2'],
  ['Reticulum', 'Reticuli', 'Ret', 'SQ1'], ['Sagitta', 'Sagittae', 'Sge', 'NQ4'], ['Sagittarius', 'Sagittarii', 'Sgr', 'SQ4'],
  ['Scorpius', 'Scorpii', 'Sco', 'SQ3'], ['Sculptor', 'Sculptoris', 'Scl', 'SQ1'], ['Scutum', 'Scuti', 'Sct', 'SQ4'],
  ['Serpens', 'Serpentis', 'Ser', 'NQ3'], ['Sextans', 'Sextantis', 'Sex', 'SQ2'], ['Taurus', 'Tauri', 'Tau', 'NQ1'],
  ['Telescopium', 'Telescopii', 'Tel', 'SQ4'], ['Triangulum', 'Trianguli', 'Tri', 'NQ1'], ['Triangulum Australe', 'Trianguli Australis', 'TrA', 'SQ3'],
  ['Tucana', 'Tucanae', 'Tuc', 'SQ4'], ['Ursa Major', 'Ursae Majoris', 'UMa', 'NQ2'], ['Ursa Minor', 'Ursae Minoris', 'UMi', 'NQ3'],
  ['Vela', 'Velorum', 'Vel', 'SQ2'], ['Virgo', 'Virginis', 'Vir', 'SQ3'], ['Volans', 'Volantis', 'Vol', 'SQ2'], ['Vulpecula', 'Vulpeculae', 'Vul', 'NQ4']
].map(([name, genitive, abbreviation, quadrant]) => ({ name, genitive, abbreviation, quadrant }));

const BRIGHT_STARS = [
  ['Sirius', 'Alpha Canis Majoris', 6.7525, -16.7161, -1.46, 'A1V', 'Canis Major'],
  ['Canopus', 'Alpha Carinae', 6.3992, -52.6957, -0.74, 'A9II', 'Carina'],
  ['Alpha Centauri', 'Alpha Centauri', 14.6601, -60.8339, -0.27, 'G2V/K1V', 'Centaurus'],
  ['Arcturus', 'Alpha Boötis', 14.2610, 19.1824, -0.05, 'K1.5III', 'Boötes'],
  ['Vega', 'Alpha Lyrae', 18.6156, 38.7837, 0.03, 'A0V', 'Lyra'],
  ['Capella', 'Alpha Aurigae', 5.2782, 45.9980, 0.08, 'G8III', 'Auriga'],
  ['Rigel', 'Beta Orionis', 5.2423, -8.2016, 0.13, 'B8Ia', 'Orion'],
  ['Procyon', 'Alpha Canis Minoris', 7.6550, 5.2250, 0.34, 'F5IV-V', 'Canis Minor'],
  ['Achernar', 'Alpha Eridani', 1.6286, -57.2368, 0.46, 'B6Vep', 'Eridanus'],
  ['Betelgeuse', 'Alpha Orionis', 5.9195, 7.4071, 0.5, 'M1-M2Ia', 'Orion'],
  ['Hadar', 'Beta Centauri', 14.0637, -60.3730, 0.61, 'B1III', 'Centaurus'],
  ['Altair', 'Alpha Aquilae', 19.8464, 8.8683, 0.77, 'A7V', 'Aquila'],
  ['Acrux', 'Alpha Crucis', 12.4433, -63.0991, 0.76, 'B0.5IV', 'Crux'],
  ['Aldebaran', 'Alpha Tauri', 4.5987, 16.5093, 0.86, 'K5III', 'Taurus'],
  ['Spica', 'Alpha Virginis', 13.4199, -11.1613, 0.97, 'B1III-IV', 'Virgo'],
  ['Antares', 'Alpha Scorpii', 16.4901, -26.4320, 1.06, 'M1.5Iab', 'Scorpius'],
  ['Pollux', 'Beta Geminorum', 7.7553, 28.0262, 1.14, 'K0III', 'Gemini'],
  ['Fomalhaut', 'Alpha Piscis Austrini', 22.9608, -29.6222, 1.16, 'A3V', 'Piscis Austrinus'],
  ['Deneb', 'Alpha Cygni', 20.6905, 45.2803, 1.25, 'A2Ia', 'Cygnus'],
  ['Mimosa', 'Beta Crucis', 12.7953, -59.6888, 1.25, 'B0.5III', 'Crux']
].map(([name, designation, rightAscensionHours, declinationDegrees, apparentMagnitude, spectralType, constellation]) => ({
  name,
  designation,
  right_ascension_hours: rightAscensionHours,
  declination_degrees: declinationDegrees,
  apparent_magnitude: apparentMagnitude,
  spectral_type: spectralType,
  constellation
}));

const METEOR_SHOWERS = [
  ['Quadrantids', 'Jan 3-4', 'Dec 28-Feb 12', 120, 'Bootes'],
  ['Lyrids', 'Apr 21-22', 'Apr 14-30', 18, 'Lyra'],
  ['Eta Aquariids', 'May 5-6', 'Apr 19-May 28', 50, 'Aquarius'],
  ['Southern Delta Aquariids', 'Jul 29-30', 'Jul 12-Aug 23', 25, 'Aquarius'],
  ['Perseids', 'Aug 12-13', 'Jul 17-Aug 24', 100, 'Perseus'],
  ['Draconids', 'Oct 8-9', 'Oct 6-10', 10, 'Draco'],
  ['Orionids', 'Oct 21-22', 'Sep 26-Nov 22', 20, 'Orion'],
  ['Leonids', 'Nov 17-18', 'Nov 6-30', 15, 'Leo'],
  ['Geminids', 'Dec 13-14', 'Dec 4-20', 120, 'Gemini'],
  ['Ursids', 'Dec 21-22', 'Dec 17-26', 10, 'Ursa Minor']
].map(([name, peak_dates, active_window, zenithal_hourly_rate, radiant_constellation]) => ({
  name,
  peak_dates,
  active_window,
  zenithal_hourly_rate,
  radiant_constellation
}));

export function countriesReference(query = {}) {
  const data = countries.map((country) => ({
    name: country.name.common,
    official_name: country.name.official,
    capital: country.capital || [],
    iso_alpha2: country.cca2,
    iso_alpha3: country.cca3,
    numeric_code: country.ccn3 || null,
    dialing_code: country.idd?.root ? `${country.idd.root}${country.idd.suffixes?.[0] || ''}` : null,
    currencies: Object.entries(country.currencies || {}).map(([code, value]) => ({ code, name: value.name, symbol: value.symbol || null })),
    region: country.region,
    subregion: country.subregion || null,
    languages: Object.values(country.languages || {}),
    flag: country.flag,
    latlng: country.latlng,
    timezones: country.timezones || []
  }));
  return listResponse(filterList(data, query, ['name', 'official_name', 'iso_alpha2', 'iso_alpha3', 'region', 'subregion']), 'world_countries_package');
}

export function timezonesReference(query = {}) {
  const at = validDate(query.at || new Date().toISOString(), 'at');
  const zones = Intl.supportedValuesOf('timeZone').map((timeZone) => {
    const offset = timezoneOffset(timeZone, at);
    return {
      time_zone: timeZone,
      current_utc_offset: offset.label,
      offset_minutes: offset.minutes,
      observes_dst_now: observesDst(timeZone, at.getUTCFullYear())
    };
  });
  return listResponse(filterList(zones, query, ['time_zone', 'current_utc_offset']), 'node_icu_iana_tzdb', { at: at.toISOString() });
}

export function elementsReference(query = {}) {
  const elements = periodicTable.all().map((element) => ({
    atomic_number: element.atomicNumber,
    symbol: element.symbol,
    name: element.name,
    atomic_mass: element.atomicMass,
    electron_configuration: element.electronicConfiguration,
    electronegativity: element.electronegativity || null,
    standard_state: element.standardState || null,
    group_block: element.groupBlock || null,
    density: element.density || null,
    melting_point_kelvin: element.meltingPoint || null,
    boiling_point_kelvin: element.boilingPoint || null,
    year_discovered: element.yearDiscovered || null
  }));
  return listResponse(filterList(elements, query, ['name', 'symbol', 'group_block', 'standard_state']), 'periodic_table_package');
}

export function constantsReference(query = {}) {
  return listResponse(filterList(CONSTANTS, query, ['key', 'symbol', 'category', 'note']), 'curated_codified_constants');
}

export function materialDensitiesReference(query = {}) {
  return listResponse(filterList(MATERIAL_DENSITIES, query, ['key', 'name', 'category', 'note']), 'curated_engineering_density_reference');
}

export function httpStatusReference(query = {}) {
  const statuses = Object.entries(STATUS_CODES).map(([code, phrase]) => ({
    code: Number(code),
    phrase,
    class: `${code[0]}xx`,
    category: statusCategory(Number(code))
  }));
  return listResponse(filterList(statuses, query, ['code', 'phrase', 'class', 'category']), 'node_http_status_codes');
}

export function mimeTypesReference(query = {}) {
  const extension = typeof query.extension === 'string' ? query.extension.replace(/^\./, '').toLowerCase() : null;
  const type = typeof query.type === 'string' ? query.type.toLowerCase() : null;
  const rows = Object.entries(mimeDb).flatMap(([mime_type, record]) => {
    const extensions = record.extensions || [];
    if (extension && !extensions.includes(extension)) return [];
    if (type && mime_type !== type) return [];
    return [{
      mime_type,
      source: record.source || null,
      charset: record.charset || null,
      compressible: record.compressible ?? null,
      extensions
    }];
  });
  return listResponse(filterList(rows, query, ['mime_type', 'source', 'charset', 'extensions']), 'mime_db_package');
}

export function unicodeBlocksReference(query = {}) {
  return listResponse(filterList(UNICODE_BLOCKS, query, ['name', 'start', 'end', 'description']), 'curated_unicode_block_reference');
}

export function constellationsReference(query = {}) {
  return listResponse(filterList(CONSTELLATIONS, query, ['name', 'genitive', 'abbreviation', 'quadrant']), 'iau_88_constellation_reference');
}

export function brightStarsReference(query = {}) {
  return listResponse(filterList(BRIGHT_STARS, query, ['name', 'designation', 'spectral_type', 'constellation']), 'curated_bright_star_reference');
}

export function meteorShowersReference(query = {}) {
  return listResponse(filterList(METEOR_SHOWERS, query, ['name', 'peak_dates', 'active_window', 'radiant_constellation']), 'curated_major_meteor_shower_reference');
}

function listResponse(data, source, extra = {}) {
  return {
    dataset_version: DATASET_VERSION,
    source,
    count: data.length,
    ...extra,
    data
  };
}

function filterList(items, query, fields) {
  let result = items;
  const q = typeof query.q === 'string' ? query.q.trim().toLowerCase() : '';
  if (q) {
    result = result.filter((item) => fields.some((field) => String(item[field] ?? '').toLowerCase().includes(q)));
  }
  const limit = query.limit === undefined ? null : integer(query.limit, 'limit', 1, 5000);
  return limit === null ? result : result.slice(0, limit);
}

function timezoneOffset(timeZone, date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const value = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT';
  const match = value.match(/^GMT(?:(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/);
  if (!match) return { label: value, minutes: 0 };
  const sign = match.groups.sign === '-' ? -1 : 1;
  const hours = Number(match.groups.hours || 0);
  const minutes = Number(match.groups.minutes || 0);
  const total = sign * (hours * 60 + minutes);
  const label = formatOffset(total);
  return { label, minutes: total };
}

function observesDst(timeZone, year) {
  const jan = timezoneOffset(timeZone, new Date(Date.UTC(year, 0, 1))).minutes;
  const jul = timezoneOffset(timeZone, new Date(Date.UTC(year, 6, 1))).minutes;
  return jan !== jul;
}

function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function statusCategory(code) {
  if (code < 200) return 'informational';
  if (code < 300) return 'success';
  if (code < 400) return 'redirection';
  if (code < 500) return 'client_error';
  return 'server_error';
}

function validDate(value, name) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${name} must be a valid timestamp`, 'invalid_date');
  return date;
}

function integer(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw badRequest(`${name} must be an integer between ${min} and ${max}`, 'invalid_integer');
  }
  return parsed;
}

function badRequest(message, code) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code
  });
}
