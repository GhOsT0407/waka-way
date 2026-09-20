/**
 * Lagos corridors — which bus (or keke) goes where, in stop order.
 *
 * This is the layer the engine was missing: lagosStops.ts is points; this
 * file is lines. A bus leg can only exist along one of these corridors, so
 * the engine can no longer invent "Danfo A → B" between two hubs that no
 * bus connects. See decisions/0012.
 *
 * Coverage goal: every LGA in Lagos State and every major park connected,
 * so any location-to-location trip is derived from here. Corridors come
 * from LAMATA's published routes (BRT, rail, the standard-route fare table
 * of 2 Mar 2026), the roads every Lagosian knows, and OSM stop nodes.
 *
 * Coordinates: checked 2026-09-17. `osm` = an OpenStreetMap bus_stop /
 * station node; `known` = a well-known junction placed from local knowledge
 * and MapTiler, ±150 m in the metro, ±1 km on the outer expressways.
 *
 * Confidence on a corridor: `verified` = LAMATA-published line; `local` = a
 * corridor every Lagosian knows; `likely` = runs, but the exact stop list
 * may be off. Riders correct these through the Report tab.
 *
 * `hops` = road distance in km between consecutive stops, from OSRM. When
 * present the graph uses it instead of straight-line × 1.25.
 */

import type { TransportMode } from '../types/routing';

export interface GraphStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  source: 'osm' | 'known';
  interchange?: boolean;
}

export type Confidence = 'verified' | 'local' | 'likely';

export interface Corridor {
  id: string;
  mode: TransportMode;
  name: string;
  operator?: string;
  stops: string[];
  confidence: Confidence;
  fullFare?: number;
  timetabled?: boolean;
  speedKmh?: number;
  /** Road km between consecutive stops (length = stops.length - 1). */
  hops?: number[];
  /**
   * What the conductor shouts, keyed by the terminal stop the bus is heading
   * to. Missing entries fall back to the terminal's short name doubled
   * ("Oshodi Oshodi!"), which is the Lagos default anyway.
   */
  calls?: Record<string, string>;
}

// ─── Stops ───────────────────────────────────────────────────────────────────
const S = (id: string, name: string, latitude: number, longitude: number, source: 'osm' | 'known', interchange = false): GraphStop =>
  ({ id, name, latitude, longitude, source, interchange });

export const GRAPH_STOPS: GraphStop[] = [
  // ── Lagos Island / Eti-Osa ───────────────────────────────────────────────
  S('cms',            'CMS',                  6.4555, 3.3938, 'known', true),
  S('tbs',            'TBS',                  6.4500, 3.3990, 'known', true),
  S('marina',         'Marina',               6.4462, 3.3950, 'osm',   true),
  S('idumota',        'Idumota',              6.4629, 3.3867, 'osm',   true),
  S('tinubu',         'Tinubu Square',        6.4547, 3.3918, 'known'),
  S('obalende',       'Obalende',             6.4496, 3.4074, 'osm',   true),
  S('onikan',         'Onikan',               6.4470, 3.4030, 'known'),
  S('bonny_camp',     'Bonny Camp',           6.4377, 3.4088, 'osm'),
  S('law_school',     'Law School',           6.4389, 3.4250, 'osm'),
  S('falomo',         'Falomo',               6.4444, 3.4260, 'osm',   true),
  S('vi',             'Victoria Island (Adetokunbo Ademola)', 6.4298, 3.4189, 'known', true),
  S('oniru',          'Oniru',                6.4364, 3.4182, 'osm'),
  S('lekki_phase1',   'Lekki Phase 1',        6.4370, 3.4560, 'known', true),
  S('marwa',          'Marwa',                6.4362, 3.4720, 'known'),
  S('ikate',          'Ikate',                6.4390, 3.4880, 'known'),
  S('jakande',        'Jakande',              6.4395, 3.5045, 'known', true),
  S('igbo_efon',      'Igbo-Efon',            6.4400, 3.5200, 'known'),
  S('chevron',        'Chevron',              6.4410, 3.5297, 'osm'),
  S('ikota',          'Ikota',                6.4473, 3.5496, 'osm'),
  S('vgc',            'VGC',                  6.4510, 3.5600, 'known'),
  S('ajah',           'Ajah',                 6.4675, 3.5701, 'known', true),
  S('abraham_adesanya','Abraham Adesanya',    6.4696, 3.5843, 'osm',   true),
  S('badore',         'Badore',               6.4900, 3.5950, 'known'),
  S('langbasa',       'Langbasa',             6.4780, 3.5900, 'known'),

  // ── Ibeju-Lekki / Epe ────────────────────────────────────────────────────
  S('sangotedo',      'Sangotedo',            6.4710, 3.6356, 'osm'),
  S('abijo',          'Abijo',                6.4528, 3.6717, 'osm'),
  S('awoyaya',        'Awoyaya',              6.4697, 3.7046, 'osm'),
  S('lakowe',         'Lakowe',               6.4673, 3.7318, 'osm'),
  S('bogije',         'Bogije',               6.4780, 3.7900, 'known'),
  S('eleko',          'Eleko Junction',       6.4751, 3.8440, 'osm'),
  S('ibeju',          'Ibeju-Lekki',          6.4900, 3.9050, 'known'),
  S('epe',            'Epe',                  6.5850, 3.9750, 'known', true),
  S('ejinrin',        'Ejinrin',              6.6149, 3.8964, 'known'),
  S('itokin',         'Itokin',               6.6563, 3.7949, 'known'),
  S('agbowa',         'Agbowa',               6.6350, 3.7000, 'known'),

  // ── Lagos Mainland / Surulere / Shomolu ──────────────────────────────────
  S('costain',        'Costain',              6.4790, 3.3710, 'known', true),
  S('iponri',         'Iponri',               6.4880, 3.3640, 'known'),
  S('stadium',        'Stadium',              6.4950, 3.3620, 'known'),
  S('ojuelegba',      'Ojuelegba',            6.5075, 3.3640, 'known', true),
  S('barracks',       'Barracks',             6.5120, 3.3665, 'known'),
  S('jibowu',         'Jibowu',               6.5175, 3.3700, 'known', true),
  S('yaba',           'Yaba',                 6.5090, 3.3735, 'known', true),
  S('sabo',           'Sabo',                 6.5140, 3.3800, 'known'),
  S('onike',          'Onike',                6.5095, 3.3839, 'osm'),
  S('akoka',          'Akoka',                6.5210, 3.3880, 'known'),
  S('unilag',         'UNILAG Gate',          6.5150, 3.3960, 'known'),
  S('oyingbo',        'Oyingbo',              6.4834, 3.3815, 'osm',   true),
  S('ebute_metta',    'Ebute-Metta',          6.4790, 3.3800, 'known'),
  S('iddo',           'Iddo',                 6.4715, 3.3860, 'known'),
  S('adekunle',       'Adekunle',             6.4980, 3.3900, 'known'),
  S('fola_agoro',     'Fola Agoro',           6.5230, 3.3870, 'known'),
  S('bariga',         'Bariga',               6.5330, 3.3930, 'known', true),
  S('shomolu',        'Shomolu (Bajulaiye)',  6.5390, 3.3800, 'known'),
  S('national_theatre','National Theatre',    6.4747, 3.3688, 'osm',   true),
  S('iganmu',         'Iganmu',               6.4776, 3.3431, 'osm'),
  S('orile',          'Orile',                6.4800, 3.3400, 'known', true),
  S('alaba_suru',     'Suru-Alaba',           6.4644, 3.3245, 'osm'),
  S('ijora',          'Ijora',                6.4640, 3.3730, 'known'),
  S('lawanson',       'Lawanson',             6.5060, 3.3480, 'known'),
  S('idi_oro',        'Idi-Oro',              6.5180, 3.3550, 'known'),

  // ── Apapa / Ajeromi-Ifelodun / Amuwo-Odofin ──────────────────────────────
  S('apapa',          'Apapa',                6.4489, 3.3590, 'known', true),
  S('boundary',       'Boundary (Ajegunle)',  6.4610, 3.3400, 'known', true),
  S('mile2',          'Mile 2',               6.4599, 3.3117, 'osm',   true),
  S('abule_ado',      'Abule-Ado',            6.4640, 3.2980, 'known'),
  S('festac',         'Festac (First Gate)',  6.4667, 3.2878, 'known', true),
  S('apple_junction', 'Apple Junction',       6.4724, 3.3052, 'known'),
  S('satellite_town', 'Satellite Town',       6.4497, 3.2558, 'known'),
  S('alakija',        'Alakija',              6.4650, 3.2790, 'known'),
  S('trade_fair',     'Trade Fair',           6.4640, 3.2450, 'known'),
  S('alaba',          'Alaba International',  6.4620, 3.2180, 'known', true),
  S('iyana_iba',      'Iyana-Iba',            6.4660, 3.2060, 'known', true),
  S('lasu',           'LASU Gate (Ojo)',      6.4665, 3.1990, 'known'),
  S('ojo_barracks',   'Ojo Barracks',         6.4700, 3.1780, 'known'),
  S('okokomaiko',     'Okokomaiko',           6.4700, 3.1600, 'known', true),
  S('agbara',         'Agbara',               6.4985, 3.0860, 'osm'),
  S('morogbo',        'Morogbo',              6.4650, 3.0100, 'known'),
  S('mowo',           'Mowo',                 6.4470, 2.9550, 'known'),
  S('ajara',          'Ajara',                6.4333, 2.9000, 'osm'),
  S('badagry',        'Badagry',              6.4150, 2.8850, 'known', true),
  S('seme',           'Seme Border',          6.3800, 2.7300, 'known'),

  // ── Ikorodu Road / Kosofe ────────────────────────────────────────────────
  S('fadeyi',         'Fadeyi',               6.5233, 3.3674, 'osm',   true),
  S('onipanu',        'Onipanu',              6.5330, 3.3670, 'known'),
  S('palmgrove',      'Palmgrove',            6.5418, 3.3674, 'osm'),
  S('obanikoro',      'Obanikoro',            6.5466, 3.3676, 'osm'),
  S('anthony',        'Anthony',              6.5571, 3.3667, 'osm',   true),
  S('maryland',       'Maryland',             6.5745, 3.3690, 'osm',   true),
  S('ojota',          'Ojota',                6.5880, 3.3860, 'known', true),
  S('ogudu',          'Ogudu',                6.5750, 3.3950, 'known'),
  S('ketu',           'Ketu',                 6.5981, 3.3868, 'osm',   true),
  S('magodo',         'Magodo (Shangisha)',   6.6084, 3.3821, 'known'),
  S('mile12',         'Mile 12',              6.6045, 3.4019, 'osm',   true),
  S('alapere',        'Alapere',              6.5883, 3.3975, 'known'),
  S('owode_onirin',   'Owode-Onirin',         6.6086, 3.4092, 'osm'),
  S('idera',          'Idera',                6.6120, 3.4155, 'osm'),
  S('irawo',          'Irawo',                6.6098, 3.4221, 'osm'),
  S('majidun',        'Majidun',              6.6187, 3.4620, 'osm'),
  S('ogolonto',       'Ogolonto',             6.6196, 3.4748, 'osm'),
  S('agric',          'Agric',                6.6254, 3.4840, 'osm'),
  S('aruna',          'Aruna',                6.6246, 3.4927, 'osm'),
  S('benson',         'Benson',               6.6225, 3.4993, 'osm'),

  // ── Ikorodu ──────────────────────────────────────────────────────────────
  S('ikorodu',        'Ikorodu Garage',       6.6194, 3.5105, 'known', true),
  S('igbogbo',        'Igbogbo',              6.5892, 3.5186, 'osm'),
  S('bayeku',         'Bayeku',               6.5700, 3.5350, 'known'),
  S('maya',           'Maya',                 6.6010, 3.5330, 'known'),
  S('elepe',          'Elepe',                6.5960, 3.5700, 'known'),
  S('ijede',          'Ijede',                6.5680, 3.5950, 'known'),
  S('odogunyan',      'Odogunyan',            6.6520, 3.5250, 'known'),
  S('ogijo',          'Ogijo',                6.7059, 3.5103, 'osm'),

  // ── Gbagada / Third Mainland ─────────────────────────────────────────────
  S('gbagada',        'Gbagada (Ifako)',      6.5580, 3.3840, 'known', true),
  S('gbagada_phase1', 'Gbagada Phase 1',      6.5480, 3.3900, 'known'),
  S('iyana_oworo',    'Iyana-Oworo',          6.5610, 3.3975, 'known', true),
  S('oworonshoki',    'Oworonshoki',          6.5470, 3.4030, 'known', true),

  // ── Oshodi / Mushin / Isolo / Airport ────────────────────────────────────
  S('oshodi',         'Oshodi',               6.5560, 3.3400, 'known', true),
  S('bolade',         'Bolade',               6.5615, 3.3385, 'known'),
  S('mushin',         'Mushin',               6.5270, 3.3540, 'known', true),
  S('ilasamaja',      'Ilasamaja',            6.5320, 3.3240, 'known'),
  S('cele',           'Cele',                 6.5190, 3.3190, 'known', true),
  S('ijesha',         'Ijesha',               6.5010, 3.3190, 'known'),
  S('isolo',          'Isolo',                6.5285, 3.3188, 'known'),
  S('okota',          'Okota',                6.5150, 3.3120, 'known'),
  S('ago_palace',     'Ago Palace',           6.5030, 3.3060, 'known'),
  S('ejigbo',         'Ejigbo',               6.5320, 3.2890, 'known'),
  S('mafoluku',       'Mafoluku',             6.5640, 3.3300, 'known'),
  S('airport',        'Airport (MMA)',        6.5790, 3.3220, 'known', true),

  // ── Agege Motor Road / Ikeja ─────────────────────────────────────────────
  S('shogunle',       'Shogunle',             6.5720, 3.3370, 'known'),
  S('ikeja_along',    'Ikeja Along',          6.5987, 3.3345, 'osm',   true),
  S('ikeja',          'Ikeja (Under Bridge)', 6.5965, 3.3480, 'known', true),
  S('computer_village','Computer Village',    6.5937, 3.3416, 'known'),
  S('allen',          'Allen Roundabout',     6.6020, 3.3550, 'known'),
  S('opebi',          'Opebi',                6.5960, 3.3620, 'known'),
  S('oregun',         'Oregun',               6.5950, 3.3730, 'known'),
  S('alausa',         'Alausa',               6.6096, 3.3566, 'known', true),
  S('agidingbi',      'Agidingbi',            6.6220, 3.3540, 'known'),
  S('ogba',           'Ogba',                 6.6325, 3.3417, 'osm',   true),
  S('berger',         'Ojodu Berger',         6.6440, 3.3640, 'known', true),
  S('mangoro',        'Mangoro',              6.6050, 3.3290, 'known'),
  S('cement',         'Cement',               6.6110, 3.3200, 'known'),
  S('dopemu',         'Dopemu',               6.6155, 3.3110, 'known'),
  S('iyana_ipaja',    'Iyana-Ipaja',          6.6140, 3.2960, 'known', true),
  S('ile_epo',        'Ile-Epo',              6.6205, 3.2840, 'known'),
  S('abule_egba',     'Abule-Egba',           6.6400, 3.2820, 'known', true),
  S('agege',          'Agege (Pen Cinema)',   6.6250, 3.3240, 'known', true),

  // ── Ifako-Ijaiye / Ota road ──────────────────────────────────────────────
  S('fagba',          'Fagba',                6.6420, 3.3180, 'known'),
  S('iju_ishaga',     'Iju-Ishaga',           6.6600, 3.3250, 'known'),
  S('meiran',         'Meiran',               6.6499, 3.2712, 'known'),
  S('alakuko',        'Alakuko',              6.6700, 3.2500, 'known'),
  S('kola',           'Kola',                 6.6750, 3.2600, 'known'),
  S('tollgate',       'Toll Gate (Sango)',    6.6925, 3.2574, 'osm'),
  S('sango',          'Sango Ota',            6.7072, 3.2429, 'osm',   true),

  // ── Alimosho ─────────────────────────────────────────────────────────────
  S('ikotun',         'Ikotun',               6.5480, 3.2678, 'osm',   true),
  S('ijegun',         'Ijegun',               6.5162, 3.2549, 'known'),
  S('idimu',          'Idimu',                6.5722, 3.2570, 'osm'),
  S('egbeda',         'Egbeda',               6.5930, 3.2877, 'known', true),
  S('akowonjo',       'Akowonjo',             6.6004, 3.3006, 'known'),
  S('shasha',         'Shasha',               6.5735, 3.3063, 'known'),
  S('igando',         'Igando',               6.5560, 3.2450, 'known', true),
  S('ipaja',          'Ipaja',                6.6150, 3.2700, 'known'),
  S('baruwa',         'Baruwa',               6.6120, 3.2550, 'known'),
  S('ayobo',          'Ayobo',                6.6070, 3.2400, 'known', true),
  S('command',        'Command',              6.6300, 3.2400, 'known'),

  // ── Rail stations (Blue + Red) ───────────────────────────────────────────
  S('rail_marina',    'Marina Station',       6.4462, 3.3950, 'osm'),
  S('rail_ntheatre',  'National Theatre Station', 6.4747, 3.3688, 'osm'),
  S('rail_iganmu',    'Orile Iganmu Station', 6.4776, 3.3431, 'osm'),
  S('rail_alaba',     'Suru-Alaba Station',   6.4644, 3.3245, 'osm'),
  S('rail_mile2',     'Mile 2 Station',       6.4599, 3.3117, 'osm'),
  S('rail_oyingbo',   'Oyingbo Station',      6.4834, 3.3815, 'osm'),
  S('rail_yaba',      'Yaba Station',         6.5115, 3.3700, 'osm'),
  S('rail_mushin',    'Mushin Station',       6.5325, 3.3614, 'osm'),
  S('rail_oshodi',    'Oshodi Station',       6.5573, 3.3514, 'osm'),
  S('rail_ikeja',     'Ikeja Station',        6.5919, 3.3373, 'osm'),
  S('rail_agege',     'Agege Station',        6.6195, 3.3262, 'osm'),
  S('rail_iju',       'Iju Station',          6.6621, 3.3193, 'osm'),
  S('rail_agbado',    'Agbado Station',       6.6871, 3.3031, 'osm'),
];

// ─── Corridors ───────────────────────────────────────────────────────────────
const EXPRESS = 20; // km/h on expressways and bridges; streets default to 14

export const CORRIDORS: Corridor[] = [
  // ══ BRT (LAMATA) ════════════════════════════════════════════════════════
  {
    id: 'brt_ikorodu_tbs', mode: 'brt', name: 'Ikorodu – TBS BRT', operator: 'Primero', confidence: 'verified', fullFare: 960,
    calls: { tbs: 'TBS CMS', ikorodu: 'Ikorodu Ikorodu' },
    stops: ['ikorodu', 'benson', 'aruna', 'agric', 'ogolonto', 'majidun', 'irawo', 'idera', 'owode_onirin', 'mile12', 'ketu', 'ojota',
            'maryland', 'anthony', 'obanikoro', 'palmgrove', 'onipanu', 'fadeyi', 'jibowu', 'barracks', 'ojuelegba', 'stadium', 'iponri',
            'costain', 'cms', 'tbs'],     hops: [1.79, 0.77, 0.98, 1.29, 1.57, 5.12, 0.79, 1.07, 1.25, 2.36, 1.52, 3.65, 2.7, 1.58, 0.66, 1.32, 1.08, 0.95, 0.98, 0.77, 1.43, 1.09, 1.3, 4.99, 1.38] },
  {
    id: 'brt_oshodi_abule_egba', mode: 'brt', name: 'Oshodi – Abule-Egba BRT', operator: 'LAMATA', confidence: 'verified', fullFare: 680,
    stops: ['oshodi', 'bolade', 'shogunle', 'ikeja_along', 'mangoro', 'cement', 'dopemu', 'iyana_ipaja', 'ile_epo', 'abule_egba'],     hops: [0.86, 1.59, 4.87, 1.16, 1.62, 1.96, 2.25, 2.36, 3.14] },
  {
    // LAMATA prices Okokomaiko – Oyingbo and Mile 2 – TBS as BRT services, but
    // how much of the Badagry-expressway lane is actually running is unclear
    // from here — 'likely' until a rider confirms it.
    id: 'brt_okokomaiko_oyingbo', mode: 'brt', name: 'Okokomaiko – Mile 2 – Oyingbo BRT', operator: 'LAMATA', confidence: 'likely', fullFare: 910, speedKmh: EXPRESS,
    stops: ['okokomaiko', 'ojo_barracks', 'iyana_iba', 'alaba', 'trade_fair', 'alakija', 'festac', 'mile2',
            'orile', 'costain', 'iddo', 'oyingbo'],     hops: [2.39, 4.8, 1.89, 4.04, 5.67, 1.71, 3.71, 5.3, 4.63, 3.21, 1.91] },

  // ══ Rail (LAMATA) ═══════════════════════════════════════════════════════
  {
    id: 'rail_blue', mode: 'rail', name: 'Blue Line', operator: 'LAMATA', confidence: 'verified', fullFare: 750,
    stops: ['rail_mile2', 'rail_alaba', 'rail_iganmu', 'rail_ntheatre', 'rail_marina'],
  },
  {
    id: 'rail_red', mode: 'rail', name: 'Red Line', operator: 'LAMATA', confidence: 'verified', fullFare: 1500, timetabled: true,
    stops: ['rail_agbado', 'rail_iju', 'rail_agege', 'rail_ikeja', 'rail_oshodi', 'rail_mushin', 'rail_yaba', 'rail_oyingbo'],
  },

  // ══ LAMATA standard routes (LBSL / franchise, fare table 2 Mar 2026) ════
  {
    id: 'std_ikeja_obalende', mode: 'danfo', name: 'Ikeja – Obalende (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 720, speedKmh: EXPRESS,
    stops: ['ikeja', 'maryland', 'anthony', 'gbagada', 'oworonshoki', 'obalende'],     hops: [4.88, 2.7, 2.58, 3.07, 13.52] },
  {
    id: 'std_oshodi_obalende', mode: 'danfo', name: 'Oshodi – Obalende (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 630, speedKmh: EXPRESS,
    calls: { cms: 'Obalende CMS', oshodi: 'Oshodi Oshodi' },
    stops: ['oshodi', 'anthony', 'gbagada', 'oworonshoki', 'obalende', 'cms'],     hops: [5.2, 2.58, 3.07, 13.52, 1.98] },
  {
    id: 'std_berger_obalende', mode: 'danfo', name: 'Berger – Obalende / TBS (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 680, speedKmh: EXPRESS,
    calls: { tbs: 'Obalende CMS', berger: 'Berger Berger' },
    stops: ['berger', 'ojota', 'iyana_oworo', 'oworonshoki', 'obalende', 'cms', 'tbs'],     hops: [9.53, 4.71, 2.29, 13.52, 1.98, 1.38] },
  {
    id: 'std_oshodi_ayobo', mode: 'danfo', name: 'Oshodi – Iyana-Ipaja – Ayobo – Command (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 890,
    stops: ['oshodi', 'bolade', 'shogunle', 'ikeja_along', 'mangoro', 'cement', 'dopemu', 'iyana_ipaja', 'ipaja', 'baruwa', 'ayobo', 'command'],     hops: [0.86, 1.59, 4.87, 1.16, 1.62, 1.96, 2.25, 4.62, 2.69, 2.36, 3.45] },
  {
    id: 'std_oshodi_tollgate', mode: 'danfo', name: 'Oshodi – Abule-Egba – Toll Gate (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 970,
    stops: ['oshodi', 'ikeja_along', 'dopemu', 'iyana_ipaja', 'abule_egba', 'meiran', 'alakuko', 'kola', 'tollgate', 'sango'],     hops: [5.85, 4.43, 2.25, 4.43, 2.71, 4.5, 1.58, 2.66, 2.6] },
  {
    id: 'std_ikotun_marina', mode: 'danfo', name: 'Ikotun – Oshodi – Marina (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 1100, speedKmh: EXPRESS,
    stops: ['ikotun', 'ejigbo', 'isolo', 'oshodi', 'anthony', 'gbagada', 'oworonshoki', 'obalende', 'cms', 'marina'],     hops: [3.73, 4.86, 5.61, 5.2, 2.58, 3.07, 13.52, 1.98, 1.41] },
  {
    id: 'std_igando_obalende', mode: 'danfo', name: 'Igando – Ikotun – Obalende (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 1140, speedKmh: EXPRESS,
    stops: ['igando', 'ikotun', 'ejigbo', 'isolo', 'oshodi', 'anthony', 'gbagada', 'oworonshoki', 'obalende'],     hops: [4.35, 3.73, 4.86, 5.61, 5.2, 2.58, 3.07, 13.52] },
  {
    id: 'std_ikorodu_obalende', mode: 'danfo', name: 'Ikorodu – Obalende (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 970, speedKmh: EXPRESS,
    stops: ['ikorodu', 'agric', 'ogolonto', 'majidun', 'owode_onirin', 'mile12', 'ketu', 'ojota', 'iyana_oworo', 'oworonshoki', 'obalende'],     hops: [3.54, 1.29, 1.57, 7.75, 1.25, 2.36, 1.52, 4.71, 2.29, 13.52] },
  {
    id: 'std_berger_ajah', mode: 'danfo', name: 'Berger – Obalende – Lekki – Ajah (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 1710, speedKmh: EXPRESS,
    stops: ['berger', 'ojota', 'iyana_oworo', 'oworonshoki', 'obalende', 'falomo', 'lekki_phase1', 'jakande', 'chevron', 'ajah'],     hops: [9.53, 4.71, 2.29, 13.52, 3.02, 4.98, 6.91, 3.09, 7.94] },
  {
    id: 'std_oshodi_ajah', mode: 'danfo', name: 'Oshodi – Obalende – Ajah (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 1320, speedKmh: EXPRESS,
    stops: ['oshodi', 'anthony', 'gbagada', 'oworonshoki', 'obalende', 'falomo', 'lekki_phase1', 'jakande', 'chevron', 'ajah'],     hops: [5.2, 2.58, 3.07, 13.52, 3.02, 4.98, 6.91, 3.09, 7.94] },
  {
    id: 'std_yaba_berger', mode: 'danfo', name: 'Yaba – Ojota – Berger (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 630,
    stops: ['yaba', 'jibowu', 'fadeyi', 'onipanu', 'palmgrove', 'obanikoro', 'anthony', 'maryland', 'ojota', 'berger'],     hops: [1.4, 0.95, 1.08, 1.32, 0.66, 1.58, 2.7, 3.65, 9.53] },
  {
    id: 'std_iyana_ipaja_obalende', mode: 'danfo', name: 'Iyana-Ipaja – Oshodi – Obalende (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 1090, speedKmh: EXPRESS,
    stops: ['iyana_ipaja', 'dopemu', 'cement', 'mangoro', 'ikeja_along', 'shogunle', 'bolade', 'oshodi', 'anthony', 'gbagada', 'oworonshoki', 'obalende'],     hops: [2.25, 1.96, 1.62, 1.16, 4.87, 1.59, 0.86, 5.2, 2.58, 3.07, 13.52] },
  {
    id: 'std_mile12_apapa', mode: 'danfo', name: 'Mile 12 – Oshodi – Apapa (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 810, speedKmh: EXPRESS,
    stops: ['mile12', 'ketu', 'ojota', 'maryland', 'anthony', 'oshodi', 'ilasamaja', 'cele', 'ijesha', 'apapa'],     hops: [2.36, 1.52, 3.65, 2.7, 5.2, 4.87, 2.36, 2.5, 9.84] },
  {
    id: 'std_ojota_egbeda', mode: 'danfo', name: 'Ojota – Ikeja – Egbeda (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 690,
    stops: ['ojota', 'alausa', 'ikeja', 'ikeja_along', 'mangoro', 'cement', 'dopemu', 'iyana_ipaja', 'egbeda'],     hops: [6.46, 2.35, 2.5, 1.16, 1.62, 1.96, 2.25, 2.77] },
  {
    id: 'std_ikeja_ikotun', mode: 'danfo', name: 'Ikeja – Iyana-Ipaja – Egbeda – Idimu – Ikotun (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 630,
    stops: ['ikeja', 'ikeja_along', 'mangoro', 'cement', 'dopemu', 'iyana_ipaja', 'egbeda', 'idimu', 'ikotun'],     hops: [2.5, 1.16, 1.62, 1.96, 2.25, 2.77, 5.43, 4.22] },
  {
    id: 'std_ikeja_igando', mode: 'danfo', name: 'Ikeja – Ikotun – Igando (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 690,
    stops: ['ikeja', 'ikeja_along', 'iyana_ipaja', 'egbeda', 'idimu', 'ikotun', 'igando'],     hops: [2.5, 6.66, 2.77, 5.43, 4.22, 4.35] },
  {
    id: 'std_oshodi_shasha', mode: 'danfo', name: 'Oshodi – Shasha (LAMATA)', operator: 'LBSL', confidence: 'likely', fullFare: 570,
    stops: ['oshodi', 'mafoluku', 'shasha', 'akowonjo', 'egbeda'],     hops: [2.17, 3.81, 3.68, 2.06] },
  {
    id: 'std_yaba_idumota', mode: 'danfo', name: 'Yaba – Oyingbo – Idumota (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 460,
    stops: ['yaba', 'ebute_metta', 'oyingbo', 'iddo', 'idumota'],     hops: [4.4, 0.81, 1.91, 1.34] },
  {
    id: 'std_marina_ajah', mode: 'danfo', name: 'Marina – Lekki – Ajah (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 920, speedKmh: EXPRESS,
    stops: ['marina', 'cms', 'bonny_camp', 'law_school', 'lekki_phase1', 'jakande', 'chevron', 'ajah'],     hops: [1.41, 3.26, 2.35, 4.95, 6.91, 3.09, 7.94] },
  {
    id: 'std_igbogbo_marina', mode: 'danfo', name: 'Igbogbo – Ikorodu – Marina (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 1140, speedKmh: EXPRESS,
    stops: ['igbogbo', 'ikorodu', 'agric', 'mile12', 'ketu', 'ojota', 'iyana_oworo', 'oworonshoki', 'obalende', 'cms', 'marina'],     hops: [4.55, 3.54, 10.73, 2.36, 1.52, 4.71, 2.29, 13.52, 1.98, 1.41] },
  {
    id: 'std_ikorodu_alausa', mode: 'danfo', name: 'Ikorodu – Ojota – Alausa (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 800,
    stops: ['ikorodu', 'agric', 'mile12', 'ketu', 'ojota', 'alausa'],     hops: [3.54, 10.73, 2.36, 1.52, 6.46] },
  {
    id: 'std_abule_egba_ojota', mode: 'danfo', name: 'Abule-Egba – Ikeja – Ojota (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 690,
    stops: ['abule_egba', 'ile_epo', 'iyana_ipaja', 'dopemu', 'cement', 'mangoro', 'ikeja_along', 'ikeja', 'alausa', 'ojota'],     hops: [3.14, 2.36, 2.25, 1.96, 1.62, 1.16, 2.5, 2.35, 6.46] },
  {
    id: 'std_oshodi_agege', mode: 'danfo', name: 'Oshodi – Agege (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 430,
    stops: ['oshodi', 'bolade', 'shogunle', 'ikeja_along', 'mangoro', 'cement', 'dopemu', 'agege'],     hops: [0.86, 1.59, 4.87, 1.16, 1.62, 1.96, 2.41] },
  {
    id: 'std_badagry_mile2', mode: 'danfo', name: 'Badagry – Mile 2 (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 1140, speedKmh: EXPRESS,
    stops: ['badagry', 'ajara', 'mowo', 'morogbo', 'agbara', 'okokomaiko', 'ojo_barracks', 'iyana_iba', 'alaba', 'trade_fair', 'alakija', 'festac', 'mile2'],     hops: [4.18, 7.7, 7.9, 12.8, 13.11, 2.39, 4.8, 1.89, 4.04, 5.67, 1.71, 3.71] },
  {
    id: 'std_odogunyan_oshodi', mode: 'danfo', name: 'Odogunyan – Ikorodu – Oshodi (LAMATA)', operator: 'LBSL', confidence: 'verified', fullFare: 920,
    stops: ['odogunyan', 'ikorodu', 'agric', 'mile12', 'ketu', 'ojota', 'maryland', 'anthony', 'oshodi'],     hops: [4.96, 3.54, 10.73, 2.36, 1.52, 3.65, 2.7, 5.2] },
  {
    id: 'std_elepe_oshodi', mode: 'danfo', name: 'Elepe – Ikorodu – Oshodi (LAMATA)', operator: 'LBSL', confidence: 'likely', fullFare: 920,
    stops: ['ijede', 'elepe', 'maya', 'ikorodu', 'agric', 'mile12', 'ketu', 'ojota', 'maryland', 'anthony', 'oshodi'],     hops: [6.65, 6.12, 4.96, 3.54, 10.73, 2.36, 1.52, 3.65, 2.7, 5.2] },

  // ══ Danfo: the roads everyone knows ═════════════════════════════════════
  {
    id: 'danfo_ikorodu_rd', mode: 'danfo', name: 'Ikorodu Road (Ikorodu – Yaba)', confidence: 'local', speedKmh: EXPRESS,
    calls: { yaba: 'Yaba Yaba', ikorodu: 'Ikorodu Ikorodu' },
    stops: ['ikorodu', 'benson', 'agric', 'ogolonto', 'majidun', 'irawo', 'owode_onirin', 'mile12', 'ketu', 'ojota', 'maryland',
            'anthony', 'obanikoro', 'palmgrove', 'onipanu', 'fadeyi', 'jibowu', 'yaba'],     hops: [1.79, 1.76, 1.29, 1.57, 5.12, 1.93, 1.25, 2.36, 1.52, 3.65, 2.7, 1.58, 0.66, 1.32, 1.08, 0.95, 1.4] },
  {
    id: 'danfo_yaba_cms', mode: 'danfo', name: 'Yaba – Oyingbo – CMS', confidence: 'local',
    calls: { cms: 'CMS Marina', yaba: 'Yaba Yaba' },
    stops: ['yaba', 'sabo', 'ebute_metta', 'oyingbo', 'iddo', 'idumota', 'tinubu', 'cms'],     hops: [1.57, 5.33, 0.81, 1.91, 1.34, 1.16, 0.31] },
  {
    id: 'danfo_yaba_obalende', mode: 'danfo', name: 'Yaba – Obalende (Third Mainland)', confidence: 'local', speedKmh: EXPRESS,
    stops: ['yaba', 'adekunle', 'obalende'],     hops: [3.4, 8.54] },
  {
    id: 'danfo_western_ave', mode: 'danfo', name: 'Ojuelegba – CMS / Obalende (Western Avenue)', confidence: 'local',
    calls: { obalende: 'CMS Obalende', jibowu: 'Ojuelegba Yaba' },
    stops: ['jibowu', 'barracks', 'ojuelegba', 'stadium', 'iponri', 'costain', 'cms', 'obalende'],     hops: [0.98, 0.77, 1.43, 1.09, 1.3, 4.99, 1.98] },
  {
    id: 'danfo_yaba_unilag', mode: 'danfo', name: 'Yaba – Akoka – UNILAG', confidence: 'local',
    stops: ['yaba', 'onike', 'akoka', 'unilag'],     hops: [1.62, 2.11, 1.49] },
  {
    id: 'danfo_yaba_gbagada', mode: 'danfo', name: 'Yaba – Bariga – Gbagada', confidence: 'local',
    stops: ['yaba', 'sabo', 'fola_agoro', 'bariga', 'gbagada_phase1', 'gbagada'],     hops: [1.57, 1.87, 1.89, 2.7, 2.25] },
  {
    id: 'danfo_palmgrove_bariga', mode: 'danfo', name: 'Palmgrove – Shomolu – Bariga', confidence: 'local',
    stops: ['palmgrove', 'shomolu', 'bariga'],     hops: [2.05, 2.07] },
  {
    id: 'danfo_ketu_oworo', mode: 'danfo', name: 'Mile 12 – Ketu – Alapere – Iyana-Oworo – Gbagada', confidence: 'local', speedKmh: EXPRESS,
    stops: ['mile12', 'ketu', 'alapere', 'iyana_oworo', 'oworonshoki', 'gbagada'],     hops: [2.36, 2.05, 4.25, 2.29, 3.07] },
  {
    id: 'danfo_ojota_ogudu', mode: 'danfo', name: 'Ojota – Ogudu – Gbagada', confidence: 'local',
    stops: ['ojota', 'ogudu', 'gbagada'],     hops: [2.37, 3.03] },
  {
    id: 'danfo_ikeja_oshodi', mode: 'danfo', name: 'Ikeja – Oshodi (Agege Motor Road)', confidence: 'local',
    calls: { oshodi: 'Oshodi Oshodi', ikeja: 'Ikeja Under Bridge' },
    stops: ['ikeja', 'ikeja_along', 'shogunle', 'bolade', 'oshodi'],     hops: [2.5, 4.87, 1.59, 0.86] },
  {
    id: 'danfo_ikeja_allen_ojota', mode: 'danfo', name: 'Ikeja – Allen – Opebi – Oregun – Ojota', confidence: 'local',
    stops: ['ikeja', 'allen', 'opebi', 'oregun', 'ojota'],     hops: [1.33, 1.38, 1.65, 2.21] },
  {
    id: 'danfo_ikeja_maryland', mode: 'danfo', name: 'Ikeja – Maryland (Mobolaji Bank Anthony)', confidence: 'local',
    stops: ['ikeja', 'maryland', 'anthony'],     hops: [4.88, 2.7] },
  {
    id: 'danfo_anthony_oshodi', mode: 'danfo', name: 'Anthony – Oshodi', confidence: 'local',
    stops: ['anthony', 'oshodi'],     hops: [5.2] },
  {
    id: 'danfo_ojuelegba_oshodi', mode: 'danfo', name: 'Ojuelegba – Mushin – Oshodi', confidence: 'local',
    stops: ['ojuelegba', 'lawanson', 'idi_oro', 'mushin', 'oshodi'],     hops: [3.01, 2.08, 1.36, 4.94] },
  {
    id: 'danfo_oshodi_mile2', mode: 'danfo', name: 'Oshodi – Cele – Mile 2 (Apapa-Oshodi Expressway)', confidence: 'local', speedKmh: EXPRESS,
    stops: ['oshodi', 'ilasamaja', 'cele', 'ijesha', 'mile2'],     hops: [4.87, 2.36, 2.5, 6.26] },
  {
    id: 'danfo_oshodi_apapa', mode: 'danfo', name: 'Oshodi – Ijesha – Apapa', confidence: 'local', speedKmh: EXPRESS,
    stops: ['oshodi', 'ilasamaja', 'cele', 'ijesha', 'boundary', 'apapa'],     hops: [4.87, 2.36, 2.5, 6.77, 3.69] },
  {
    id: 'danfo_oshodi_airport', mode: 'danfo', name: 'Oshodi – Mafoluku – Airport', confidence: 'local',
    stops: ['oshodi', 'mafoluku', 'airport'],     hops: [2.17, 2.55] },
  {
    id: 'danfo_cele_ago', mode: 'danfo', name: 'Cele – Okota – Ago Palace', confidence: 'local',
    stops: ['cele', 'okota', 'ago_palace'],     hops: [1.53, 2.01] },
  {
    id: 'danfo_ikotun_oshodi', mode: 'danfo', name: 'Ikotun – Ejigbo – Isolo – Oshodi', confidence: 'local',
    stops: ['ikotun', 'ejigbo', 'isolo', 'oshodi'],     hops: [3.73, 4.86, 5.61] },
  {
    id: 'danfo_ikotun_iyana_ipaja', mode: 'danfo', name: 'Igando – Ikotun – Idimu – Egbeda – Iyana-Ipaja', confidence: 'local',
    stops: ['igando', 'ikotun', 'idimu', 'egbeda', 'iyana_ipaja'],     hops: [4.35, 4.22, 5.43, 2.77] },
  {
    id: 'danfo_ayobo_iyana_ipaja', mode: 'danfo', name: 'Command – Ayobo – Ipaja – Iyana-Ipaja', confidence: 'local',
    stops: ['command', 'ayobo', 'baruwa', 'ipaja', 'iyana_ipaja'],     hops: [3.45, 2.36, 2.69, 4.62] },
  {
    id: 'danfo_agege_oshodi', mode: 'danfo', name: 'Abule-Egba – Iyana-Ipaja – Oshodi (Agege Motor Road)', confidence: 'local',
    stops: ['abule_egba', 'ile_epo', 'iyana_ipaja', 'dopemu', 'cement', 'mangoro', 'ikeja_along', 'shogunle', 'bolade', 'oshodi'],     hops: [3.14, 2.36, 2.25, 1.96, 1.62, 1.16, 4.87, 1.59, 0.86] },
  {
    id: 'danfo_agege_ikeja', mode: 'danfo', name: 'Agege – Ogba – Ikeja', confidence: 'likely',
    stops: ['agege', 'ogba', 'agidingbi', 'alausa', 'ikeja'],     hops: [2.66, 2.42, 2.26, 2.35] },
  {
    id: 'danfo_ikeja_ogba', mode: 'danfo', name: 'Ikeja – Agidingbi – Ogba (Obafemi Awolowo Way)', confidence: 'local',
    stops: ['ikeja', 'agidingbi', 'ogba'],
    hops: [4.18, 2.42],
  },
  {
    id: 'danfo_ogba_iju', mode: 'danfo', name: 'Ogba – Fagba – Iju-Ishaga', confidence: 'local',
    stops: ['ogba', 'fagba', 'iju_ishaga'],     hops: [4.4, 3.43] },
  {
    id: 'danfo_agege_iju', mode: 'danfo', name: 'Agege – Fagba – Iju-Ishaga', confidence: 'likely',
    stops: ['agege', 'fagba', 'iju_ishaga'],     hops: [2.7, 3.43] },
  {
    id: 'danfo_berger_ikeja', mode: 'danfo', name: 'Berger – Ogba – Ikeja', confidence: 'likely',
    stops: ['berger', 'ogba', 'agidingbi', 'alausa', 'ikeja'],     hops: [3.18, 2.42, 2.26, 2.35] },
  {
    id: 'danfo_abule_egba_sango', mode: 'danfo', name: 'Abule-Egba – Alakuko – Sango (Lagos-Abeokuta Expressway)', confidence: 'local', speedKmh: EXPRESS,
    stops: ['abule_egba', 'meiran', 'alakuko', 'kola', 'tollgate', 'sango'],     hops: [2.71, 4.5, 1.58, 2.66, 2.6] },

  // ── Island ───────────────────────────────────────────────────────────────
  {
    id: 'danfo_obalende_ajah', mode: 'danfo', name: 'Obalende – Lekki – Ajah', confidence: 'local', speedKmh: EXPRESS,
    calls: { ajah: 'Ajah Ajah', obalende: 'Obalende Obalende' },
    stops: ['obalende', 'falomo', 'lekki_phase1', 'marwa', 'ikate', 'jakande', 'igbo_efon', 'chevron', 'ikota', 'vgc', 'ajah'],     hops: [3.02, 4.98, 2.34, 2.96, 2.86, 2.35, 1.4, 3.12, 1.54, 2.97] },
  {
    id: 'danfo_cms_ajah', mode: 'danfo', name: 'CMS – Bonny Camp – Lekki – Ajah', confidence: 'local', speedKmh: EXPRESS,
    stops: ['cms', 'bonny_camp', 'law_school', 'lekki_phase1', 'jakande', 'chevron', 'ajah'],     hops: [3.26, 2.35, 4.95, 6.91, 3.09, 7.94] },
  {
    id: 'danfo_obalende_vi', mode: 'danfo', name: 'CMS – Obalende – Falomo – Victoria Island', confidence: 'local',
    stops: ['cms', 'obalende', 'onikan', 'falomo', 'vi', 'oniru'],     hops: [1.98, 0.86, 3.81, 2.51, 1.09] },
  {
    id: 'danfo_ajah_epe', mode: 'danfo', name: 'Ajah – Sangotedo – Awoyaya – Epe', confidence: 'local', speedKmh: EXPRESS,
    stops: ['ajah', 'abraham_adesanya', 'sangotedo', 'abijo', 'awoyaya', 'lakowe', 'bogije', 'eleko', 'ibeju', 'epe'],     hops: [2.59, 5.8, 6.16, 5.89, 4.07, 11.28, 7.1, 7.34, 19.91] },

  // ── Apapa / Badagry axis ─────────────────────────────────────────────────
  {
    id: 'danfo_mile2_cms', mode: 'danfo', name: 'Mile 2 – Orile – Costain – CMS', confidence: 'local', speedKmh: EXPRESS,
    stops: ['mile2', 'orile', 'costain', 'cms'],     hops: [5.3, 4.63, 4.99] },
  {
    id: 'danfo_boundary_cms', mode: 'danfo', name: 'Boundary (Ajegunle) – Orile – CMS', confidence: 'local',
    stops: ['boundary', 'orile', 'costain', 'cms'],     hops: [2.85, 4.63, 4.99] },
  {
    id: 'danfo_apapa_cms', mode: 'danfo', name: 'Apapa – Ijora – CMS', confidence: 'local',
    stops: ['apapa', 'ijora', 'costain', 'cms'],     hops: [3.08, 2.56, 4.99] },
  {
    id: 'danfo_mile2_badagry', mode: 'danfo', name: 'Mile 2 – Festac – Ojo – Badagry', confidence: 'local', speedKmh: EXPRESS,
    calls: { badagry: 'Badagry Badagry', mile2: 'Mile 2 Mile 2' },
    stops: ['mile2', 'festac', 'alakija', 'trade_fair', 'alaba', 'iyana_iba', 'ojo_barracks', 'okokomaiko', 'agbara', 'morogbo', 'mowo', 'ajara', 'badagry'],     hops: [3.71, 1.71, 5.67, 4.04, 1.89, 4.8, 2.39, 13.11, 12.8, 7.9, 7.7, 4.18] },
  {
    id: 'danfo_badagry_seme', mode: 'danfo', name: 'Badagry – Seme Border', confidence: 'local', speedKmh: EXPRESS,
    stops: ['badagry', 'seme'],     hops: [21.71] },
  {
    id: 'danfo_mile2_oshodi', mode: 'danfo', name: 'Mile 2 – Cele – Oshodi', confidence: 'local', speedKmh: EXPRESS,
    stops: ['mile2', 'ijesha', 'cele', 'ilasamaja', 'oshodi'],     hops: [6.26, 2.5, 2.36, 4.87] },
  {
    id: 'danfo_satellite_mile2', mode: 'danfo', name: 'Satellite Town – Mile 2', confidence: 'likely',
    stops: ['satellite_town', 'mile2'],     hops: [8.76] },

  // ── Ikorodu / Epe hinterland ─────────────────────────────────────────────
  {
    id: 'danfo_ikorodu_igbogbo', mode: 'danfo', name: 'Ikorodu – Igbogbo – Bayeku', confidence: 'local',
    stops: ['ikorodu', 'igbogbo', 'bayeku'],     hops: [4.55, 3.29] },
  {
    id: 'danfo_ikorodu_ijede', mode: 'danfo', name: 'Ikorodu – Maya – Elepe – Ijede', confidence: 'local',
    stops: ['ikorodu', 'maya', 'elepe', 'ijede'],     hops: [4.96, 6.12, 6.65] },
  {
    id: 'danfo_ikorodu_sagamu', mode: 'danfo', name: 'Ikorodu – Odogunyan – Ogijo (Sagamu Road)', confidence: 'local',
    stops: ['ikorodu', 'odogunyan', 'ogijo'],     hops: [4.96, 6.81] },
  {
    id: 'danfo_ikorodu_epe', mode: 'danfo', name: 'Ikorodu – Agbowa – Itokin – Epe', confidence: 'likely', speedKmh: EXPRESS,
    stops: ['ikorodu', 'agbowa', 'itokin', 'ejinrin', 'epe'],     hops: [26.6, 14.68, 14.61, 15.41] },

  // ══ Keke feeders ════════════════════════════════════════════════════════
  // Known keke runs. Written down precisely because the LGA restriction
  // polygons (decisions/0011) are coarser than the street: keke is banned
  // from Ikeja LGA's major roads, yet Berger ↔ Ogba by keke is how everyone
  // does that hop. A keke corridor is specific knowledge and beats the
  // blanket rule; it never exists unless listed here.
  { id: 'keke_berger_ogba',    mode: 'keke', name: 'Berger – Ojodu – Ogba (keke)',   confidence: 'local', stops: ['berger', 'ogba'],     hops: [3.18] },
  { id: 'keke_ogba_agege',     mode: 'keke', name: 'Ogba – Agege (keke)',            confidence: 'local', stops: ['ogba', 'agege'],     hops: [2.66] },
  { id: 'keke_ojota_alapere',  mode: 'keke', name: 'Ojota – Alapere (keke)',         confidence: 'local', stops: ['ojota', 'alapere'],     hops: [1.72] },
  { id: 'keke_ketu_magodo',    mode: 'keke', name: 'Ketu – Magodo (keke)',           confidence: 'local', stops: ['ketu', 'magodo'],     hops: [1.7] },
  { id: 'keke_ajah_badore',    mode: 'keke', name: 'Ajah – Langbasa – Badore (keke)', confidence: 'local', stops: ['ajah', 'langbasa', 'badore'],     hops: [4.12, 1.95] },
  { id: 'keke_iyana_iba_lasu', mode: 'keke', name: 'Iyana-Iba – LASU (keke)',        confidence: 'local', stops: ['iyana_iba', 'lasu'],     hops: [1.05] },
  { id: 'keke_ikotun_ijegun',  mode: 'keke', name: 'Ikotun – Ijegun (keke)',         confidence: 'local', stops: ['ikotun', 'ijegun'],     hops: [3.99] },
  { id: 'keke_gbagada_phase1', mode: 'keke', name: 'Gbagada – Phase 1 (keke)',       confidence: 'local', stops: ['gbagada', 'gbagada_phase1'],     hops: [2.25] },
  { id: 'keke_ikeja_cv',       mode: 'keke', name: 'Ikeja – Computer Village (keke)', confidence: 'local', stops: ['ikeja', 'computer_village'],     hops: [1.04] },
  { id: 'keke_egbeda_shasha',  mode: 'keke', name: 'Egbeda – Akowonjo – Shasha (keke)', confidence: 'local', stops: ['egbeda', 'akowonjo', 'shasha'],     hops: [2.06, 3.68] },
  { id: 'keke_yaba_unilag',    mode: 'keke', name: 'Yaba – Onike – UNILAG (keke)',   confidence: 'local', stops: ['yaba', 'onike', 'unilag'],     hops: [1.62, 1.66] },
];

// ─── Lookups ─────────────────────────────────────────────────────────────────
export const STOP_BY_ID: Record<string, GraphStop> = Object.fromEntries(GRAPH_STOPS.map((s) => [s.id, s]));

// Every corridor stop id must exist — fail loudly at module load, not on a
// rider's phone in the middle of a search.
for (const c of CORRIDORS) {
  for (const id of c.stops) {
    if (!STOP_BY_ID[id]) throw new Error(`lagosRoutes: corridor ${c.id} references unknown stop '${id}'`);
  }
  if (c.hops && c.hops.length !== c.stops.length - 1) throw new Error(`lagosRoutes: corridor ${c.id} hops length mismatch`);
}
