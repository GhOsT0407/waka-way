/**
 * Lagos Transport Stop Data
 *
 * Comprehensive geocoded stops for all major Lagos corridors.
 * Organized by transport mode so the routing engine can search
 * each infrastructure pool independently.
 *
 * Sources: LAMATA, Primero TSL, LagFerry, OSM, LBSL, community data
 */

export interface Stop {
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
  corridor?: 'brt' | 'blue_line' | 'red_line' | 'ferry' | 'danfo_hub';
  lineIndex?: number;
  corridorId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BRT — Ikorodu ↔ TBS / CMS (Primero TSL)
// The 22 km BRT Lite spine commissioned March 2008
// ─────────────────────────────────────────────────────────────────────────────
export const BRT_STOPS: Stop[] = [
  // ── Ikorodu ↔ TBS/CMS corridor (Primero TSL, 22km spine) ─────
  { name: 'TBS Terminal',        latitude: 6.4531, longitude: 3.3898, type: 'brt_terminal', corridor: 'brt', lineIndex: 0,  corridorId: 'ikorodu_tbs' },
  { name: 'CMS',                 latitude: 6.4555, longitude: 3.3938, type: 'brt_stop',     corridor: 'brt', lineIndex: 1,  corridorId: 'ikorodu_tbs' },
  { name: 'Stadium',             latitude: 6.4991, longitude: 3.3523, type: 'brt_stop',     corridor: 'brt', lineIndex: 2,  corridorId: 'ikorodu_tbs' },
  { name: 'Costain',             latitude: 6.4960, longitude: 3.3553, type: 'brt_stop',     corridor: 'brt', lineIndex: 3,  corridorId: 'ikorodu_tbs' },
  { name: 'Mushalashi',          latitude: 6.4978, longitude: 3.3590, type: 'brt_stop',     corridor: 'brt', lineIndex: 4,  corridorId: 'ikorodu_tbs' },
  { name: 'Ojuelegba BRT',       latitude: 6.5110, longitude: 3.3614, type: 'brt_stop',     corridor: 'brt', lineIndex: 5,  corridorId: 'ikorodu_tbs' },
  { name: 'Yaba BRT',            latitude: 6.5158, longitude: 3.3674, type: 'brt_stop',     corridor: 'brt', lineIndex: 6,  corridorId: 'ikorodu_tbs' },
  { name: 'Onipanu',             latitude: 6.5450, longitude: 3.3632, type: 'brt_stop',     corridor: 'brt', lineIndex: 7,  corridorId: 'ikorodu_tbs' },
  { name: 'Palmgroove',          latitude: 6.5439, longitude: 3.3724, type: 'brt_stop',     corridor: 'brt', lineIndex: 8,  corridorId: 'ikorodu_tbs' },
  { name: 'Obanikoro',           latitude: 6.5498, longitude: 3.3758, type: 'brt_stop',     corridor: 'brt', lineIndex: 9,  corridorId: 'ikorodu_tbs' },
  { name: 'Fadeyi',              latitude: 6.5390, longitude: 3.3593, type: 'brt_stop',     corridor: 'brt', lineIndex: 10, corridorId: 'ikorodu_tbs' },
  { name: 'Jibowu',              latitude: 6.5519, longitude: 3.3839, type: 'brt_stop',     corridor: 'brt', lineIndex: 11, corridorId: 'ikorodu_tbs' },
  { name: 'Anthony',             latitude: 6.5620, longitude: 3.3598, type: 'brt_stop',     corridor: 'brt', lineIndex: 12, corridorId: 'ikorodu_tbs' },
  { name: 'Maryland BRT',        latitude: 6.5710, longitude: 3.3602, type: 'brt_stop',     corridor: 'brt', lineIndex: 13, corridorId: 'ikorodu_tbs' },
  { name: 'Gbagada BRT',         latitude: 6.5745, longitude: 3.3890, type: 'brt_stop',     corridor: 'brt', lineIndex: 14, corridorId: 'ikorodu_tbs' },
  { name: 'Ojota',               latitude: 6.6043, longitude: 3.3819, type: 'brt_stop',     corridor: 'brt', lineIndex: 15, corridorId: 'ikorodu_tbs' },
  { name: 'Ketu BRT',            latitude: 6.6065, longitude: 3.3876, type: 'brt_stop',     corridor: 'brt', lineIndex: 16, corridorId: 'ikorodu_tbs' },
  { name: 'Mile 12 BRT',         latitude: 6.6212, longitude: 3.3836, type: 'brt_stop',     corridor: 'brt', lineIndex: 17, corridorId: 'ikorodu_tbs' },
  { name: 'Owode-Onirin',        latitude: 6.6080, longitude: 3.4032, type: 'brt_stop',     corridor: 'brt', lineIndex: 18, corridorId: 'ikorodu_tbs' },
  { name: 'Irawo',               latitude: 6.6228, longitude: 3.3906, type: 'brt_stop',     corridor: 'brt', lineIndex: 19, corridorId: 'ikorodu_tbs' },
  { name: 'Ikorodu Terminal',    latitude: 6.6176, longitude: 3.5027, type: 'brt_terminal', corridor: 'brt', lineIndex: 20, corridorId: 'ikorodu_tbs' },
  { name: 'National Theatre BRT',latitude: 6.4934, longitude: 3.3681, type: 'brt_stop',     corridor: 'brt', lineIndex: 30, corridorId: 'ikorodu_tbs' },
  // ── Abule-Egba ↔ Oshodi extension (LAMATA, 2024) — separate corridor ──
  { name: 'Oshodi BRT',          latitude: 6.5520, longitude: 3.3430, type: 'brt_stop',     corridor: 'brt', lineIndex: 21, corridorId: 'abule_egba' },
  { name: 'Shogunle',            latitude: 6.5673, longitude: 3.3382, type: 'brt_stop',     corridor: 'brt', lineIndex: 22, corridorId: 'abule_egba' },
  { name: 'Ikeja Along BRT',     latitude: 6.5869, longitude: 3.3348, type: 'brt_stop',     corridor: 'brt', lineIndex: 23, corridorId: 'abule_egba' },
  { name: 'Mangoro',             latitude: 6.5891, longitude: 3.3218, type: 'brt_stop',     corridor: 'brt', lineIndex: 24, corridorId: 'abule_egba' },
  { name: 'Cement',              latitude: 6.5835, longitude: 3.3105, type: 'brt_stop',     corridor: 'brt', lineIndex: 25, corridorId: 'abule_egba' },
  { name: 'Dopemu',              latitude: 6.5793, longitude: 3.2942, type: 'brt_stop',     corridor: 'brt', lineIndex: 26, corridorId: 'abule_egba' },
  { name: 'Iyana-Ipaja BRT',     latitude: 6.5756, longitude: 3.2789, type: 'brt_stop',     corridor: 'brt', lineIndex: 27, corridorId: 'abule_egba' },
  { name: 'Ile-Epo',             latitude: 6.5628, longitude: 3.2453, type: 'brt_stop',     corridor: 'brt', lineIndex: 28, corridorId: 'abule_egba' },
  { name: 'Abule-Egba',          latitude: 6.5502, longitude: 3.2182, type: 'brt_terminal', corridor: 'brt', lineIndex: 29, corridorId: 'abule_egba' },
];

export const BRT_IKORODU_STOPS  = BRT_STOPS.filter(s => s.corridorId === 'ikorodu_tbs');
export const BRT_ABULE_EGBA_STOPS = BRT_STOPS.filter(s => s.corridorId === 'abule_egba');

// ─────────────────────────────────────────────────────────────────────────────
// Blue Line Rail: Mile 2 ↔ Marina (operational Sep 2023)
// ─────────────────────────────────────────────────────────────────────────────
export const BLUE_LINE_STOPS: Stop[] = [
  { name: 'Marina Rail',           latitude: 6.4541, longitude: 3.3944, type: 'rail_station', corridor: 'blue_line', lineIndex: 0 },
  { name: 'National Theatre Rail', latitude: 6.4902, longitude: 3.3681, type: 'rail_station', corridor: 'blue_line', lineIndex: 1 },
  { name: 'Orile Iganmu',          latitude: 6.4902, longitude: 3.3481, type: 'rail_station', corridor: 'blue_line', lineIndex: 2 },
  { name: 'Suru-Alaba',            latitude: 6.4740, longitude: 3.3313, type: 'rail_station', corridor: 'blue_line', lineIndex: 3 },
  { name: 'Mile 2 Rail',           latitude: 6.4648, longitude: 3.3117, type: 'rail_station', corridor: 'blue_line', lineIndex: 4 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Red Line Rail: Oyingbo ↔ Agbado (operational Oct 2024)
// ─────────────────────────────────────────────────────────────────────────────
export const RED_LINE_STOPS: Stop[] = [
  { name: 'Oyingbo',        latitude: 6.4823, longitude: 3.3879, type: 'rail_station', corridor: 'red_line', lineIndex: 0 },
  { name: 'Yaba Rail',      latitude: 6.5196, longitude: 3.3703, type: 'rail_station', corridor: 'red_line', lineIndex: 1 },
  { name: 'Mushin Rail',    latitude: 6.5293, longitude: 3.3542, type: 'rail_station', corridor: 'red_line', lineIndex: 2 },
  { name: 'Oshodi Rail',    latitude: 6.5508, longitude: 3.3451, type: 'rail_station', corridor: 'red_line', lineIndex: 3 },
  { name: 'MMIA Domestic',  latitude: 6.5770, longitude: 3.3198, type: 'rail_station', corridor: 'red_line', lineIndex: 4 },
  { name: 'Ikeja Rail',     latitude: 6.5954, longitude: 3.3383, type: 'rail_station', corridor: 'red_line', lineIndex: 5 },
  { name: 'Agege Rail',     latitude: 6.6219, longitude: 3.3090, type: 'rail_station', corridor: 'red_line', lineIndex: 6 },
  { name: 'Iju',            latitude: 6.6345, longitude: 3.2761, type: 'rail_station', corridor: 'red_line', lineIndex: 7 },
  { name: 'Agbado',         latitude: 6.6516, longitude: 3.2477, type: 'rail_station', corridor: 'red_line', lineIndex: 8 },
];

// ─────────────────────────────────────────────────────────────────────────────
// LagFerry / Metro Ferry terminals (2024)
// ─────────────────────────────────────────────────────────────────────────────
export const FERRY_TERMINALS: Stop[] = [
  { name: 'Marina Ferry',            latitude: 6.4542, longitude: 3.3944, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Five Cowries (Falomo)',    latitude: 6.4508, longitude: 3.4259, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Ebute-Ero Jetty',         latitude: 6.4566, longitude: 3.3794, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Ipakodo (Ikorodu)',        latitude: 6.6094, longitude: 3.5038, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Mile 2 Ferry',            latitude: 6.4648, longitude: 3.3117, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Liverpool Apapa',         latitude: 6.4434, longitude: 3.3611, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Badore Jetty',            latitude: 6.4432, longitude: 3.5690, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Majidun Awori Ferry',     latitude: 6.6045, longitude: 3.4189, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Ijegun Ferry',            latitude: 6.5165, longitude: 3.2812, type: 'ferry_terminal', corridor: 'ferry' },
];

// Ferry route pairs (which terminals are directly connected)
export const FERRY_ROUTES: Array<[string, string]> = [
  ['Ipakodo (Ikorodu)', 'Five Cowries (Falomo)'],
  ['Ipakodo (Ikorodu)', 'Ebute-Ero Jetty'],
  ['Ipakodo (Ikorodu)', 'Marina Ferry'],
  ['Mile 2 Ferry',              'Liverpool Apapa'],
  ['Mile 2 Ferry',              'Marina Ferry'],
  ['Liverpool Apapa',           'Five Cowries (Falomo)'],
  ['Liverpool Apapa',           'Ebute-Ero Jetty'],
  ['Ebute-Ero Jetty',           'Marina Ferry'],
  ['Five Cowries (Falomo)', 'Marina Ferry'],
  ['Badore Jetty',      'Marina Ferry'],
  ['Majidun Awori Ferry', 'Ebute-Ero Jetty'],
  ['Majidun Awori Ferry', 'Ipakodo (Ikorodu)'],
  ['Ijegun Ferry', 'Liverpool Apapa'],
  ['Ijegun Ferry', 'Marina Ferry'],
];

// ─────────────────────────────────────────────────────────────────────────────
// DANFO HUBS & BUS STOPS
// Major parks, interchanges, and stops across all 8 main corridors
// ─────────────────────────────────────────────────────────────────────────────
export const DANFO_HUBS: Stop[] = [

  // ── Island & waterfront ───────────────────────────────────────
  { name: 'CMS',               latitude: 6.4555, longitude: 3.3938, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'TBS',               latitude: 6.4531, longitude: 3.3898, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Obalende',          latitude: 6.4508, longitude: 3.4201, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Lagos Island',      latitude: 6.4562, longitude: 3.3941, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Idumota',           latitude: 6.4563, longitude: 3.3875, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Apapa',             latitude: 6.4434, longitude: 3.3611, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ebute-Metta',       latitude: 6.4738, longitude: 3.3794, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Oyingbo',           latitude: 6.4823, longitude: 3.3879, type: 'major_hub',  corridor: 'danfo_hub' },

  // ── Victoria Island / Ikoyi ───────────────────────────────────
  { name: 'Victoria Island',   latitude: 6.4285, longitude: 3.4230, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ikoyi',             latitude: 6.4579, longitude: 3.4355, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Sandfill',          latitude: 6.4440, longitude: 3.4298, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Onikan',            latitude: 6.4519, longitude: 3.4022, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Race Course',       latitude: 6.4478, longitude: 3.4151, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Lekki corridor (C003) ─────────────────────────────────────
  { name: 'Lekki Phase 1',     latitude: 6.4346, longitude: 3.4714, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Marwa',             latitude: 6.4380, longitude: 3.4534, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Jakande',           latitude: 6.4432, longitude: 3.4692, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Igbo-Efon',         latitude: 6.4326, longitude: 3.4825, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Chevron',           latitude: 6.4305, longitude: 3.4505, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Elf',               latitude: 6.4378, longitude: 3.4580, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'VGC',               latitude: 6.4432, longitude: 3.4692, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Admiralty Way',     latitude: 6.4432, longitude: 3.4634, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Freedom Way',       latitude: 6.4346, longitude: 3.4812, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ajah',              latitude: 6.4698, longitude: 3.5732, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ajah Roundabout',   latitude: 6.4698, longitude: 3.5732, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Sangotedo',         latitude: 6.4390, longitude: 3.5023, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Abraham Adesanya',  latitude: 6.4558, longitude: 3.5231, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Awoyaya',           latitude: 6.4312, longitude: 3.5256, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Bogije',            latitude: 6.4235, longitude: 3.5456, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Eleko Junction',    latitude: 6.4156, longitude: 3.5628, type: 'major_junction', corridor: 'danfo_hub' },
  { name: 'Badore',            latitude: 6.4432, longitude: 3.5690, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Shapati',           latitude: 6.4189, longitude: 3.5812, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Surulere / Mushin (C007) ──────────────────────────────────
  { name: 'Ojuelegba',         latitude: 6.5110, longitude: 3.3614, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Yaba',              latitude: 6.5158, longitude: 3.3674, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Surulere',          latitude: 6.5050, longitude: 3.3500, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Iponri',            latitude: 6.4974, longitude: 3.3545, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Alaka',             latitude: 6.5000, longitude: 3.3490, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'National Stadium',  latitude: 6.4985, longitude: 3.3450, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Itire',             latitude: 6.5100, longitude: 3.3482, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Lawanson',          latitude: 6.5089, longitude: 3.3350, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Idi-Araba',         latitude: 6.5224, longitude: 3.3482, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Mushin',            latitude: 6.5293, longitude: 3.3542, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Iganmu',            latitude: 6.4876, longitude: 3.3432, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Orile',             latitude: 6.4902, longitude: 3.3481, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Oshodi / Isolo (C008) ─────────────────────────────────────
  { name: 'Oshodi',            latitude: 6.5520, longitude: 3.3430, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Isolo',             latitude: 6.5280, longitude: 3.3038, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ejigbo',            latitude: 6.5310, longitude: 3.2884, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Okota',             latitude: 6.5421, longitude: 3.2945, type: 'major_bus_stop', corridor: 'danfo_hub' },
  { name: 'Ijesha',            latitude: 6.5312, longitude: 3.2789, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ikotun Garage',     latitude: 6.5285, longitude: 3.2520, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Egbe',              latitude: 6.5338, longitude: 3.2345, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Idimu',             latitude: 6.5378, longitude: 3.2145, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ago Palace Way',    latitude: 6.5448, longitude: 3.3002, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Ikeja corridor (C002, C006) ───────────────────────────────
  { name: 'Ikeja',             latitude: 6.5954, longitude: 3.3383, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ikeja Along',       latitude: 6.5869, longitude: 3.3348, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ikeja Under-bridge',latitude: 6.6014, longitude: 3.3391, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Allen Junction',    latitude: 6.5964, longitude: 3.3506, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Computer Village',  latitude: 6.5892, longitude: 3.3333, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ikeja GRA',         latitude: 6.6000, longitude: 3.3500, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Alausa',            latitude: 6.5987, longitude: 3.3472, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Agidingbi',         latitude: 6.6025, longitude: 3.3455, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Maryland',          latitude: 6.5710, longitude: 3.3602, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Palmgroove',        latitude: 6.5439, longitude: 3.3724, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Jibowu',            latitude: 6.5519, longitude: 3.3839, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Bariga',            latitude: 6.5400, longitude: 3.3930, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Fadeyi',            latitude: 6.5390, longitude: 3.3593, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Anthony',           latitude: 6.5620, longitude: 3.3598, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Ikorodu Road corridor (C005) ──────────────────────────────
  { name: 'Gbagada',           latitude: 6.5745, longitude: 3.3890, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ojota',             latitude: 6.6043, longitude: 3.3819, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ketu',              latitude: 6.6065, longitude: 3.3876, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Mile 12',           latitude: 6.6212, longitude: 3.3836, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Alapere',           latitude: 6.6210, longitude: 3.4012, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Iyana-Oworo',       latitude: 6.5678, longitude: 3.4025, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Oworonshoki',       latitude: 6.5698, longitude: 3.4089, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Owode-Onirin',      latitude: 6.6080, longitude: 3.4032, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Irawo',             latitude: 6.6228, longitude: 3.3906, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Ikorodu corridor (C001) ───────────────────────────────────
  { name: 'Ikorodu',           latitude: 6.6176, longitude: 3.5027, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ikorodu Garage',    latitude: 6.6185, longitude: 3.5044, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Agric',             latitude: 6.6118, longitude: 3.4848, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Aruna',             latitude: 6.6092, longitude: 3.4675, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ogolonto',          latitude: 6.6048, longitude: 3.4412, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Majidun Ogolonto',  latitude: 6.6032, longitude: 3.4312, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Majidun Awori',     latitude: 6.6045, longitude: 3.4189, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Idera',             latitude: 6.6152, longitude: 3.3978, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Ikeja to Ojodu Berger (C006) ──────────────────────────────
  { name: 'Ojodu Berger',      latitude: 6.6453, longitude: 3.3558, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Berger',            latitude: 6.6453, longitude: 3.3558, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ogba',              latitude: 6.6096, longitude: 3.3340, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Mile 2 / Festac / Badagry (C004) ─────────────────────────
  { name: 'Mile 2',            latitude: 6.4648, longitude: 3.3117, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Festac',            latitude: 6.4660, longitude: 3.2830, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Festac 1st Gate',   latitude: 6.4668, longitude: 3.2892, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Alakija',           latitude: 6.4680, longitude: 3.3015, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Trade Fair',        latitude: 6.4698, longitude: 3.2951, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Volks',             latitude: 6.4718, longitude: 3.2842, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Alaba International', latitude: 6.4742, longitude: 3.2678, type: 'major_junction', corridor: 'danfo_hub' },
  { name: 'Ojo',               latitude: 6.4887, longitude: 3.2245, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Iyana-Iba',         latitude: 6.5148, longitude: 3.1982, type: 'major_bus_stop', corridor: 'danfo_hub' },
  { name: 'Okokomaiko',        latitude: 6.5192, longitude: 3.1562, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Agbara',            latitude: 6.4899, longitude: 3.1261, type: 'major_junction', corridor: 'danfo_hub' },
  { name: 'Badagry',           latitude: 6.4153, longitude: 2.8876, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Satellite Town',    latitude: 6.4745, longitude: 3.3001, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Agege / Abule-Egba (C002) ─────────────────────────────────
  { name: 'Agege',             latitude: 6.6219, longitude: 3.3090, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Abule-Egba',        latitude: 6.5502, longitude: 3.2182, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Iyana-Ipaja',       latitude: 6.5756, longitude: 3.2789, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ipaja',             latitude: 6.5684, longitude: 3.2561, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ayobo',             latitude: 6.5756, longitude: 3.2789, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Akowonjo',          latitude: 6.5512, longitude: 3.2478, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Egbeda',            latitude: 6.5652, longitude: 3.2638, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Shasha',            latitude: 6.5534, longitude: 3.2728, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Dopemu',            latitude: 6.5793, longitude: 3.2942, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Cement',            latitude: 6.5835, longitude: 3.3105, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Mangoro',           latitude: 6.5891, longitude: 3.3218, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ikeja Along',       latitude: 6.5869, longitude: 3.3348, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Abule-Ijesha',      latitude: 6.5034, longitude: 3.2934, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ikotun',            latitude: 6.5285, longitude: 3.2520, type: 'major_hub',  corridor: 'danfo_hub' },
  { name: 'Ijegun',            latitude: 6.5165, longitude: 3.2812, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Abesan',            latitude: 6.5978, longitude: 3.2432, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Gbagada / Onipanu area ────────────────────────────────────
  { name: 'Obanikoro',         latitude: 6.5498, longitude: 3.3758, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Onipanu',           latitude: 6.5450, longitude: 3.3632, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Awoyokun',          latitude: 6.5521, longitude: 3.3670, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Mushalashi',        latitude: 6.4978, longitude: 3.3590, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Stadium',           latitude: 6.4991, longitude: 3.3523, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Costain',           latitude: 6.4960, longitude: 3.3553, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Jibowu',            latitude: 6.5519, longitude: 3.3839, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Mainland other ────────────────────────────────────────────
  { name: 'Idi-Oro',           latitude: 6.5158, longitude: 3.3486, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Agboville',         latitude: 6.5089, longitude: 3.3234, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Ilasamaja',         latitude: 6.5189, longitude: 3.3195, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'Shogunle',          latitude: 6.5673, longitude: 3.3382, type: 'bus_stop',   corridor: 'danfo_hub' },
  { name: 'National Theatre',  latitude: 6.4934, longitude: 3.3681, type: 'bus_stop',   corridor: 'danfo_hub' },

  // ── Lekki Phase 2 / Expressway ────────────────────────────────
  { name: 'Lekki 2nd Roundabout', latitude: 6.4358, longitude: 3.4624, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Lekki 3rd Roundabout', latitude: 6.4346, longitude: 3.4812, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Ikota',                latitude: 6.4346, longitude: 3.4912, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Lekki Market',         latitude: 6.4380, longitude: 3.4712, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Osapa London',         latitude: 6.4332, longitude: 3.5145, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Oral Estate',          latitude: 6.4315, longitude: 3.5345, type: 'bus_stop',        corridor: 'danfo_hub' },

  // ── Epe corridor (beyond Ajah on Lekki-Epe Expressway) ───────
  { name: 'Ogombo',               latitude: 6.4178, longitude: 3.5901, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Abijo',                latitude: 6.4258, longitude: 3.6345, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Lakowe',               latitude: 6.4212, longitude: 3.6612, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Ibeju',                latitude: 6.4389, longitude: 3.7256, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Ejinrin',              latitude: 6.5284, longitude: 3.8498, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Itokin',               latitude: 6.6452, longitude: 3.8712, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Epe',                  latitude: 6.5767, longitude: 3.9786, type: 'major_hub',       corridor: 'danfo_hub' },

  // ── Victoria Island (additional stops) ───────────────────────
  { name: 'Ozumba Mbadiwe',       latitude: 6.4320, longitude: 3.4325, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Bar Beach',            latitude: 6.4278, longitude: 3.4270, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Oniru',                latitude: 6.4452, longitude: 3.4512, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Ligali Ayorinde',      latitude: 6.4315, longitude: 3.4365, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Adetokunbo Ademola',   latitude: 6.4298, longitude: 3.4189, type: 'bus_stop',        corridor: 'danfo_hub' },

  // ── Lagos Island inner ────────────────────────────────────────
  { name: 'Broad Street',         latitude: 6.4544, longitude: 3.3942, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Tinubu Square',        latitude: 6.4547, longitude: 3.3918, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Carter Bridge',        latitude: 6.4617, longitude: 3.3784, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Eko Bridge',           latitude: 6.4668, longitude: 3.3768, type: 'bus_stop',        corridor: 'danfo_hub' },

  // ── Amuwo-Odofin ──────────────────────────────────────────────
  { name: 'Amuwo-Odofin',         latitude: 6.4740, longitude: 3.2968, type: 'major_hub',       corridor: 'danfo_hub' },
  { name: 'Apple Junction',       latitude: 6.4724, longitude: 3.3052, type: 'major_junction',  corridor: 'danfo_hub' },
  { name: 'Kirikiri',             latitude: 6.4626, longitude: 3.3051, type: 'bus_stop',        corridor: 'danfo_hub' },

  // ── Magodo / Shangisha ────────────────────────────────────────
  { name: 'Shangisha',            latitude: 6.6234, longitude: 3.3612, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Magodo Phase 1',       latitude: 6.6125, longitude: 3.3685, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Magodo Phase 2',       latitude: 6.6189, longitude: 3.3724, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Isheri-Oshun',         latitude: 6.6334, longitude: 3.3478, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Omole Phase 1',        latitude: 6.6078, longitude: 3.3534, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Omole Phase 2',        latitude: 6.6145, longitude: 3.3589, type: 'bus_stop',        corridor: 'danfo_hub' },

  // ── Alimosho / Meiran ─────────────────────────────────────────
  { name: 'Meiran',               latitude: 6.6178, longitude: 3.2789, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Ekoro Road',           latitude: 6.6156, longitude: 3.2512, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Alimosho',             latitude: 6.5754, longitude: 3.2234, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Alakuko',              latitude: 6.6189, longitude: 3.2215, type: 'bus_stop',        corridor: 'danfo_hub' },

  // ── Badagry corridor (additional) ────────────────────────────
  { name: 'Ajara',                latitude: 6.4250, longitude: 2.9200, type: 'bus_stop',        corridor: 'danfo_hub' },
  { name: 'Seme Border',          latitude: 6.3548, longitude: 2.7122, type: 'major_junction',  corridor: 'danfo_hub' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Combined pool — used by routing engine for nearest-stop search
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_STOPS: Stop[] = [
  ...BRT_STOPS,
  ...BLUE_LINE_STOPS,
  ...RED_LINE_STOPS,
  ...FERRY_TERMINALS,
  ...DANFO_HUBS,
];
