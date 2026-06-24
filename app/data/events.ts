import type { QualityEvent, RootCause, EventStatus } from './types';
import {
  DISCREPANCY_OPTIONS, DOOR_OPTIONS, PRODUCT_OPTIONS,
  BRANCH_OPTIONS, PLANT_OPTIONS, REPORTED_BY_OPTIONS, ROOT_CAUSE_OPTIONS,
} from './filterOptions';

// xorshift32 — same seed = same output every run
function makePrng(seed: number) {
  let s = (seed >>> 0) || 1;
  return (): number => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function pick<T>(arr: readonly T[], r: number): T {
  return arr[Math.floor(r * arr.length)];
}

function wpick<T>(arr: readonly T[], w: readonly number[], r: number): T {
  let c = 0;
  for (let i = 0; i < arr.length; i++) { c += w[i]; if (r < c) return arr[i]; }
  return arr[arr.length - 1];
}

// Piecewise distribution Jan 1–Jun 15 2026 (days 0–165)
// 15% in Jan–Feb, 25% in Mar–Apr, 60% in May–Jun 15
function genDate(r: number): string {
  let day: number;
  if (r < 0.15) {
    day = Math.floor((r / 0.15) * 59);                 // Jan 1–Feb 28  (0–58)
  } else if (r < 0.40) {
    day = 59 + Math.floor(((r - 0.15) / 0.25) * 61);  // Mar 1–Apr 30  (59–119)
  } else {
    day = 120 + Math.floor(((r - 0.40) / 0.60) * 46); // May 1–Jun 15  (120–165)
  }
  const d = new Date(2026, 0, 1 + day);
  return d.toISOString().slice(0, 10);
}

const ASSIGNEES = [
  'Cameron Reyes', 'Jordan Takeda', 'Dana Okonkwo', 'Priya Sharma', 'Elliot Vance',
] as const;

const QTY_TYPES = ['Piece', 'Length'] as const;

const ADDITIONAL_INFO_NOTES = [
  'Please provide photos of the installation site and confirm the serial number from the product label.',
  'Can you verify whether all hardware components were present at time of installation?',
  'Please confirm the door model number and attach photos showing the reported issue.',
  'Additional photos of the affected area needed. Please include the unit serial number.',
  'Please verify the job number matches the order and confirm any missing components.',
  'Can you confirm whether this was a factory install or a field install?',
  'Please provide a clearer description of the malfunction and any error codes observed.',
  'Photos of the damaged component needed before we can proceed with the parts request.',
  'Please confirm the quantity of affected units and whether the issue is present on all of them.',
  'Can you re-verify the configuration ID on the unit label and resubmit with a photo?',
] as const;

const STATUSES: EventStatus[] = ['Reported', 'Under Investigation', 'Validated', 'Invalidated'];
const SW  = [0.12, 0.18, 0.58, 0.12] as const; // status weights

// Product weights — Motor Gearbox + Controller most common
const PW  = [0.07, 0.18, 0.04, 0.12, 0.05, 0.06, 0.22, 0.06, 0.08, 0.06, 0.06] as const;

// Root cause weights — Supplier Issue + Installation Error most common
const RCW = [0.08, 0.09, 0.12, 0.14, 0.07, 0.06, 0.13, 0.18, 0.06, 0.07] as const;

const RC_OPTIONS = ROOT_CAUSE_OPTIONS as readonly RootCause[];

function generateBulkEvents(): QualityEvent[] {
  const r = makePrng(0xdeadbeef);
  const out: QualityEvent[] = [];

  for (let i = 0; i < 300; i++) {
    const date       = genDate(r());
    const h          = 7 + Math.floor(r() * 10);
    const m          = Math.floor(r() * 60);
    const reportedAt = `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    const status     = wpick(STATUSES, SW, r());
    const product    = wpick(PRODUCT_OPTIONS, PW, r());
    const branch     = pick(BRANCH_OPTIONS, r());
    const plant      = wpick(PLANT_OPTIONS, [0.55, 0.45], r());
    const door       = pick(DOOR_OPTIONS, r());
    const disc       = pick(DISCREPANCY_OPTIONS, r());
    const reportedBy = pick(REPORTED_BY_OPTIONS, r());
    const assignee   = pick(ASSIGNEES, r());
    const dfo        = 1 + Math.floor(r() * 4);
    const orderType  = r() < 0.72 ? 'SO' : 'WO';
    const jobNo   = `${orderType}${200000000 + Math.floor(r() * 13000000)}`;
    const elLine     = orderType === 'SO' ? 1 + Math.floor(r() * 3) : undefined;

    const rootCause: RootCause | null =
      status === 'Validated'
        ? wpick(RC_OPTIONS, RCW, r())
        : status === 'Invalidated' && r() < 0.35
        ? wpick(RC_OPTIONS, RCW, r())
        : null;

    const additionalInfoRequested =
      status === 'Under Investigation' && r() < 0.28 ? true : undefined;
    const additionalInfoNote = additionalInfoRequested
      ? pick(ADDITIONAL_INFO_NOTES, r()) : undefined;

    const hasPartsReq =
      (status === 'Validated' || status === 'Under Investigation') && r() < 0.28;
    const partsRequest = hasPartsReq ? [{
      partNumber:   `${410000 + Math.floor(r() * 35000)}-${1 + Math.floor(r() * 3)}`,
      quantityType: pick(QTY_TYPES, r()),
      quantity:     1 + Math.floor(r() * 5),
      description:  `${product} replacement component for ${door} installation.`,
    }] : undefined;

    out.push({
      id:           `QE_${2001 + i}`,
      date, jobNo, dfo, ...(elLine != null ? { elLine } : {}), status, rootCause,
      branch, plant, product, discrepancy: disc, door,
      issueDescription: `${disc} identified on ${product}. ${branch} branch reported issue with ${door} installation.`,
      assignee, reportedBy, reportedAt,
      ...(additionalInfoRequested ? { additionalInfoRequested, additionalInfoNote } : {}),
      ...(partsRequest ? { partsRequest } : {}),
    });
  }

  return out;
}

// Hand-crafted seed events — May 29 to Jun 5 2026 (most recent, fully detailed)
const SEED_EVENTS: QualityEvent[] = [
  {
    id: 'QE_2392', date: '2026-06-05', jobNo: 'SO109823809', dfo: 1, elLine: 2,
    status: 'Under Investigation', rootCause: null,
    branch: 'Atlanta', plant: 'FAR (Farmington)', product: 'Motor Gearbox',
    discrepancy: 'Missing Installed Component', door: 'Dura_Glide Greenstar 3000',
    issueDescription: 'Motor gearbox assembly delivered without secondary mounting bracket. Configuration requires both primary and secondary brackets per spec.',
    assignee: 'Cameron Reyes', reportedBy: 'Anastasia M. Williams', reportedAt: '2026-06-05T15:44:00',
    tags: ['Urgent', 'Supplier Follow-up'],
    additionalInfoRequested: true,
    additionalInfoNote: 'Please confirm whether the secondary mounting bracket was present at delivery and provide a photo of the bracket mounting location on the unit.',
    partsRequest: [{
      partNumber: '43212345', quantityType: 'Piece', quantity: 5,
      description: 'Secondary mounting bracket for Motor Gearbox assembly. Required for Dura_Glide Greenstar 3000 installation.',
    }],
    hardwareKit: { kitInfo: 'Entire Hardware Kit', serialNumber: '43212345', quantityType: 'Piece', quantity: 5 },
  },
  {
    id: 'QE_2391', date: '2026-06-05', jobNo: 'SO109821456', dfo: 2, elLine: 1,
    status: 'Reported', rootCause: null,
    branch: 'Atlanta', plant: 'FAR (Farmington)', product: 'Motor Gearbox',
    discrepancy: 'Freight Damage', door: 'Dura_Glide Greenstar 3000',
    issueDescription: 'Motor gearbox shaft has visible scoring marks indicating pre-installation damage.',
    assignee: 'Cameron Reyes', reportedBy: 'James Carter', reportedAt: '2026-06-05T14:22:00',
  },
  {
    id: 'QE_2388', date: '2026-06-04', jobNo: 'SO109819034', dfo: 1, elLine: 3,
    status: 'Validated', rootCause: 'Supplier Issue',
    branch: 'Memphis', plant: 'FAR (Farmington)', product: 'Motor Gearbox',
    discrepancy: 'Incorrect Build', door: 'Dura_Glide 3000 Series',
    issueDescription: 'Received Motor Gearbox variant B instead of variant A. Supplier packing list matches variant A.',
    assignee: 'Jordan Takeda', reportedBy: 'Bartholomew T. Henderson', reportedAt: '2026-06-04T09:15:00',
    editHistory: [
      { id: 'eh_2388_1', timestamp: '2026-06-04 10:08', editedBy: 'Jordan Takeda', role: 'Field Quality', field: 'Discrepancy', from: 'Will not Operate', to: 'Incorrect Build' },
      { id: 'eh_2388_2', timestamp: '2026-06-04 10:31', editedBy: 'Jordan Takeda', role: 'Field Quality', field: 'Root Cause', from: null, to: 'Supplier Issue' },
    ],
  },
  {
    id: 'QE_2385', date: '2026-06-04', jobNo: 'SO109816772', dfo: 1, elLine: 1,
    status: 'Validated', rootCause: 'Supplier Issue',
    branch: 'Dallas', plant: 'FAR (Farmington)', product: 'Controller',
    discrepancy: 'Will not Operate', door: 'Dura_Glide 3000 Series',
    issueDescription: 'Three units from batch #ECB-2206 failed power-on self-test. All shipped from same supplier lot.',
    assignee: 'Jordan Takeda', reportedBy: 'Evangeline M. Rodriguez', reportedAt: '2026-06-04T08:30:00',
    editHistory: [
      { id: 'eh_2385_1', timestamp: '2026-06-04 09:14', editedBy: 'Jordan Takeda', role: 'Field Quality', field: 'Discrepancy', from: 'Incorrect Build', to: 'Will not Operate' },
      { id: 'eh_2385_2', timestamp: '2026-06-04 09:45', editedBy: 'Jordan Takeda', role: 'Field Quality', field: 'Root Cause', from: 'Factory Issue', to: 'Supplier Issue' },
    ],
  },
  {
    id: 'QE_2381', date: '2026-06-03', jobNo: 'SO109814401', dfo: 4, elLine: 2,
    status: 'Under Investigation', rootCause: null,
    branch: 'Chicago', plant: 'MTC (Mount Comfort)', product: 'Hardware Kit',
    discrepancy: 'Missing Hardware', door: 'Dura_Glide 2000 Series',
    issueDescription: 'Hardware kit missing locking collar. Unable to complete installation without this component.',
    assignee: 'Dana Okonkwo', reportedBy: 'Cornelius J. Washington', reportedAt: '2026-06-03T11:44:00',
    hardwareKit: { kitInfo: 'Entire Hardware Kit', serialNumber: 'HK-55021-B', quantityType: 'Piece', quantity: 1 },
  },
  {
    id: 'QE_2379', date: '2026-06-03', jobNo: 'SO109812088', dfo: 2, elLine: 1,
    status: 'Validated', rootCause: 'Installation Error',
    branch: 'Indianapolis', plant: 'MTC (Mount Comfort)', product: 'Complete Door Package',
    discrepancy: 'Loose Component', door: 'Procare 8500',
    issueDescription: 'Door closer installed at incorrect spring tension setting. Customer reports door slamming.',
    assignee: 'Dana Okonkwo', reportedBy: 'Maximilian J. Kowalski', reportedAt: '2026-06-03T10:05:00',
    editHistory: [
      { id: 'eh_2379_1', timestamp: '2026-06-03 11:20', editedBy: 'Dana Okonkwo', role: 'Field Quality', field: 'Discrepancy', from: 'Machining', to: 'Loose Component' },
      { id: 'eh_2379_2', timestamp: '2026-06-03 11:38', editedBy: 'Dana Okonkwo', role: 'Field Quality', field: 'Root Cause', from: null, to: 'Installation Error' },
    ],
  },
  {
    id: 'QE_2376', date: '2026-06-02', jobNo: 'SO109809755', dfo: 1, elLine: 2,
    status: 'Validated', rootCause: 'Short Shipping',
    branch: 'New York', plant: 'MTC (Mount Comfort)', product: 'Sensors',
    discrepancy: 'Missing Installed Component', door: 'Dura_Glide 5200',
    issueDescription: 'Sensor shipped without installation screws. Customer ordered full installation kit.',
    assignee: 'Priya Sharma', reportedBy: 'Alexandrina M. Vasquez', reportedAt: '2026-06-02T16:20:00',
    editHistory: [
      { id: 'eh_2376_1', timestamp: '2026-06-02 17:05', editedBy: 'Priya Sharma', role: 'Field Quality', field: 'Discrepancy', from: 'Missing Hardware', to: 'Missing Installed Component' },
      { id: 'eh_2376_2', timestamp: '2026-06-02 17:05', editedBy: 'Priya Sharma', role: 'Field Quality', field: 'Root Cause', from: null, to: 'Short Shipping' },
    ],
  },
  {
    id: 'QE_2373', date: '2026-06-02', jobNo: 'SO109807412', dfo: 3, elLine: 1,
    status: 'Invalidated', rootCause: null,
    branch: 'New Jersey', plant: 'MTC (Mount Comfort)', product: 'Glass',
    discrepancy: 'Visual', door: 'All Glass 2000',
    issueDescription: 'Glass panel delivered with hairline crack along lower edge. Customer spec requires flawless finish.',
    assignee: 'Priya Sharma', reportedBy: 'Bartholomew J. Sanders', reportedAt: '2026-06-02T13:45:00',
    editHistory: [
      { id: 'eh_2373_1', timestamp: '2026-06-02 14:30', editedBy: 'Priya Sharma', role: 'Field Quality', field: 'Discrepancy', from: 'Freight Damage', to: 'Visual' },
      { id: 'eh_2373_2', timestamp: '2026-06-02 14:55', editedBy: 'Priya Sharma', role: 'Field Quality', field: 'Product', from: 'Glass Panel', to: 'Glass' },
    ],
  },
  {
    id: 'QE_2370', date: '2026-06-01', jobNo: 'WO109805099', dfo: 2,
    status: 'Under Investigation', rootCause: null, additionalInfoRequested: true,
    additionalInfoNote: 'Can you confirm which firmware version was installed prior to the update, and whether all 6 units exhibit the same failure mode?',
    branch: 'New England', plant: 'MTC (Mount Comfort)', product: 'Controller',
    discrepancy: 'Will not Operate', door: 'Dura_Glide 2000 Series',
    issueDescription: 'Controller fails to register credentials after firmware update. Affects 6 units in same shipment.',
    assignee: 'Priya Sharma', reportedBy: 'Theodora Ann Whitfield', reportedAt: '2026-06-01T14:00:00',
  },
  {
    id: 'QE_2367', date: '2026-06-01', jobNo: 'SO109802736', dfo: 1, elLine: 3,
    status: 'Validated', rootCause: 'Engineering Issue',
    branch: 'Houston', plant: 'FAR (Farmington)', product: 'Threshold',
    discrepancy: 'Thermal Event', door: 'Dura_Glide Greenstar 3000',
    issueDescription: 'Threshold seal deforming under high-heat conditions. Interior temperatures exceeding 95°F cause seal to gap.',
    assignee: 'Elliot Vance', reportedBy: 'Montgomery Richardson', reportedAt: '2026-06-01T10:30:00',
    editHistory: [
      { id: 'eh_2367_1', timestamp: '2026-06-01 11:44', editedBy: 'Elliot Vance', role: 'Field Quality', field: 'Root Cause', from: 'Factory Issue', to: 'Engineering Issue' },
    ],
  },
  {
    id: 'QE_2364', date: '2026-05-31', jobNo: 'SO109800423', dfo: 4, elLine: 2,
    status: 'Validated', rootCause: 'Short Shipping',
    branch: 'Los Angeles', plant: 'MTC (Mount Comfort)', product: 'Hardware Kit',
    discrepancy: 'Missing Hardware', door: 'M-Force Swing Door',
    issueDescription: 'Hardware kit shipped without through-bolt set. Required for hollow metal door frame installation.',
    assignee: 'Elliot Vance', reportedBy: 'Monica Diaz', reportedAt: '2026-05-31T15:10:00',
    editHistory: [
      { id: 'eh_2364_1', timestamp: '2026-05-31 16:00', editedBy: 'Elliot Vance', role: 'Field Quality', field: 'Discrepancy', from: 'Incorrect Build', to: 'Missing Hardware' },
      { id: 'eh_2364_2', timestamp: '2026-05-31 16:20', editedBy: 'Elliot Vance', role: 'Field Quality', field: 'Root Cause', from: 'Factory Issue', to: 'Short Shipping' },
    ],
  },
  {
    id: 'QE_2361', date: '2026-05-31', jobNo: 'WO109798110', dfo: 1,
    status: 'Reported', rootCause: null, additionalInfoRequested: true,
    additionalInfoNote: 'Please re-verify the machining tolerance at the connector seat and provide caliper measurements if possible.',
    branch: 'San Francisco', plant: 'MTC (Mount Comfort)', product: 'Jamb',
    discrepancy: 'Machining', door: 'Dura_Glide 3000 Series',
    issueDescription: 'Jamb machining tolerance out of spec. Wiring harness connector does not seat correctly.',
    assignee: 'Elliot Vance', reportedBy: 'Janet Wallace', reportedAt: '2026-05-31T11:55:00',
  },
  {
    id: 'QE_2358', date: '2026-05-30', jobNo: 'SO109795847', dfo: 2, elLine: 1,
    status: 'Validated', rootCause: 'Supplier Issue',
    branch: 'Detroit', plant: 'MTC (Mount Comfort)', product: 'Controller',
    discrepancy: 'Incorrect Build', door: 'Procare 8300',
    issueDescription: 'Controllers built to incorrect firmware version. Entire shipment of 24 units affected.',
    assignee: 'Dana Okonkwo', reportedBy: 'Brian Kennedy', reportedAt: '2026-05-30T09:00:00',
    editHistory: [
      { id: 'eh_2358_1', timestamp: '2026-05-30 10:15', editedBy: 'Dana Okonkwo', role: 'Field Quality', field: 'Discrepancy', from: 'Will not Operate', to: 'Incorrect Build' },
      { id: 'eh_2358_2', timestamp: '2026-05-30 11:02', editedBy: 'Dana Okonkwo', role: 'Field Quality', field: 'Root Cause', from: null, to: 'Supplier Issue' },
    ],
  },
  {
    id: 'QE_2355', date: '2026-05-30', jobNo: 'SO109793534', dfo: 3, elLine: 2,
    status: 'Validated', rootCause: 'Factory Issue',
    branch: 'Dallas', plant: 'FAR (Farmington)', product: 'Motor Gearbox',
    discrepancy: 'Will not Operate', door: 'Dura_Glide Greenstar 3000',
    issueDescription: 'Motor gearbox units from batch #MG-4412 drawing excessive current. Risk of controller board damage.',
    assignee: 'Jordan Takeda', reportedBy: 'Paul Dumont', reportedAt: '2026-05-30T08:15:00',
    editHistory: [
      { id: 'eh_2355_1', timestamp: '2026-05-30 09:30', editedBy: 'Jordan Takeda', role: 'Field Quality', field: 'Discrepancy', from: 'Freight Damage', to: 'Will not Operate' },
      { id: 'eh_2355_2', timestamp: '2026-05-30 09:55', editedBy: 'Jordan Takeda', role: 'Field Quality', field: 'Root Cause', from: 'Ordering Error', to: 'Factory Issue' },
      { id: 'eh_2355_3', timestamp: '2026-05-30 10:10', editedBy: 'Jordan Takeda', role: 'Field Quality', field: 'Product', from: 'Controller', to: 'Motor Gearbox' },
    ],
  },
  {
    id: 'QE_2352', date: '2026-05-29', jobNo: 'SO109791221', dfo: 1, elLine: 1,
    status: 'Validated', rootCause: 'Installation Error',
    branch: 'Minneapolis', plant: 'MTC (Mount Comfort)', product: 'Complete Door Package',
    discrepancy: 'Loose Component', door: 'Dura_Glide 2000 Series',
    issueDescription: 'Exit device strike plate misaligned by 3mm causing intermittent latch failure under load.',
    assignee: 'Dana Okonkwo', reportedBy: 'Heather Cox', reportedAt: '2026-05-29T14:30:00',
    editHistory: [
      { id: 'eh_2352_1', timestamp: '2026-05-29 16:05', editedBy: 'Dana Okonkwo', role: 'Field Quality', field: 'Root Cause', from: null, to: 'Factory Issue' },
      { id: 'eh_2352_2', timestamp: '2026-05-29 17:22', editedBy: 'Dana Okonkwo', role: 'Field Quality', field: 'Root Cause', from: 'Factory Issue', to: 'Installation Error' },
    ],
  },

  // ── Today / Tomorrow / Friday (Jun 17–20 2026) ────────────────────────────
  {
    id: 'QE_2393', date: '2026-06-17', jobNo: 'SO110012345', dfo: 2, elLine: 1,
    status: 'Reported', rootCause: null,
    branch: 'Baltimore', plant: 'FAR (Farmington)', product: 'Controller',
    discrepancy: 'Will not Operate', door: 'Dura_Glide Greenstar 2000',
    issueDescription: 'Two controllers failed power-on self-test after installation. LED sequence indicates hardware fault at boot. Both units are from the same packing lot #ECB-2309.',
    assignee: 'Cameron Reyes', reportedBy: 'Raymond J. Caldwell', reportedAt: '2026-06-17T08:15:00',
    tags: ['Controller', 'Power Failure'],
    partsRequest: [
      { partNumber: '421033-3', quantityType: 'Piece', quantity: 2, description: 'Controller PCB Assembly — replacement for two units that failed power-on self-test from lot #ECB-2309.' },
      { partNumber: '421033-4', quantityType: 'Piece', quantity: 2, description: 'Controller Wiring Harness — paired replacement to rule out harness as secondary fault contributor.' },
    ],
    hardwareKit: { kitInfo: 'Controller Hardware Kit', serialNumber: '519001-2', quantityType: 'Piece', quantity: 2 },
  },
  {
    id: 'QE_2394', date: '2026-06-17', jobNo: 'WO110013412', dfo: 1,
    status: 'Under Investigation', rootCause: null,
    branch: 'Denver', plant: 'MTC (Mount Comfort)', product: 'Motor Gearbox',
    discrepancy: 'Freight Damage', door: 'Dura_Glide 3000 Series',
    issueDescription: 'Motor gearbox housing cracked along the casting seam. Damage pattern is consistent with a lateral impact during transit. Unit is non-functional.',
    assignee: 'Jordan Takeda', reportedBy: 'Cordelia M. Fontaine', reportedAt: '2026-06-17T09:42:00',
    tags: ['Freight Damage', 'Urgent'],
    additionalInfoRequested: true,
    additionalInfoNote: 'Please provide photos of the original shipping carton to document transit damage for the supplier freight claim.',
    partsRequest: [
      { partNumber: '413856-3', quantityType: 'Piece', quantity: 1, description: 'Motor Gearbox Assembly — full replacement for transit-damaged unit on Dura-Glide 3000 Series installation.' },
    ],
    hardwareKit: { kitInfo: 'Replacement Gearbox Kit', serialNumber: '519002-1', quantityType: 'Piece', quantity: 1 },
  },
  {
    id: 'QE_2395', date: '2026-06-17', jobNo: 'SO110014789', dfo: 3, elLine: 2,
    status: 'Validated', rootCause: 'Short Shipping',
    branch: 'St.Louis', plant: 'FAR (Farmington)', product: 'Hardware Kit',
    discrepancy: 'Missing Hardware', door: 'Procare 8300 A',
    issueDescription: 'Hardware kit arrived with mounting screws short by 6 units. Packing slip indicates full quantity was packed. Installation stalled pending replacement.',
    assignee: 'Dana Okonkwo', reportedBy: 'Beaumont C. Okafor', reportedAt: '2026-06-17T10:30:00',
    tags: ['Short Shipping', 'Urgent'],
    partsRequest: [
      { partNumber: '418222-1', quantityType: 'Set', quantity: 1, description: 'Mounting Screw Set — replacement for short-shipped hardware kit. 6-unit deficiency confirmed against packing slip.' },
      { partNumber: '418222-2', quantityType: 'Set', quantity: 1, description: 'Wall Anchor Kit — additional anchors to complete full installation per spec.' },
    ],
    hardwareKit: { kitInfo: 'Standard Hardware Kit', serialNumber: '519003-3', quantityType: 'Set', quantity: 1 },
  },
  {
    id: 'QE_2396', date: '2026-06-17', jobNo: 'SO110015901', dfo: 4, elLine: 3,
    status: 'Reported', rootCause: null,
    branch: 'Cleveland', plant: 'MTC (Mount Comfort)', product: 'Sensors',
    discrepancy: 'Missing Installed Component', door: 'IS 10000',
    issueDescription: 'IS 10000 sensor package missing activation sensor at delivery. Only the presence sensor was included. Activation sensor is listed on the packing slip.',
    assignee: 'Priya Sharma', reportedBy: 'Wilhelmina T. Horton', reportedAt: '2026-06-17T13:05:00',
    additionalInfoRequested: true,
    additionalInfoNote: 'Please confirm which sensor model is installed at the sister opening on the same job, and attach a photo of the packing slip.',
    partsRequest: [
      { partNumber: '425902-1', quantityType: 'Piece', quantity: 1, description: 'Activation Sensor Assembly — missing from IS 10000 sensor package as delivered. Required to complete the opening.' },
    ],
    hardwareKit: { kitInfo: 'IS 10000 Sensor Kit', serialNumber: '519004-4', quantityType: 'Piece', quantity: 1 },
  },
  {
    id: 'QE_2397', date: '2026-06-18', jobNo: 'WO110016344', dfo: 1,
    status: 'Under Investigation', rootCause: null,
    branch: 'Orlando', plant: 'FAR (Farmington)', product: 'Complete Door Package',
    discrepancy: 'Incorrect Build', door: 'Dura_Glide 5200',
    issueDescription: 'Door package delivered with a right-hand operator. Job specification clearly calls for left-hand. Unit cannot be installed as delivered; customer has a hard installation deadline.',
    assignee: 'Elliot Vance', reportedBy: 'Montgomery C. Wallace', reportedAt: '2026-06-18T07:55:00',
    tags: ['Build Error', 'Urgent'],
    additionalInfoRequested: true,
    additionalInfoNote: 'Can you confirm the hand-of-door spec on the original order paperwork and send a photo of the unit label as delivered?',
    partsRequest: [
      { partNumber: '437110-1', quantityType: 'Piece', quantity: 1, description: 'LH Operator Assembly — replacement for incorrectly shipped RH operator on Dura-Glide 5200 installation.' },
      { partNumber: '437110-2', quantityType: 'Piece', quantity: 1, description: 'LH Guide Rail Assembly — paired with LH operator; both required for correct hand-of-door installation.' },
    ],
    hardwareKit: { kitInfo: 'Dura-Glide 5200 Operator Kit', serialNumber: '519005-1', quantityType: 'Piece', quantity: 1 },
  },
  {
    id: 'QE_2398', date: '2026-06-18', jobNo: 'SO110017512', dfo: 2, elLine: 1,
    status: 'Validated', rootCause: 'Factory Issue',
    branch: 'Detroit', plant: 'MTC (Mount Comfort)', product: 'Glass',
    discrepancy: 'Visual', door: 'All Glass 2000',
    issueDescription: 'Glass panel has a stress fracture originating at the top drill location. Fracture propagated after thermal cycling during morning sun exposure. Full panel replacement required.',
    assignee: 'Jordan Takeda', reportedBy: 'Bartholomew R. Sinclair', reportedAt: '2026-06-18T10:20:00',
    tags: ['Glass', 'Factory'],
    partsRequest: [
      { partNumber: '440222-1', quantityType: 'Piece', quantity: 1, description: 'Tempered Glass Panel — replacement for factory-defective panel with stress fracture from lot #GP-0618.' },
      { partNumber: '440222-2', quantityType: 'Piece', quantity: 2, description: 'Glass Retainer Clips — replacement clips to ensure correct panel seating on re-installation.' },
    ],
    hardwareKit: { kitInfo: 'All Glass 2000 Panel Kit', serialNumber: '519006-2', quantityType: 'Piece', quantity: 1 },
  },
  {
    id: 'QE_2399', date: '2026-06-18', jobNo: 'SO110018765', dfo: 1, elLine: 2,
    status: 'Reported', rootCause: null,
    branch: 'Salt Lake City', plant: 'FAR (Farmington)', product: 'Threshold',
    discrepancy: 'Machining', door: 'Dura_Storm',
    issueDescription: 'Threshold profile is 2.1mm undersized at the center span, creating a visible light gap. Does not meet weather seal performance spec for Dura-Storm installation.',
    assignee: 'Cameron Reyes', reportedBy: 'Evangeline C. Holbrook', reportedAt: '2026-06-18T14:35:00',
    partsRequest: [
      { partNumber: '435671-1', quantityType: 'Piece', quantity: 1, description: 'Threshold Profile — replacement for undersized Dura-Storm profile; 2.1mm shortfall at center confirmed by field caliper measurement.' },
    ],
    hardwareKit: { kitInfo: 'Dura-Storm Threshold Kit', serialNumber: '519007-1', quantityType: 'Set', quantity: 1 },
  },
  {
    id: 'QE_2400', date: '2026-06-20', jobNo: 'SO110019023', dfo: 2, elLine: 1,
    status: 'Validated', rootCause: 'Configuration Problem',
    branch: 'New Orleans', plant: 'FAR (Farmington)', product: 'Controller',
    discrepancy: 'Incorrect Build', door: 'Magic Access',
    issueDescription: 'Controllers configured for 24V operation but job specification requires 12V. Units cannot be reprogrammed in the field without a factory reset tool. Both units from same FAR build run.',
    assignee: 'Dana Okonkwo', reportedBy: 'Archibald M. Tran', reportedAt: '2026-06-20T08:10:00',
    tags: ['Controller', 'Build Error'],
    partsRequest: [
      { partNumber: '421035-1', quantityType: 'Piece', quantity: 2, description: 'Controller PCB Assembly — 12VDC replacement for two controllers incorrectly configured for 24V on Magic Access installation.' },
      { partNumber: '421035-2', quantityType: 'Set', quantity: 2, description: 'Controller Mounting Bracket — replacement mounting hardware for clean re-installation of correct units.' },
    ],
    hardwareKit: { kitInfo: 'Magic Access Controller Kit', serialNumber: '519008-2', quantityType: 'Piece', quantity: 2 },
  },
  {
    id: 'QE_2401', date: '2026-06-20', jobNo: 'WO110020198', dfo: 3,
    status: 'Under Investigation', rootCause: null,
    branch: 'Indianapolis', plant: 'MTC (Mount Comfort)', product: 'Header',
    discrepancy: 'Loose Component', door: 'Dura_Glide 2000 Series',
    issueDescription: 'Header end cap is separating from the housing during door operation. Audible rattle present; end cap can be manually displaced without tools. Retainer clip appears undersized.',
    assignee: 'Priya Sharma', reportedBy: 'Dominique A. Marchand', reportedAt: '2026-06-20T09:47:00',
    tags: ['Loose Component'],
    additionalInfoRequested: true,
    additionalInfoNote: 'Can you confirm the part number stamped on the existing end cap and whether the issue is present on both ends of the header?',
    partsRequest: [
      { partNumber: '447801-1', quantityType: 'Piece', quantity: 2, description: 'End Cap Assembly — both ends loose and separating from header housing on Dura-Glide 2000 Series installation.' },
      { partNumber: '447801-2', quantityType: 'Set', quantity: 1, description: 'Retainer Clip Set — undersized clips causing end cap separation under door vibration load.' },
    ],
    hardwareKit: { kitInfo: 'Dura-Glide 2000 Header Kit', serialNumber: '519009-3', quantityType: 'Piece', quantity: 2 },
  },
  {
    id: 'QE_2402', date: '2026-06-20', jobNo: 'SO110021334', dfo: 1, elLine: 3,
    status: 'Invalidated', rootCause: null,
    branch: 'Atlanta', plant: 'FAR (Farmington)', product: 'Panel',
    discrepancy: 'Visual', door: 'Duraguard 3000',
    issueDescription: 'Field report cited surface discoloration on Duraguard 3000 panel in lower quadrant. On-site inspection confirmed discoloration is protective film residue not removed at installation. No manufacturing defect present.',
    assignee: 'Elliot Vance', reportedBy: 'Josephine T. Blanchard', reportedAt: '2026-06-20T11:25:00',
    partsRequest: [
      { partNumber: '450901-1', quantityType: 'Piece', quantity: 1, description: 'Panel Assembly — ordered during initial investigation; order cancelled after event was invalidated.' },
    ],
    hardwareKit: { kitInfo: 'Duraguard 3000 Panel Kit', serialNumber: '519010-1', quantityType: 'Piece', quantity: 1 },
  },
];

export const events: QualityEvent[] = [...SEED_EVENTS, ...generateBulkEvents()]
  .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
