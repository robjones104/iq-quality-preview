export type OrderStatus = 'Open' | 'Closed';

export interface OrderPart {
  seqNo: number;
  hardwareKitInfo?: string;
  serialNumber?: string;
  configId: string;
  dfoLineItem: number;
  door: string;
  partNumber: string;
  quantityType: string;
  quantity: number;
  partDescription: string;
}

export interface Order {
  id: string;
  eventId: string;
  orderStatus: OrderStatus;
  jobNo: string;
  parts: OrderPart[];
  lastUpdated: string;
  approved?: boolean;
  declined?: boolean;
  assignedToProcurement?: boolean;
}

// ── Bulk generator (same xorshift32 pattern as events) ────────────────────

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

const BULK_DOORS = [
  'Dura_Glide 3000 Series', 'Dura_Glide 2000 Series', 'Dura_Glide Greenstar 3000',
  'Procare 8500', 'Procare 8300', 'All Glass 2000', 'M-Force Swing Door',
  'Dura_Glide 5200', 'IS 10000', 'Dura_Storm', 'Magic Access', 'Duraguard 3000',
] as const;

const BULK_PART_DESCS = [
  'Motor Gearbox Assembly', 'Controller PCB Assembly', 'Locking Collar Assembly',
  'Door Closer Spring', 'Glass Panel', 'Sensor Mounting Hardware Kit',
  'Jamb Harness Connector', 'Seal Strip', 'Mounting Screw Set', 'Strike Plate Assembly',
  'Thermal Seal Insert', 'Panel Assembly', 'Threshold Profile', 'Activation Sensor Assembly',
  'LH Operator Assembly', 'Through-Bolt Set', 'Exit Device Strike Plate', 'End Cap Assembly',
] as const;

// Piecewise distribution Jan–Jun 15 2026: 8% Jan–Feb, 17% Mar–Apr, 75% May–Jun 15
function genOrderDate(r: number): string {
  let day: number;
  if (r < 0.08) {
    day = Math.floor(r / 0.08 * 59);
  } else if (r < 0.25) {
    day = 59 + Math.floor((r - 0.08) / 0.17 * 61);
  } else {
    day = 120 + Math.floor((r - 0.25) / 0.75 * 46);
  }
  const d = new Date(2026, 0, 1 + day);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}-2026`;
}

function generateBulkOrders(): Order[] {
  const r = makePrng(0xcafebabe);
  const out: Order[] = [];
  const used = new Set<number>();
  let attempts = 0;

  while (out.length < 80 && attempts < 2000) {
    attempts++;
    const eventNum = 2001 + Math.floor(r() * 300);
    if (used.has(eventNum)) continue;
    used.add(eventNum);

    const dateStr  = genOrderDate(r());
    const h        = 8 + Math.floor(r() * 9);
    const m        = Math.floor(r() * 60);
    const lastUpdated = `${dateStr} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const isClosed   = r() < 0.68;
    const orderStatus: OrderStatus = isClosed ? 'Closed' : 'Open';

    const isApproved = isClosed ? r() < 0.77 : r() < 0.12;
    const isDeclined = !isApproved && isClosed;
    const isProcurement = isApproved && r() < 0.58;

    const jobType = r() < 0.72 ? 'SO' : 'WO';
    const jobNo   = `${jobType}${108000000 + Math.floor(r() * 2000000)}`;

    const partsCount = r() < 0.28 ? 2 : 1;
    const parts: OrderPart[] = Array.from({ length: partsCount }, (_, p) => ({
      seqNo:         p + 1,
      configId:      `${jobNo}.${p + 1}`,
      dfoLineItem:   1 + Math.floor(r() * 4),
      door:          pick(BULK_DOORS, r()),
      partNumber:    `${413000 + Math.floor(r() * 40000)}-${1 + Math.floor(r() * 3)}`,
      quantityType:  r() < 0.85 ? 'Piece' : 'Length',
      quantity:      1 + Math.floor(r() * 4),
      partDescription: `${pick(BULK_PART_DESCS, r())} - (STANDARD, NAR)`,
    }));

    out.push({
      id:          `QE_${eventNum}_Order`,
      eventId:     `QE_${eventNum}`,
      orderStatus,
      jobNo,
      parts,
      lastUpdated,
      ...(isApproved    ? { approved: true }               : {}),
      ...(isDeclined    ? { declined: true }               : {}),
      ...(isProcurement ? { assignedToProcurement: true }  : {}),
    });
  }

  return out;
}

// ── Hand-crafted seed orders (May 24 – Jun 24 2026) ───────────────────────

const HAND_CRAFTED_ORDERS: Order[] = [

  // ── May 24–Jun 5 2026 (original seed) ────────────────────────────────────
  {
    id: 'QE_2392_Order', eventId: 'QE_2392', orderStatus: 'Open', jobNo: 'SO109823809', lastUpdated: '06-05-2026 15:38',
    parts: [
      { seqNo: 1, configId: 'SO109823809.1', dfoLineItem: 1, door: 'Dura_Glide Greenstar 3000', partNumber: '413856-1', quantityType: 'Piece', quantity: 5, partDescription: 'Secondary Mounting Bracket Assembly - (MOTOR GEARBOX, GREENSTAR, NAR)' },
      { seqNo: 2, configId: 'SO109823809.2', dfoLineItem: 1, door: 'Dura_Glide Greenstar 3000', partNumber: '413856-2', quantityType: 'Piece', quantity: 1, partDescription: 'Fastener Kit - (M-SERIES, ZINC, NAR)' },
      { seqNo: 3, configId: 'SO109823809.3', dfoLineItem: 1, door: 'Dura_Glide Greenstar 3000', partNumber: '413856-3', quantityType: 'Length', quantity: 48, partDescription: 'Seal Strip - (GREENSTAR, BOTTOM, NAR)' },
    ],
  },
  {
    id: 'QE_2391_Order', eventId: 'QE_2391', orderStatus: 'Open', jobNo: 'SO109821456', lastUpdated: '06-04-2026 11:22',
    parts: [
      { seqNo: 1, configId: 'SO109821456.1', dfoLineItem: 2, door: 'Dura_Glide Greenstar 3000', partNumber: '413857-2', quantityType: 'Piece', quantity: 1, partDescription: 'Motor Gearbox Assembly - (STANDARD, 24V, NAR)' },
    ],
  },
  {
    id: 'QE_2388_Order', eventId: 'QE_2388', orderStatus: 'Closed', jobNo: 'SO109819034', lastUpdated: '06-03-2026 09:14', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO109819034.1', dfoLineItem: 1, door: 'Dura_Glide 3000 Series', partNumber: '413858-3', quantityType: 'Piece', quantity: 1, partDescription: 'Motor Gearbox Assembly - (VARIANT A, 24V, NAR)' },
    ],
  },
  {
    id: 'QE_2385_Order', eventId: 'QE_2385', orderStatus: 'Closed', jobNo: 'SO109816772', lastUpdated: '06-03-2026 14:55', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO109816772.1', dfoLineItem: 1, door: 'Dura_Glide 3000 Series', partNumber: '421033-1', quantityType: 'Piece', quantity: 3, partDescription: 'Controller PCB Assembly - (STANDARD, 24VDC, NAR)' },
    ],
  },
  {
    id: 'QE_2381_Order', eventId: 'QE_2381', orderStatus: 'Open', jobNo: 'SO109814401', lastUpdated: '06-02-2026 16:07', approved: true,
    parts: [
      { seqNo: 1, configId: 'SO109814401.1', dfoLineItem: 4, door: 'Dura_Glide 2000 Series', partNumber: '418220-1', quantityType: 'Piece', quantity: 2, partDescription: 'Locking Collar Assembly - (STANDARD, SS, NAR)' },
    ],
  },
  {
    id: 'QE_2379_Order', eventId: 'QE_2379', orderStatus: 'Closed', jobNo: 'SO109812088', lastUpdated: '06-02-2026 08:31', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO109812088.1', dfoLineItem: 2, door: 'Procare 8500', partNumber: '430114-1', quantityType: 'Piece', quantity: 1, partDescription: 'Door Closer Spring - (STANDARD DUTY, SIZE 4, NAR)' },
      { seqNo: 2, configId: 'SO109812088.2', dfoLineItem: 2, door: 'Procare 8500', partNumber: '430114-2', quantityType: 'Piece', quantity: 1, partDescription: 'Strike Plate Assembly - (ANSI, SS, NAR)' },
    ],
  },
  {
    id: 'QE_2376_Order', eventId: 'QE_2376', orderStatus: 'Closed', jobNo: 'SO109809755', lastUpdated: '06-01-2026 12:44', declined: true,
    parts: [
      { seqNo: 1, configId: 'SO109809755.1', dfoLineItem: 1, door: 'Dura_Glide 5200', partNumber: '425901-1', quantityType: 'Piece', quantity: 1, partDescription: 'Sensor Mounting Hardware Kit - (STANDARD, NAR)' },
    ],
  },
  {
    id: 'QE_2373_Order', eventId: 'QE_2373', orderStatus: 'Closed', jobNo: 'SO109807412', lastUpdated: '05-31-2026 17:19', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO109807412.1', dfoLineItem: 3, door: 'All Glass 2000', partNumber: '440221-1', quantityType: 'Piece', quantity: 1, partDescription: 'Glass Panel - (TEMPERED, CLEAR, NAR)' },
    ],
  },
  {
    id: 'QE_2370_Order', eventId: 'QE_2370', orderStatus: 'Open', jobNo: 'WO109805099', lastUpdated: '05-30-2026 10:02',
    parts: [
      { seqNo: 1, configId: 'WO109805099.1', dfoLineItem: 2, door: 'Dura_Glide 2000 Series', partNumber: '421033-2', quantityType: 'Piece', quantity: 6, partDescription: 'Controller PCB Assembly - (FIRMWARE V2.1, 24VDC, NAR)' },
    ],
  },
  {
    id: 'QE_2367_Order', eventId: 'QE_2367', orderStatus: 'Closed', jobNo: 'SO109802736', lastUpdated: '05-29-2026 13:48', approved: true,
    parts: [
      { seqNo: 1, configId: 'SO109802736.1', dfoLineItem: 1, door: 'Dura_Glide Greenstar 3000', partNumber: '435670-1', quantityType: 'Piece', quantity: 1, partDescription: 'Thermal Seal Insert - (HIGH TEMP, GREENSTAR, NAR)' },
      { seqNo: 2, configId: 'SO109802736.2', dfoLineItem: 1, door: 'Dura_Glide Greenstar 3000', partNumber: '435670-2', quantityType: 'Piece', quantity: 2, partDescription: 'Air Infiltration Blocks - (LEAD STILE, SO/O, NAR)' },
    ],
  },
  {
    id: 'QE_2364_Order', eventId: 'QE_2364', orderStatus: 'Closed', jobNo: 'SO109800423', lastUpdated: '05-28-2026 09:33', declined: true,
    parts: [
      { seqNo: 1, configId: 'SO109800423.1', dfoLineItem: 4, door: 'M-Force Swing Door', partNumber: '418221-1', quantityType: 'Piece', quantity: 1, partDescription: 'Through-Bolt Set - (HM FRAME, 3/8IN, NAR)' },
    ],
  },
  {
    id: 'QE_2361_Order', eventId: 'QE_2361', orderStatus: 'Open', jobNo: 'WO109798110', lastUpdated: '05-27-2026 15:21',
    parts: [
      { seqNo: 1, configId: 'WO109798110.1', dfoLineItem: 1, door: 'Dura_Glide 3000 Series', partNumber: '444512-1', quantityType: 'Piece', quantity: 1, partDescription: 'Jamb Harness Connector - (STANDARD, IP65, NAR)' },
    ],
  },
  {
    id: 'QE_2358_Order', eventId: 'QE_2358', orderStatus: 'Closed', jobNo: 'SO109795847', lastUpdated: '05-26-2026 11:05', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO109795847.1', dfoLineItem: 2, door: 'Procare 8300', partNumber: '421034-1', quantityType: 'Piece', quantity: 24, partDescription: 'Controller PCB Assembly - (FIRMWARE V1.8, 24VDC, NAR)' },
    ],
  },
  {
    id: 'QE_2355_Order', eventId: 'QE_2355', orderStatus: 'Open', jobNo: 'SO109793534', lastUpdated: '05-25-2026 08:57',
    parts: [
      { seqNo: 1, configId: 'SO109793534.1', dfoLineItem: 3, door: 'Dura_Glide Greenstar 3000', partNumber: '413859-1', quantityType: 'Piece', quantity: 4, partDescription: 'Motor Gearbox Assembly - (BATCH MG-4412, 24V, NAR)' },
    ],
  },
  {
    id: 'QE_2352_Order', eventId: 'QE_2352', orderStatus: 'Open', jobNo: 'SO109791221', lastUpdated: '05-24-2026 14:43',
    parts: [
      { seqNo: 1, configId: 'SO109791221.1', dfoLineItem: 1, door: 'Dura_Glide 2000 Series', partNumber: '430115-1', quantityType: 'Piece', quantity: 1, partDescription: 'Exit Device Strike Plate - (ANSI A115.2, SS, NAR)' },
    ],
  },

  // ── Jun 16–20 2026 ────────────────────────────────────────────────────────
  {
    id: 'QE_2403_Order', eventId: 'QE_2393', orderStatus: 'Open', jobNo: 'SO110011201', lastUpdated: '06-16-2026 09:12',
    parts: [
      { seqNo: 1, configId: 'SO110011201.1', dfoLineItem: 1, door: 'Dura_Glide 3000 Series', partNumber: '413856-1', quantityType: 'Piece', quantity: 2, partDescription: 'Motor Gearbox Assembly - (STANDARD, 24V, NAR)' },
    ],
  },
  {
    id: 'QE_2404_Order', eventId: 'QE_2394', orderStatus: 'Closed', jobNo: 'SO110011898', lastUpdated: '06-16-2026 14:35', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO110011898.1', dfoLineItem: 2, door: 'Procare 8500', partNumber: '430114-1', quantityType: 'Piece', quantity: 1, partDescription: 'Door Closer Spring - (STANDARD DUTY, SIZE 3, NAR)' },
    ],
  },
  {
    id: 'QE_2405_Order', eventId: 'QE_2395', orderStatus: 'Closed', jobNo: 'SO110012544', lastUpdated: '06-16-2026 16:48', declined: true,
    parts: [
      { seqNo: 1, configId: 'SO110012544.1', dfoLineItem: 1, door: 'Dura_Glide 2000 Series', partNumber: '421033-1', quantityType: 'Piece', quantity: 1, partDescription: 'Controller PCB Assembly - (STANDARD, 24VDC, NAR)' },
    ],
  },
  {
    id: 'QE_2393_Order', eventId: 'QE_2393', orderStatus: 'Open', jobNo: 'SO110012345', lastUpdated: '06-17-2026 08:20',
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Entire Hardware Kit', serialNumber: '519001-2', configId: 'SO110012345.1', dfoLineItem: 2, door: 'Dura_Glide Greenstar 2000', partNumber: '421033-3', quantityType: 'Piece', quantity: 2, partDescription: 'Controller PCB Assembly - (FIRMWARE V3.0, 24VDC, NAR)' },
      { seqNo: 2, configId: 'SO110012345.2', dfoLineItem: 2, door: 'Dura_Glide Greenstar 2000', partNumber: '421033-4', quantityType: 'Piece', quantity: 2, partDescription: 'Controller Wiring Harness - (24V, IP65, NAR)' },
    ],
  },
  {
    id: 'QE_2394_Order', eventId: 'QE_2394', orderStatus: 'Open', jobNo: 'WO110013412', lastUpdated: '06-17-2026 09:48',
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Entire Hardware Kit', serialNumber: '519002-1', configId: 'WO110013412.1', dfoLineItem: 1, door: 'Dura_Glide 3000 Series', partNumber: '413856-3', quantityType: 'Piece', quantity: 1, partDescription: 'Motor Gearbox Assembly - (DURA-GLIDE 3000, 24V, NAR)' },
    ],
  },
  {
    id: 'QE_2395_Order', eventId: 'QE_2395', orderStatus: 'Closed', jobNo: 'SO110014789', lastUpdated: '06-17-2026 10:38', approved: true,
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Entire Hardware Kit', serialNumber: '519003-3', configId: 'SO110014789.1', dfoLineItem: 3, door: 'Procare 8300 A', partNumber: '418222-1', quantityType: 'Piece', quantity: 1, partDescription: 'Mounting Screw Set - (M6 HEX, SS, NAR)' },
      { seqNo: 2, configId: 'SO110014789.2', dfoLineItem: 3, door: 'Procare 8300 A', partNumber: '418222-2', quantityType: 'Piece', quantity: 1, partDescription: 'Wall Anchor Kit - (TOGGLE BOLT, 3/8IN, NAR)' },
    ],
  },
  {
    id: 'QE_2396_Order', eventId: 'QE_2396', orderStatus: 'Open', jobNo: 'SO110015901', lastUpdated: '06-17-2026 13:12', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Entire Hardware Kit', serialNumber: '519004-4', configId: 'SO110015901.1', dfoLineItem: 4, door: 'IS 10000', partNumber: '425902-1', quantityType: 'Piece', quantity: 1, partDescription: 'Activation Sensor Assembly - (IS 10000, STANDARD, NAR)' },
    ],
  },
  {
    id: 'QE_2397_Order', eventId: 'QE_2397', orderStatus: 'Open', jobNo: 'WO110016344', lastUpdated: '06-18-2026 08:02',
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Components within Hardware Kit', serialNumber: '519005-1', configId: 'WO110016344.1', dfoLineItem: 1, door: 'Dura_Glide 5200', partNumber: '437110-1', quantityType: 'Piece', quantity: 1, partDescription: 'LH Operator Assembly - (DURA-GLIDE 5200, LH, NAR)' },
      { seqNo: 2, configId: 'WO110016344.2', dfoLineItem: 1, door: 'Dura_Glide 5200', partNumber: '437110-2', quantityType: 'Piece', quantity: 1, partDescription: 'LH Guide Rail Assembly - (DURA-GLIDE 5200, 1200MM, NAR)' },
    ],
  },
  {
    id: 'QE_2398_Order', eventId: 'QE_2398', orderStatus: 'Closed', jobNo: 'SO110017512', lastUpdated: '06-18-2026 10:28', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Components within Hardware Kit', serialNumber: '519006-2', configId: 'SO110017512.1', dfoLineItem: 2, door: 'All Glass 2000', partNumber: '440222-1', quantityType: 'Piece', quantity: 1, partDescription: 'Tempered Glass Panel - (ALL GLASS 2000, CLEAR, NAR)' },
      { seqNo: 2, configId: 'SO110017512.2', dfoLineItem: 2, door: 'All Glass 2000', partNumber: '440222-2', quantityType: 'Piece', quantity: 2, partDescription: 'Glass Retainer Clip - (STANDARD, SS, NAR)' },
    ],
  },
  {
    id: 'QE_2399_Order', eventId: 'QE_2399', orderStatus: 'Open', jobNo: 'SO110018765', lastUpdated: '06-18-2026 14:42',
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Entire Hardware Kit', serialNumber: '519007-1', configId: 'SO110018765.1', dfoLineItem: 1, door: 'Dura_Storm', partNumber: '435671-1', quantityType: 'Piece', quantity: 1, partDescription: 'Threshold Profile - (DURA-STORM, STANDARD, NAR)' },
    ],
  },
  {
    id: 'QE_2406_Order', eventId: 'QE_2399', orderStatus: 'Closed', jobNo: 'SO110019112', lastUpdated: '06-19-2026 09:27', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO110019112.1', dfoLineItem: 1, door: 'Dura_Glide Greenstar 3000', partNumber: '435670-1', quantityType: 'Piece', quantity: 1, partDescription: 'Thermal Seal Insert - (HIGH TEMP, GREENSTAR, NAR)' },
    ],
  },
  {
    id: 'QE_2407_Order', eventId: 'QE_2398', orderStatus: 'Open', jobNo: 'WO110019445', lastUpdated: '06-19-2026 11:03',
    parts: [
      { seqNo: 1, configId: 'WO110019445.1', dfoLineItem: 2, door: 'Dura_Glide 3000 Series', partNumber: '444512-1', quantityType: 'Piece', quantity: 1, partDescription: 'Jamb Harness Connector - (STANDARD, IP65, NAR)' },
    ],
  },
  {
    id: 'QE_2408_Order', eventId: 'QE_2397', orderStatus: 'Closed', jobNo: 'SO110019780', lastUpdated: '06-19-2026 15:51', declined: true,
    parts: [
      { seqNo: 1, configId: 'SO110019780.1', dfoLineItem: 3, door: 'M-Force Swing Door', partNumber: '418221-1', quantityType: 'Piece', quantity: 1, partDescription: 'Through-Bolt Set - (HM FRAME, 3/8IN, NAR)' },
    ],
  },
  {
    id: 'QE_2400_Order', eventId: 'QE_2400', orderStatus: 'Closed', jobNo: 'SO110019023', lastUpdated: '06-20-2026 10:02', approved: true,
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Components within Hardware Kit', serialNumber: '519008-2', configId: 'SO110019023.1', dfoLineItem: 2, door: 'Magic Access', partNumber: '421035-1', quantityType: 'Piece', quantity: 2, partDescription: 'Controller PCB Assembly - (MAGIC ACCESS, 12VDC, NAR)' },
      { seqNo: 2, configId: 'SO110019023.2', dfoLineItem: 2, door: 'Magic Access', partNumber: '421035-2', quantityType: 'Piece', quantity: 2, partDescription: 'Controller Mounting Bracket - (MAGIC ACCESS, STANDARD, NAR)' },
    ],
  },
  {
    id: 'QE_2401_Order', eventId: 'QE_2401', orderStatus: 'Open', jobNo: 'WO110020198', lastUpdated: '06-20-2026 09:54',
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Components within Hardware Kit', serialNumber: '519009-3', configId: 'WO110020198.1', dfoLineItem: 3, door: 'Dura_Glide 2000 Series', partNumber: '447801-1', quantityType: 'Piece', quantity: 2, partDescription: 'End Cap Assembly - (DURA-GLIDE 2000, ANODIZED, NAR)' },
      { seqNo: 2, configId: 'WO110020198.2', dfoLineItem: 3, door: 'Dura_Glide 2000 Series', partNumber: '447801-2', quantityType: 'Piece', quantity: 1, partDescription: 'Retainer Clip Set - (HEADER END CAP, SS, NAR)' },
    ],
  },
  {
    id: 'QE_2402_Order', eventId: 'QE_2402', orderStatus: 'Closed', jobNo: 'SO110021334', lastUpdated: '06-20-2026 11:32', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, hardwareKitInfo: 'Entire Hardware Kit', serialNumber: '519010-1', configId: 'SO110021334.1', dfoLineItem: 1, door: 'Duraguard 3000', partNumber: '450901-1', quantityType: 'Piece', quantity: 1, partDescription: 'Panel Assembly - (DURAGUARD 3000, ANODIZED, NAR)' },
    ],
  },

  // ── Jun 21–24 2026 ────────────────────────────────────────────────────────
  {
    id: 'QE_2409_Order', eventId: 'QE_2401', orderStatus: 'Closed', jobNo: 'SO110022101', lastUpdated: '06-21-2026 09:18', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO110022101.1', dfoLineItem: 1, door: 'Dura_Glide Greenstar 3000', partNumber: '413856-2', quantityType: 'Piece', quantity: 1, partDescription: 'Fastener Kit - (M-SERIES, ZINC, NAR)' },
    ],
  },
  {
    id: 'QE_2410_Order', eventId: 'QE_2402', orderStatus: 'Open', jobNo: 'WO110022498', lastUpdated: '06-21-2026 13:44',
    parts: [
      { seqNo: 1, configId: 'WO110022498.1', dfoLineItem: 2, door: 'Dura_Glide 5200', partNumber: '437110-1', quantityType: 'Piece', quantity: 1, partDescription: 'LH Operator Assembly - (DURA-GLIDE 5200, LH, NAR)' },
    ],
  },
  {
    id: 'QE_2411_Order', eventId: 'QE_2400', orderStatus: 'Closed', jobNo: 'SO110022895', lastUpdated: '06-22-2026 08:55', declined: true,
    parts: [
      { seqNo: 1, configId: 'SO110022895.1', dfoLineItem: 3, door: 'Procare 8300', partNumber: '421034-1', quantityType: 'Piece', quantity: 2, partDescription: 'Controller PCB Assembly - (FIRMWARE V1.8, 24VDC, NAR)' },
    ],
  },
  {
    id: 'QE_2412_Order', eventId: 'QE_2399', orderStatus: 'Closed', jobNo: 'SO110023292', lastUpdated: '06-22-2026 11:30', approved: true,
    parts: [
      { seqNo: 1, configId: 'SO110023292.1', dfoLineItem: 1, door: 'All Glass 2000', partNumber: '440221-1', quantityType: 'Piece', quantity: 1, partDescription: 'Glass Panel - (TEMPERED, CLEAR, NAR)' },
    ],
  },
  {
    id: 'QE_2413_Order', eventId: 'QE_2396', orderStatus: 'Open', jobNo: 'SO110023689', lastUpdated: '06-22-2026 15:07',
    parts: [
      { seqNo: 1, configId: 'SO110023689.1', dfoLineItem: 2, door: 'IS 10000', partNumber: '425902-1', quantityType: 'Piece', quantity: 1, partDescription: 'Activation Sensor Assembly - (IS 10000, STANDARD, NAR)' },
    ],
  },
  {
    id: 'QE_2414_Order', eventId: 'QE_2394', orderStatus: 'Open', jobNo: 'WO110024086', lastUpdated: '06-23-2026 08:33',
    parts: [
      { seqNo: 1, configId: 'WO110024086.1', dfoLineItem: 1, door: 'Dura_Glide 3000 Series', partNumber: '413856-3', quantityType: 'Piece', quantity: 2, partDescription: 'Motor Gearbox Assembly - (DURA-GLIDE 3000, 24V, NAR)' },
    ],
  },
  {
    id: 'QE_2415_Order', eventId: 'QE_2393', orderStatus: 'Closed', jobNo: 'SO110024483', lastUpdated: '06-23-2026 10:19', approved: true, assignedToProcurement: true,
    parts: [
      { seqNo: 1, configId: 'SO110024483.1', dfoLineItem: 2, door: 'Dura_Glide Greenstar 2000', partNumber: '421033-3', quantityType: 'Piece', quantity: 1, partDescription: 'Controller PCB Assembly - (FIRMWARE V3.0, 24VDC, NAR)' },
    ],
  },
  {
    id: 'QE_2416_Order', eventId: 'QE_2397', orderStatus: 'Open', jobNo: 'WO110024880', lastUpdated: '06-23-2026 14:52',
    parts: [
      { seqNo: 1, configId: 'WO110024880.1', dfoLineItem: 1, door: 'Dura_Glide 5200', partNumber: '437110-2', quantityType: 'Piece', quantity: 1, partDescription: 'LH Guide Rail Assembly - (DURA-GLIDE 5200, 1200MM, NAR)' },
      { seqNo: 2, configId: 'WO110024880.2', dfoLineItem: 1, door: 'Dura_Glide 5200', partNumber: '437110-1', quantityType: 'Piece', quantity: 1, partDescription: 'LH Operator Assembly - (DURA-GLIDE 5200, LH, NAR)' },
    ],
  },
  {
    id: 'QE_2417_Order', eventId: 'QE_2392', orderStatus: 'Open', jobNo: 'SO110025277', lastUpdated: '06-24-2026 08:14',
    parts: [
      { seqNo: 1, configId: 'SO110025277.1', dfoLineItem: 1, door: 'Dura_Glide Greenstar 3000', partNumber: '413856-1', quantityType: 'Piece', quantity: 3, partDescription: 'Secondary Mounting Bracket Assembly - (MOTOR GEARBOX, GREENSTAR, NAR)' },
    ],
  },
  {
    id: 'QE_2418_Order', eventId: 'QE_2395', orderStatus: 'Closed', jobNo: 'SO110025674', lastUpdated: '06-24-2026 10:45', approved: true,
    parts: [
      { seqNo: 1, configId: 'SO110025674.1', dfoLineItem: 3, door: 'Procare 8300 A', partNumber: '418222-1', quantityType: 'Piece', quantity: 1, partDescription: 'Mounting Screw Set - (M6 HEX, SS, NAR)' },
    ],
  },
  {
    id: 'QE_2419_Order', eventId: 'QE_2391', orderStatus: 'Open', jobNo: 'WO110026071', lastUpdated: '06-24-2026 13:28',
    parts: [
      { seqNo: 1, configId: 'WO110026071.1', dfoLineItem: 2, door: 'Dura_Glide Greenstar 3000', partNumber: '413857-2', quantityType: 'Piece', quantity: 1, partDescription: 'Motor Gearbox Assembly - (STANDARD, 24V, NAR)' },
    ],
  },
];

export const orders: Order[] = [...generateBulkOrders(), ...HAND_CRAFTED_ORDERS];
