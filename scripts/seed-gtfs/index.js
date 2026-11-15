
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { MongoClient } = require('mongodb');
const AdmZip = require('adm-zip');
const { parse } = require('csv-parse/sync');

// ==========================================
// 1. PROJECT CONFIGURATION
// ==========================================

const ROOT = path.resolve(__dirname, '../..');

require('dotenv').config({
  path: path.join(ROOT, '.env')
});

const DB_NAME = process.env.MONGODB_DB_NAME || 'CityRide';
const CITY = process.env.GTFS_CITY || 'Bhilwara';

const BATCH_SIZE = Number(process.env.GTFS_BATCH_SIZE || 500);
const DRY_RUN = process.argv.includes('--dry-run');

const ZIP_PATH = path.resolve(
  ROOT,
  process.env.GTFS_ZIP_PATH ||
    'Data/gtfs/source/Bhilwara_GTFS_Demo_V1.zip'
);

const REPORT_DIR = path.join(
  ROOT,
  'Data',
  'gtfs',
  'validation-reports'
);

// ==========================================
// 2. GTFS FILES AND COLLECTIONS
// ==========================================

const REQUIRED_FILES = [
  'agency.txt',
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt'
];

const OPTIONAL_FILES = [
  'calendar.txt',
  'calendar_dates.txt',
  'shapes.txt',
  'fare_attributes.txt',
  'fare_rules.txt',
  'feed_info.txt'
];

const COLLECTIONS = [
  'agencies',
  'stops',
  'routes',
  'trips',
  'stopTimes',
  'serviceCalendars',
  'serviceExceptions',
  'shapes',
  'fareAttributes',
  'fareRules',
  'gtfsFeeds',
  'gtfsFeedState'
];

// Import report

const report = {
  started_at: new Date().toISOString(),
  status: 'started',
  city: CITY,
  database: DB_NAME,
  source_zip: path.relative(ROOT, ZIP_PATH),
  source_sha256: null,
  feed_version: null,
  source_counts: {},
  database_counts: {},
  warnings: [],
  errors: []
};

let client;
let feedVersion;

// ==========================================
// 3. COMMON HELPER FUNCTIONS
// ==========================================

function clean(value) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();

  return text === '' ? null : text;
}

function required(value, field, row) {
  const result = clean(value);

  if (result === null) {
    throw new Error(
      `${field} is required (row ${row}).`
    );
  }

  return result;
}

function num(value, field, row, options = {}) {
  const {
    optional = false,
    integer = false,
    fallback = null
  } = options;

  const text = clean(value);

  if (text === null) {
    if (optional) return fallback;

    throw new Error(`${field} is required (row ${row}).`);
  }

  const result = Number(text);

  if (
    !Number.isFinite(result) ||
    (integer && !Number.isInteger(result))
  ) {
    throw new Error(
      `${field} must be a valid number (row ${row}).`
    );
  }

  return result;
}

// Convert GTFS YYYYMMDD dates

function gtfsDate(value, field, row) {
  const text = required(value, field, row);

  if (!/^\d{8}$/.test(text)) {
    throw new Error(`${field} must be YYYYMMDD (row ${row}).`);
  }

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6));
  const day = Number(text.slice(6, 8));

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${field} is not a valid date (row ${row}).`);
  }

  return text;
}

// Convert GTFS HH:MM:SS into seconds from service-day start.
// Supports values beyond 24:00:00.

function gtfsTime(value, field, row) {
  const text = clean(value);

  if (text === null) {
    return { text: null, seconds: null };
  }

  const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(text);

  if (!match) {
    throw new Error(`${field} must be HH:MM:SS (row ${row}).`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  return {
    text,
    seconds: hours * 3600 + minutes * 60 + seconds
  };
}

// ==========================================
// 4. CSV PARSING
// ==========================================

function readCsv(zip, name, isRequired = false) {
  const entry = zip.getEntry(name);

  if (!entry) {
    if (isRequired) {
      throw new Error(`ZIP is missing required file: ${name}`);
    }

    return null;
  }

  let headers = [];

  const rows = parse(
    entry.getData().toString('utf8'),
    {
      bom: true,

      columns: (header) => {
        headers = header.map((item) => String(item).trim());
        return headers;
      },

      trim: true,
      skip_empty_lines: true,
      relax_column_count: false
    }
  );

  if (!headers.length) {
    throw new Error(`${name} has no header row.`);
  }

  return { headers, rows };
}

function checkHeaders(name, file, requiredHeaders) {
  if (!file) return;

  const missing = requiredHeaders.filter(
    (header) => !file.headers.includes(header)
  );

  if (missing.length) {
    throw new Error(
      `${name} is missing columns: ${missing.join(', ')}`
    );
  }
}

function rows(files, name) {
  return files[name] ? files[name].rows : [];
}

function unique(items, keyFn, label) {
  const seen = new Set();

  for (const item of items) {
    const key = keyFn(item);

    if (seen.has(key)) {
      throw new Error(`Duplicate ${label}: ${key}`);
    }

    seen.add(key);
  }
}

// ==========================================
// 5. TRANSFORM GTFS FILES INTO DOCUMENTS
// ==========================================

function transform(files, version) {

  // AGENCY

  const agencyRows = rows(files, 'agency.txt');

  if (!agencyRows.length) {
    throw new Error('agency.txt contains no records.');
  }

  const agencies = agencyRows.map((r, i) => {
    const n = i + 1;
    const agencyId = clean(r.agency_id);

    return {
      feed_version: version,

      // GTFS permits agency_id to be omitted for a
      // single-agency feed. This key keeps it unique.

      agency_key: agencyId || '__SINGLE_AGENCY__',
      agency_id: agencyId,

      agency_name: required(r.agency_name, 'agency_name', n),
      agency_url: required(r.agency_url, 'agency_url', n),
      agency_timezone: required(r.agency_timezone, 'agency_timezone', n),

      agency_lang: clean(r.agency_lang),
      agency_phone: clean(r.agency_phone),
      agency_fare_url: clean(r.agency_fare_url),
      agency_email: clean(r.agency_email)
    };
  });

  // STOPS

  const stops = rows(files, 'stops.txt').map((r, i) => {
    const n = i + 1;

    const lat = num(r.stop_lat, 'stop_lat', n);
    const lon = num(r.stop_lon, 'stop_lon', n);

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(`Invalid stop coordinates (row ${n}).`);
    }

    return {
      feed_version: version,

      stop_id: required(r.stop_id, 'stop_id', n),
      stop_code: clean(r.stop_code),
      stop_name: required(r.stop_name, 'stop_name', n),
      stop_desc: clean(r.stop_desc),

      stop_lat: lat,
      stop_lon: lon,

      // GeoJSON requires [longitude, latitude]

      location: {
        type: 'Point',
        coordinates: [lon, lat]
      },

      zone_id: clean(r.zone_id),

      location_type: num(
        r.location_type,
        'location_type',
        n,
        { optional: true, integer: true, fallback: 0 }
      ),

      parent_station: clean(r.parent_station),
      stop_timezone: clean(r.stop_timezone),

      wheelchair_boarding: num(
        r.wheelchair_boarding,
        'wheelchair_boarding',
        n,
        { optional: true, integer: true, fallback: 0 }
      ),

      platform_code: clean(r.platform_code)
    };
  });

  // ROUTES

  const routes = rows(files, 'routes.txt').map((r, i) => {
    const n = i + 1;

    if (!clean(r.route_short_name) && !clean(r.route_long_name)) {
      throw new Error(
        `Route row ${n} needs a short name or long name.`
      );
    }

    return {
      feed_version: version,

      route_id: required(r.route_id, 'route_id', n),
      agency_id: clean(r.agency_id),

      route_short_name: clean(r.route_short_name),
      route_long_name: clean(r.route_long_name),
      route_desc: clean(r.route_desc),

      route_type: num(
        r.route_type,
        'route_type',
        n,
        { integer: true }
      ),

      route_url: clean(r.route_url),
      route_color: clean(r.route_color),
      route_text_color: clean(r.route_text_color),

      route_sort_order: num(
        r.route_sort_order,
        'route_sort_order',
        n,
        { optional: true, integer: true }
      ),

      continuous_pickup: num(
        r.continuous_pickup,
        'continuous_pickup',
        n,
        { optional: true, integer: true }
      ),

      continuous_drop_off: num(
        r.continuous_drop_off,
        'continuous_drop_off',
        n,
        { optional: true, integer: true }
      )
    };
  });

  // TRIPS

  const trips = rows(files, 'trips.txt').map((r, i) => {
    const n = i + 1;

    return {
      feed_version: version,

      route_id: required(r.route_id, 'route_id', n),
      service_id: required(r.service_id, 'service_id', n),
      trip_id: required(r.trip_id, 'trip_id', n),

      trip_headsign: clean(r.trip_headsign),
      trip_short_name: clean(r.trip_short_name),

      direction_id: num(
        r.direction_id,
        'direction_id',
        n,
        { optional: true, integer: true }
      ),

      block_id: clean(r.block_id),
      shape_id: clean(r.shape_id),

      wheelchair_accessible: num(
        r.wheelchair_accessible,
        'wheelchair_accessible',
        n,
        { optional: true, integer: true, fallback: 0 }
      ),

      bikes_allowed: num(
        r.bikes_allowed,
        'bikes_allowed',
        n,
        { optional: true, integer: true, fallback: 0 }
      )
    };
  });

  // STOP TIMES

  const stopTimes = rows(files, 'stop_times.txt').map((r, i) => {
    const n = i + 1;

    const arrival = gtfsTime(r.arrival_time, 'arrival_time', n);
    const departure = gtfsTime(r.departure_time, 'departure_time', n);

    if (!arrival.text && !departure.text) {
      throw new Error(
        `Both arrival_time and departure_time are empty in row ${n}.`
      );
    }

    return {
      feed_version: version,

      trip_id: required(r.trip_id, 'trip_id', n),

      arrival_time: arrival.text,
      arrival_seconds: arrival.seconds,

      departure_time: departure.text,
      departure_seconds: departure.seconds,

      stop_id: required(r.stop_id, 'stop_id', n),

      stop_sequence: num(
        r.stop_sequence,
        'stop_sequence',
        n,
        { integer: true }
      ),

      stop_headsign: clean(r.stop_headsign),

      pickup_type: num(
        r.pickup_type,
        'pickup_type',
        n,
        { optional: true, integer: true, fallback: 0 }
      ),

      drop_off_type: num(
        r.drop_off_type,
        'drop_off_type',
        n,
        { optional: true, integer: true, fallback: 0 }
      ),

      continuous_pickup: num(
        r.continuous_pickup,
        'continuous_pickup',
        n,
        { optional: true, integer: true }
      ),

      continuous_drop_off: num(
        r.continuous_drop_off,
        'continuous_drop_off',
        n,
        { optional: true, integer: true }
      ),

      shape_dist_traveled: num(
        r.shape_dist_traveled,
        'shape_dist_traveled',
        n,
        { optional: true }
      ),

      timepoint: num(
        r.timepoint,
        'timepoint',
        n,
        { optional: true, integer: true, fallback: 1 }
      )
    };
  });

  // SERVICE CALENDAR

  const serviceCalendars = rows(files, 'calendar.txt').map((r, i) => {
    const n = i + 1;

    const doc = {
      feed_version: version,
      service_id: required(r.service_id, 'service_id', n),

      start_date: gtfsDate(r.start_date, 'start_date', n),
      end_date: gtfsDate(r.end_date, 'end_date', n)
    };

    const days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    ];

    for (const day of days) {
      const flag = num(r[day], day, n, { integer: true });

      if (flag !== 0 && flag !== 1) {
        throw new Error(`${day} must be 0 or 1 (row ${n}).`);
      }

      doc[day] = flag === 1;
    }

    if (doc.start_date > doc.end_date) {
      throw new Error(`calendar.txt row ${n}: invalid date range.`);
    }

    return doc;
  });

  // SERVICE EXCEPTIONS

  const serviceExceptions = rows(files, 'calendar_dates.txt').map((r, i) => {
    const n = i + 1;

    const type = num(
      r.exception_type,
      'exception_type',
      n,
      { integer: true }
    );

    if (![1, 2].includes(type)) {
      throw new Error(`Invalid exception_type in row ${n}.`);
    }

    return {
      feed_version: version,
      service_id: required(r.service_id, 'service_id', n),
      date: gtfsDate(r.date, 'date', n),
      exception_type: type
    };
  });

  if (!serviceCalendars.length && !serviceExceptions.length) {
    throw new Error('No calendar service information was found.');
  }

  // SHAPES
  // Store one document per shape_id with ordered coordinates.

  const shapeGroups = new Map();

  rows(files, 'shapes.txt').forEach((r, i) => {
    const n = i + 1;
    const shapeId = required(r.shape_id, 'shape_id', n);

    const lat = num(r.shape_pt_lat, 'shape_pt_lat', n);
    const lon = num(r.shape_pt_lon, 'shape_pt_lon', n);

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(`Invalid shape coordinates (row ${n}).`);
    }

    if (!shapeGroups.has(shapeId)) {
      shapeGroups.set(shapeId, []);
    }

    shapeGroups.get(shapeId).push({
      sequence: num(
        r.shape_pt_sequence,
        'shape_pt_sequence',
        n,
        { integer: true }
      ),

      latitude: lat,
      longitude: lon,

      distance: num(
        r.shape_dist_traveled,
        'shape_dist_traveled',
        n,
        { optional: true }
      )
    });
  });

  const shapes = [...shapeGroups.entries()].map(([shapeId, points]) => {
    points.sort((a, b) => a.sequence - b.sequence);

    for (let i = 1; i < points.length; i++) {
      if (points[i].sequence <= points[i - 1].sequence) {
        throw new Error(`Shape ${shapeId} has invalid point sequence.`);
      }
    }

    const coordinates = points.map(
      (p) => [p.longitude, p.latitude]
    );

    return {
      feed_version: version,
      shape_id: shapeId,
      points,

      geometry: coordinates.length >= 2
        ? { type: 'LineString', coordinates }
        : null
    };
  });

  // FARE ATTRIBUTES

  const fareAttributes = rows(files, 'fare_attributes.txt').map((r, i) => {
    const n = i + 1;

    const price = num(r.price, 'price', n);
    const currency = required(r.currency_type, 'currency_type', n);

    if (price < 0) throw new Error(`Negative fare at row ${n}.`);

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error(`Invalid currency at row ${n}.`);
    }

    return {
      feed_version: version,

      fare_id: required(r.fare_id, 'fare_id', n),

      price,
      price_minor_units: Math.round(price * 100),

      currency_type: currency,

      payment_method: num(
        r.payment_method,
        'payment_method',
        n,
        { integer: true }
      ),

      transfers: num(
        r.transfers,
        'transfers',
        n,
        { optional: true, integer: true }
      ),

      agency_id: clean(r.agency_id),

      transfer_duration: num(
        r.transfer_duration,
        'transfer_duration',
        n,
        { optional: true, integer: true }
      )
    };
  });

  // FARE RULES

  const fareRules = rows(files, 'fare_rules.txt').map((r, i) => ({
    feed_version: version,

    rule_id: i + 1,

    fare_id: required(r.fare_id, 'fare_id', i + 1),

    route_id: clean(r.route_id),
    origin_id: clean(r.origin_id),
    destination_id: clean(r.destination_id),
    contains_id: clean(r.contains_id)
  }));

  // FEED INFORMATION

  const info = rows(files, 'feed_info.txt')[0] || {};

  const feed = {
    feed_version: version,
    city: CITY,

    source_file: path.basename(ZIP_PATH),
    source_sha256: report.source_sha256,

    feed_info: {
      feed_publisher_name: clean(info.feed_publisher_name),
      feed_publisher_url: clean(info.feed_publisher_url),
      feed_lang: clean(info.feed_lang),
      default_lang: clean(info.default_lang),

      feed_start_date: clean(info.feed_start_date),
      feed_end_date: clean(info.feed_end_date),

      feed_version: clean(info.feed_version) || version,

      feed_contact_email: clean(info.feed_contact_email),
      feed_contact_url: clean(info.feed_contact_url)
    }
  };

  return {
    agencies,
    stops,
    routes,
    trips,
    stopTimes,
    serviceCalendars,
    serviceExceptions,
    shapes,
    fareAttributes,
    fareRules,
    feed
  };
}

// ==========================================
// 6. VALIDATE DOCUMENTS AND RELATIONSHIPS
// ==========================================

function validate(data) {

  unique(data.agencies, (x) => x.agency_key, 'agency');
  unique(data.stops, (x) => x.stop_id, 'stop_id');
  unique(data.routes, (x) => x.route_id, 'route_id');
  unique(data.trips, (x) => x.trip_id, 'trip_id');

  unique(data.serviceCalendars, (x) => x.service_id, 'service_id');
  unique(data.shapes, (x) => x.shape_id, 'shape_id');
  unique(data.fareAttributes, (x) => x.fare_id, 'fare_id');

  unique(
    data.serviceExceptions,
    (x) => `${x.service_id}|${x.date}`,
    'service exception'
  );

  const agencyIds = new Set(
    data.agencies.map((x) => x.agency_id).filter(Boolean)
  );

  const stopIds = new Set(data.stops.map((x) => x.stop_id));
  const routeIds = new Set(data.routes.map((x) => x.route_id));
  const tripIds = new Set(data.trips.map((x) => x.trip_id));

  const serviceIds = new Set([
    ...data.serviceCalendars.map((x) => x.service_id),
    ...data.serviceExceptions.map((x) => x.service_id)
  ]);

  const shapeIds = new Set(data.shapes.map((x) => x.shape_id));
  const fareIds = new Set(data.fareAttributes.map((x) => x.fare_id));

  const zoneIds = new Set(
    data.stops.map((x) => x.zone_id).filter(Boolean)
  );

  // Route -> Agency

  for (const route of data.routes) {
    if (
      route.agency_id &&
      agencyIds.size &&
      !agencyIds.has(route.agency_id)
    ) {
      throw new Error(
        `Route ${route.route_id} references unknown agency ${route.agency_id}.`
      );
    }
  }

  // Stop -> Parent station

  for (const stop of data.stops) {
    if (stop.parent_station && !stopIds.has(stop.parent_station)) {
      throw new Error(
        `Stop ${stop.stop_id} references unknown parent station.`
      );
    }
  }

  // Trip -> Route, Service and Shape

  for (const trip of data.trips) {
    if (!routeIds.has(trip.route_id)) {
      throw new Error(
        `Trip ${trip.trip_id} references unknown route.`
      );
    }

    if (!serviceIds.has(trip.service_id)) {
      throw new Error(
        `Trip ${trip.trip_id} references unknown service.`
      );
    }

    if (
      trip.shape_id &&
      data.shapes.length &&
      !shapeIds.has(trip.shape_id)
    ) {
      throw new Error(
        `Trip ${trip.trip_id} references unknown shape.`
      );
    }
  }

  // Stop Times -> Trips and Stops

  const seenSequences = new Set();
  const byTrip = new Map();

  for (const item of data.stopTimes) {
    if (!tripIds.has(item.trip_id)) {
      throw new Error(
        `stop_times references unknown trip ${item.trip_id}.`
      );
    }

    if (!stopIds.has(item.stop_id)) {
      throw new Error(
        `Trip ${item.trip_id} references unknown stop ${item.stop_id}.`
      );
    }

    const key = `${item.trip_id}|${item.stop_sequence}`;

    if (seenSequences.has(key)) {
      throw new Error(
        `Trip ${item.trip_id} has duplicate stop sequence ${item.stop_sequence}.`
      );
    }

    seenSequences.add(key);

    if (!byTrip.has(item.trip_id)) {
      byTrip.set(item.trip_id, []);
    }

    byTrip.get(item.trip_id).push(item);
  }

  // Every trip must have at least two stops for our V1 direct-search scope.

  for (const trip of data.trips) {
    const items = (byTrip.get(trip.trip_id) || [])
      .sort((a, b) => a.stop_sequence - b.stop_sequence);

    if (items.length < 2) {
      throw new Error(
        `Trip ${trip.trip_id} has fewer than two stops.`
      );
    }

    // Check schedule time does not move backwards.

    for (let i = 1; i < items.length; i++) {
      const previousDeparture = items[i - 1].departure_seconds;
      const nextArrival = items[i].arrival_seconds;

      if (
        previousDeparture !== null &&
        nextArrival !== null &&
        nextArrival < previousDeparture
      ) {
        throw new Error(
          `Trip ${trip.trip_id} has decreasing scheduled times.`
        );
      }
    }
  }

  // Fare relationships

  for (const fare of data.fareAttributes) {
    if (
      fare.agency_id &&
      agencyIds.size &&
      !agencyIds.has(fare.agency_id)
    ) {
      throw new Error(`Unknown agency in fare ${fare.fare_id}.`);
    }
  }

  for (const rule of data.fareRules) {
    if (!fareIds.has(rule.fare_id)) {
      throw new Error(`Unknown fare ${rule.fare_id}.`);
    }

    if (rule.route_id && !routeIds.has(rule.route_id)) {
      throw new Error(`Unknown route ${rule.route_id} in fare rule.`);
    }

    for (const field of ['origin_id', 'destination_id', 'contains_id']) {
      if (rule[field] && zoneIds.size && !zoneIds.has(rule[field])) {
        throw new Error(`Unknown fare zone in ${field}: ${rule[field]}.`);
      }
    }
  }

  report.source_counts = {
    agencies: data.agencies.length,
    stops: data.stops.length,
    routes: data.routes.length,
    trips: data.trips.length,
    stopTimes: data.stopTimes.length,
    serviceCalendars: data.serviceCalendars.length,
    serviceExceptions: data.serviceExceptions.length,
    shapes: data.shapes.length,

    shapePoints: data.shapes.reduce(
      (sum, shape) => sum + shape.points.length,
      0
    ),

    fareAttributes: data.fareAttributes.length,
    fareRules: data.fareRules.length
  };

  if (!data.shapes.length) {
    report.warnings.push('No shapes found. Do not display an exact route path.');
  }

  if (!data.fareAttributes.length) {
    report.warnings.push('No fare data found.');
  }
}

// ==========================================
// 7. CREATE MONGODB COLLECTIONS
// ==========================================

async function createCollections(db) {
  const existing = new Set(
    (
      await db.listCollections({}, { nameOnly: true }).toArray()
    ).map((x) => x.name)
  );

  for (const name of COLLECTIONS) {
    if (!existing.has(name)) {
      try {
        await db.createCollection(name);
      } catch (error) {
        if (error.codeName !== 'NamespaceExists') {
          throw error;
        }
      }
    }
  }
}

// ==========================================
// 8. CREATE INDEXES
// ==========================================

async function createIndexes(db) {
  const indexes = {
    agencies: [
      [{ feed_version: 1, agency_key: 1 }, { unique: true }]
    ],

    stops: [
      [{ feed_version: 1, stop_id: 1 }, { unique: true }],
      [{ location: '2dsphere' }, {}],
      [{ feed_version: 1, stop_name: 1 }, {}]
    ],

    routes: [
      [{ feed_version: 1, route_id: 1 }, { unique: true }],
      [{ feed_version: 1, route_short_name: 1 }, {}]
    ],

    trips: [
      [{ feed_version: 1, trip_id: 1 }, { unique: true }],
      [{ feed_version: 1, route_id: 1, service_id: 1 }, {}]
    ],

    stopTimes: [
      [{ feed_version: 1, trip_id: 1, stop_sequence: 1 }, { unique: true }],
      [{ feed_version: 1, stop_id: 1, trip_id: 1 }, {}]
    ],

    serviceCalendars: [
      [{ feed_version: 1, service_id: 1 }, { unique: true }]
    ],

    serviceExceptions: [
      [{ feed_version: 1, service_id: 1, date: 1 }, { unique: true }]
    ],

    shapes: [
      [{ feed_version: 1, shape_id: 1 }, { unique: true }],
      [{ geometry: '2dsphere' }, {}]
    ],

    fareAttributes: [
      [{ feed_version: 1, fare_id: 1 }, { unique: true }]
    ],

    fareRules: [
      [{ feed_version: 1, fare_id: 1, rule_id: 1 }, { unique: true }],
      [{ feed_version: 1, route_id: 1 }, {}]
    ],

    gtfsFeeds: [
      [{ feed_version: 1 }, { unique: true }]
    ]
  };

  for (const [collection, definitions] of Object.entries(indexes)) {
    for (const [keys, options] of definitions) {
      await db.collection(collection).createIndex(keys, options);
    }
  }
}

// ==========================================
// 9. SAFE BATCH IMPORT
// ==========================================

const KEY_FIELDS = {
  agencies: ['agency_key'],
  stops: ['stop_id'],
  routes: ['route_id'],
  trips: ['trip_id'],
  stopTimes: ['trip_id', 'stop_sequence'],
  serviceCalendars: ['service_id'],
  serviceExceptions: ['service_id', 'date'],
  shapes: ['shape_id'],
  fareAttributes: ['fare_id'],
  fareRules: ['fare_id', 'rule_id']
};

async function upsertBatch(db, collectionName, documents) {
  if (!documents.length) return;

  const collection = db.collection(collectionName);
  const keys = KEY_FIELDS[collectionName];

  for (let offset = 0; offset < documents.length; offset += BATCH_SIZE) {
    const batch = documents.slice(offset, offset + BATCH_SIZE);
    const now = new Date();

    const operations = batch.map((doc) => {
      const filter = {
        feed_version: doc.feed_version
      };

      for (const key of keys) {
        filter[key] = doc[key];
      }

      return {
        updateOne: {
          filter,

          update: {
            $set: {
              ...doc,
              updated_at: now
            },

            $setOnInsert: {
              created_at: now
            }
          },

          upsert: true
        }
      };
    });

    await collection.bulkWrite(
      operations,
      { ordered: false }
    );
  }
}

// ==========================================
// 10. VERIFY DATABASE DOCUMENT COUNTS
// ==========================================

async function verifyCounts(db, version, data) {
  const expected = {
    agencies: data.agencies.length,
    stops: data.stops.length,
    routes: data.routes.length,
    trips: data.trips.length,
    stopTimes: data.stopTimes.length,
    serviceCalendars: data.serviceCalendars.length,
    serviceExceptions: data.serviceExceptions.length,
    shapes: data.shapes.length,
    fareAttributes: data.fareAttributes.length,
    fareRules: data.fareRules.length
  };

  for (const [name, expectedCount] of Object.entries(expected)) {
    const actualCount = await db
      .collection(name)
      .countDocuments({ feed_version: version });

    report.database_counts[name] = actualCount;

    if (actualCount !== expectedCount) {
      throw new Error(
        `${name}: expected ${expectedCount}, found ${actualCount}.`
      );
    }
  }
}

// ==========================================
// 11. SAVE IMPORT REPORT
// ==========================================

async function saveReport() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  report.finished_at = new Date().toISOString();

  const safeVersion = (
    report.feed_version || 'unknown'
  ).replace(/[^a-zA-Z0-9._-]/g, '_');

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const destination = path.join(
    REPORT_DIR,
    `gtfs-seed-${safeVersion}-${timestamp}.json`
  );

  fs.writeFileSync(
    destination,
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log(
    `\nReport saved: ${path.relative(ROOT, destination)}`
  );
}

// ==========================================
// 12. MAIN EXECUTION
// ==========================================

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/seed-gtfs/index.js [--dry-run]');
    return;
  }

  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1) {
    throw new Error('GTFS_BATCH_SIZE must be a positive integer.');
  }

  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error(`GTFS ZIP not found: ${ZIP_PATH}`);
  }

  if (!DRY_RUN && !process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from the root .env file.');
  }

  // Read ZIP

  const zipBuffer = fs.readFileSync(ZIP_PATH);

  report.source_sha256 = crypto
    .createHash('sha256')
    .update(zipBuffer)
    .digest('hex');

  const zip = new AdmZip(zipBuffer);

  const entryNames = new Set(
    zip.getEntries()
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.entryName.replace(/\\/g, '/'))
  );

  for (const name of REQUIRED_FILES) {
    if (!entryNames.has(name)) {
      throw new Error(
        `${name} must be present at the root of the ZIP.`
      );
    }
  }

  // Parse files

  const files = {};

  for (const name of [...REQUIRED_FILES, ...OPTIONAL_FILES]) {
    const parsed = readCsv(
      zip,
      name,
      REQUIRED_FILES.includes(name)
    );

    if (parsed) files[name] = parsed;
  }

  // Validate file headers

  checkHeaders('agency.txt', files['agency.txt'], [
    'agency_name',
    'agency_url',
    'agency_timezone'
  ]);

  checkHeaders('stops.txt', files['stops.txt'], [
    'stop_id',
    'stop_name',
    'stop_lat',
    'stop_lon'
  ]);

  checkHeaders('routes.txt', files['routes.txt'], [
    'route_id',
    'route_type'
  ]);

  checkHeaders('trips.txt', files['trips.txt'], [
    'route_id',
    'service_id',
    'trip_id'
  ]);

  checkHeaders('stop_times.txt', files['stop_times.txt'], [
    'trip_id',
    'arrival_time',
    'departure_time',
    'stop_id',
    'stop_sequence'
  ]);

  checkHeaders('calendar.txt', files['calendar.txt'], [
    'service_id',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'start_date',
    'end_date'
  ]);

  checkHeaders('calendar_dates.txt', files['calendar_dates.txt'], [
    'service_id',
    'date',
    'exception_type'
  ]);

  checkHeaders('shapes.txt', files['shapes.txt'], [
    'shape_id',
    'shape_pt_lat',
    'shape_pt_lon',
    'shape_pt_sequence'
  ]);

  checkHeaders('fare_attributes.txt', files['fare_attributes.txt'], [
    'fare_id',
    'price',
    'currency_type',
    'payment_method'
  ]);

  checkHeaders('fare_rules.txt', files['fare_rules.txt'], [
    'fare_id'
  ]);

  // Determine feed version

  const feedInfo = rows(files, 'feed_info.txt')[0] || {};

  feedVersion =
    process.env.GTFS_FEED_VERSION ||
    clean(feedInfo.feed_version) ||
    `import-${report.source_sha256.slice(0, 12)}`;

  report.feed_version = feedVersion;

  // Transform and validate

  const data = transform(files, feedVersion);

  validate(data);

  console.log('\nGTFS parsing and validation passed.');
  console.log('City:', CITY);
  console.log('Feed version:', feedVersion);
  console.log('SHA-256:', report.source_sha256);

  console.table(report.source_counts);

  // Dry run stops here.

  if (DRY_RUN) {
    report.status = 'dry-run-passed';

    console.log(
      '\nDry run complete. MongoDB was not contacted.'
    );

    return;
  }

  // Connect to Atlas

  client = new MongoClient(
    process.env.MONGODB_URI,
    {
      appName: 'CityRide-GTFS-Seed',
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 5
    }
  );

  await client.connect();

  console.log('\nConnected to MongoDB Atlas.');

  const db = client.db(DB_NAME);

  // Create database collections and indexes.

  await createCollections(db);
  await createIndexes(db);

  // Prevent accidental reuse of a feed version with different ZIP content.

  const existingFeed = await db
    .collection('gtfsFeeds')
    .findOne({ feed_version: feedVersion });

  if (
    existingFeed &&
    existingFeed.source_sha256 !== report.source_sha256
  ) {
    throw new Error(
      `Feed version ${feedVersion} already exists with different ZIP contents. ` +
      'Use a new GTFS_FEED_VERSION before importing changed data.'
    );
  }

  // Check whether this exact feed is already active.

  const activeState = await db
    .collection('gtfsFeedState')
    .findOne({ _id: 'active' });

  if (activeState?.active_feed_version === feedVersion) {
    await verifyCounts(db, feedVersion, data);

    report.status = 'already-active-verified';

    console.log(
      'This feed is already active. Counts verified; no re-import required.'
    );

    return;
  }

  // Mark feed as importing.

  await db.collection('gtfsFeeds').updateOne(
    { feed_version: feedVersion },

    {
      $set: {
        ...data.feed,
        status: 'importing',
        imported_at: null,
        activated_at: null,
        last_error: null,
        updated_at: new Date()
      },

      $setOnInsert: {
        created_at: new Date()
      }
    },

    { upsert: true }
  );

  // Parent/reference collections are imported first.

  const importOrder = [
    ['agencies', data.agencies],
    ['stops', data.stops],
    ['routes', data.routes],
    ['serviceCalendars', data.serviceCalendars],
    ['serviceExceptions', data.serviceExceptions],
    ['shapes', data.shapes],
    ['fareAttributes', data.fareAttributes],
    ['trips', data.trips],
    ['stopTimes', data.stopTimes],
    ['fareRules', data.fareRules]
  ];

  for (const [name, documents] of importOrder) {
    await upsertBatch(db, name, documents);

    console.log(
      `${name}: ${documents.length} records processed.`
    );
  }

  // Verify imported records before activation.

  await verifyCounts(db, feedVersion, data);

  // Switch the active feed through one atomic document update.

  await db.collection('gtfsFeedState').updateOne(
    { _id: 'active' },

    {
      $set: {
        active_feed_version: feedVersion,
        updated_at: new Date()
      },

      $setOnInsert: {
        created_at: new Date()
      }
    },

    { upsert: true }
  );

  // Update descriptive feed statuses.

  try {
    await db.collection('gtfsFeeds').updateMany(
      {
        feed_version: { $ne: feedVersion },
        status: 'active'
      },
      {
        $set: {
          status: 'archived',
          updated_at: new Date()
        }
      }
    );

    await db.collection('gtfsFeeds').updateOne(
      { feed_version: feedVersion },
      {
        $set: {
          status: 'active',
          imported_at: new Date(),
          activated_at: new Date(),
          imported_counts: report.database_counts,
          updated_at: new Date()
        }
      }
    );
  } catch (error) {
    report.warnings.push(
      `Active feed pointer was switched, but metadata update needs review: ${error.message}`
    );
  }

  report.status = 'success';

  console.log('\nGTFS IMPORT SUCCESSFUL');
  console.log('Database:', DB_NAME);
  console.log('Active feed:', feedVersion);

  console.table(report.database_counts);
}

// ==========================================
// 13. EXECUTE + ERROR HANDLING
// ==========================================

(async () => {
  try {
    await main();

  } catch (error) {
    report.status = 'failed';
    report.errors.push(error.message);

    console.error('\nGTFS SEED FAILED:', error.message);

    // Do not mark a feed as failed if its active pointer
    // has already been switched to this version.

    if (client && feedVersion) {
      try {
        const db = client.db(DB_NAME);

        const state = await db
          .collection('gtfsFeedState')
          .findOne({ _id: 'active' });

        if (state?.active_feed_version !== feedVersion) {
          await db.collection('gtfsFeeds').updateOne(
            { feed_version: feedVersion },
            {
              $set: {
                status: 'failed',
                last_error: error.message,
                updated_at: new Date()
              }
            }
          );
        }
      } catch (statusError) {
        console.error(
          'Could not update feed status:',
          statusError.message
        );
      }
    }

    process.exitCode = 1;

  } finally {
    try {
      await saveReport();
    } catch (reportError) {
      console.error(
        'Could not save validation report:',
        reportError.message
      );
    }

    if (client) {
      await client.close().catch(() => {});
    }
  }
})();
