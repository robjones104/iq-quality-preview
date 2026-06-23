import type { ActivityLog, EventStatus } from './types';

const roles = [
  'Field Quality',
  'Customer Service',
  'Procurement',
  'Branch View-Only',
  'App Manager',
  'Field Technician',
];

const employees = [
  'Ava J. Elizabeth Thompson',
  'Marcus T.',
  'Sarah M.',
  'Tom W.',
  'Nina B.',
  'Kevin L.',
  'Daniel R.',
  'Lisa P.',
  'Chris A.',
  'Maria G.',
];

const statusProgression: EventStatus[] = [
  'Reported',
  'Under Investigation',
  'Validated',
  'Invalidated',
];

const comments = [
  'Event reported via mobile field app. Configuration ID verified against order manifest.',
  'Initial triage complete. Escalated to regional quality lead for supplier analysis.',
  'Root cause identified as supplier batch inconsistency. Parts request submitted.',
  'Replacement parts received and verified against configuration spec. Installation rescheduled.',
  'On-site inspection completed. Photographic evidence captured and uploaded.',
  'Supplier contacted. Awaiting RMA confirmation and replacement shipment ETA.',
  'Validated against L4 configuration spec. Issue confirmed as manufacturing non-conformance.',
  'Closed after successful re-installation. Customer sign-off obtained. No further action required.',
  'Duplicate event merged with QE_2355. Root cause analysis consolidated.',
  'Hardware kit inspected. Secondary component identified as out-of-spec by 2.3mm. Supplier notified.',
  'Field technician dispatched for on-site verification. Estimated resolution: 48 hours.',
  'Status updated following quality review board assessment. Root cause confirmed.',
  'Parts order confirmed with warehouse. Expected delivery within 3 business days.',
  'Customer notified of delay. Alternative temporary solution implemented pending part arrival.',
  'Post-resolution audit completed. Corrective action documented in supplier quality file.',
  'Event linked to open escalation ESC_0047. See escalation for supplier correspondence.',
  'Configuration ID cross-referenced with order history. Discrepancy confirmed at intake.',
  'Installation video reviewed. Non-conformance attributed to technician training gap. CAP initiated.',
  'Batch recall recommended pending broader supplier audit. Regional manager notified.',
  'Event closed per quality review. No systemic issue identified. Isolated incident confirmed.',
];

function generateLogs(): ActivityLog[] {
  const logs: ActivityLog[] = [];
  const eventIds = [
    'QE_2392', 'QE_2391', 'QE_2388', 'QE_2385', 'QE_2381',
    'QE_2379', 'QE_2376', 'QE_2373', 'QE_2370', 'QE_2367',
    'QE_2364', 'QE_2361', 'QE_2358', 'QE_2355', 'QE_2352',
  ];

  let logDate = new Date('2026-06-05T16:00:00');

  for (let i = 0; i < 100; i++) {
    const eventIdx = i % eventIds.length;
    const statusIdx = Math.min(Math.floor(i / 4) % statusProgression.length, statusProgression.length - 1);
    const roleIdx = i % roles.length;
    const empIdx = i % employees.length;
    const commentIdx = i % comments.length;

    logs.push({
      id: `LOG_${String(1000 + i).padStart(4, '0')}`,
      eventId: eventIds[eventIdx],
      date: logDate.toISOString().replace('T', ' ').substring(0, 16),
      role: roles[roleIdx],
      employee: employees[empIdx],
      status: statusProgression[statusIdx],
      comment: comments[commentIdx],
    });

    logDate = new Date(logDate.getTime() - 2 * 60 * 60 * 1000);
  }

  return logs;
}

const SEED_LOGS: ActivityLog[] = [
  // QE_2393 — Baltimore, Controller, Will not Operate (Reported)
  { id: 'LOG_1100', eventId: 'QE_2393', date: '2026-06-17 08:15', role: 'Field Technician', employee: 'Raymond J. Caldwell', status: 'Reported', comment: 'Event reported via mobile field app. Two controllers failed power-on self-test. Serial numbers and lot #ECB-2309 documented on-site.' },
  { id: 'LOG_1101', eventId: 'QE_2393', date: '2026-06-17 08:30', role: 'Field Quality', employee: 'Marcus Brooks', status: 'Reported', comment: 'Initial review complete. Event flagged for hardware investigation. Parts request initiated for 2 controller PCB replacements and paired wiring harnesses.' },
  { id: 'LOG_1102', eventId: 'QE_2393', date: '2026-06-17 09:15', role: 'Customer Service', employee: 'Ava J. Elizabeth Thompson', status: 'Reported', comment: 'Parts request received. Order QE_2393_Order opened and submitted to warehouse.' },
  { id: 'LOG_1103', eventId: 'QE_2393', date: '2026-06-17 10:00', role: 'Field Quality', employee: 'Marcus Brooks', status: 'Reported', comment: 'Supplier contacted regarding batch #ECB-2309. Awaiting confirmation of defect scope before escalating status to Under Investigation.' },

  // QE_2394 — Denver, Motor Gearbox, Freight Damage (Under Investigation)
  { id: 'LOG_1104', eventId: 'QE_2394', date: '2026-06-17 09:42', role: 'Field Technician', employee: 'Cordelia M. Fontaine', status: 'Reported', comment: 'Event reported via mobile field app. Motor gearbox housing cracked along casting seam. Unit unable to be powered up. Photos of unit attached.' },
  { id: 'LOG_1105', eventId: 'QE_2394', date: '2026-06-17 10:05', role: 'Field Quality', employee: 'Sarah Mitchell', status: 'Reported', comment: 'Triage complete. Damage pattern consistent with lateral transit impact. Status set to Under Investigation. Awaiting shipping carton photos for freight claim.' },
  { id: 'LOG_1106', eventId: 'QE_2394', date: '2026-06-17 10:30', role: 'Field Quality', employee: 'Sarah Mitchell', status: 'Under Investigation', comment: 'Additional information requested from field technician: photos of original shipping carton required to document transit damage for supplier claim.' },
  { id: 'LOG_1107', eventId: 'QE_2394', date: '2026-06-17 11:45', role: 'Customer Service', employee: 'Maria G.', status: 'Under Investigation', comment: 'Replacement gearbox order opened. On hold pending freight claim resolution before finalizing quantity and shipment priority.' },
  { id: 'LOG_1108', eventId: 'QE_2394', date: '2026-06-17 14:00', role: 'Field Quality', employee: 'Sarah Mitchell', status: 'Under Investigation', comment: 'Supplier freight claim #FC-20264471 filed with MTC logistics. Estimated replacement unit ETA is 5 business days pending claim approval.' },

  // QE_2395 — St.Louis, Hardware Kit, Short Shipping (Validated)
  { id: 'LOG_1109', eventId: 'QE_2395', date: '2026-06-17 10:30', role: 'Field Technician', employee: 'Beaumont C. Okafor', status: 'Reported', comment: 'Event reported via mobile field app. Hardware kit short by 6 mounting screws. Packing slip indicates full quantity was packed. Installation halted.' },
  { id: 'LOG_1110', eventId: 'QE_2395', date: '2026-06-17 10:55', role: 'Field Quality', employee: 'Tyler Richardson', status: 'Reported', comment: 'Packing slip cross-referenced with order manifest. Short-ship discrepancy confirmed. FAR plant packing station flagged for audit.' },
  { id: 'LOG_1111', eventId: 'QE_2395', date: '2026-06-17 11:20', role: 'Field Quality', employee: 'Tyler Richardson', status: 'Under Investigation', comment: 'FAR plant quality team notified. Investigating whether packing station miscounted or order was picked short at warehouse.' },
  { id: 'LOG_1112', eventId: 'QE_2395', date: '2026-06-17 12:10', role: 'Field Quality', employee: 'Tyler Richardson', status: 'Validated', comment: 'Root cause confirmed as short shipping at FAR packing station. Corrective action submitted. Packing checklist update requested for this SKU.' },
  { id: 'LOG_1113', eventId: 'QE_2395', date: '2026-06-17 12:30', role: 'Customer Service', employee: 'Ava J. Elizabeth Thompson', status: 'Validated', comment: 'Replacement screw set and anchor kit order approved. Parts dispatched from warehouse. Estimated delivery tomorrow morning.' },

  // QE_2396 — Cleveland, Sensors, Missing Installed Component (Reported)
  { id: 'LOG_1114', eventId: 'QE_2396', date: '2026-06-17 13:05', role: 'Field Technician', employee: 'Wilhelmina T. Horton', status: 'Reported', comment: 'Event reported via mobile field app. IS 10000 sensor package missing activation sensor. Only presence sensor found in box. Packing slip attached.' },
  { id: 'LOG_1115', eventId: 'QE_2396', date: '2026-06-17 13:22', role: 'Field Quality', employee: 'Nicole Bennett', status: 'Reported', comment: 'Initial review complete. Packing slip confirms both sensors should be included. Additional info requested from field: sensor model at sister opening.' },
  { id: 'LOG_1116', eventId: 'QE_2396', date: '2026-06-17 14:00', role: 'Customer Service', employee: 'Lisa P.', status: 'Reported', comment: 'Parts order opened for activation sensor replacement. Order on hold pending field confirmation of sensor model compatibility.' },
  { id: 'LOG_1117', eventId: 'QE_2396', date: '2026-06-17 15:30', role: 'Field Quality', employee: 'Nicole Bennett', status: 'Reported', comment: 'No response from field technician as of end of day. Follow-up message sent. Order remains on hold until model confirmed.' },

  // QE_2397 — Orlando, Complete Door Package, Incorrect Build (Under Investigation)
  { id: 'LOG_1118', eventId: 'QE_2397', date: '2026-06-18 07:55', role: 'Field Technician', employee: 'Montgomery C. Wallace', status: 'Reported', comment: 'Event reported via mobile field app. Door package delivered with RH operator. Job spec requires LH. Cannot proceed with installation. Customer has hard deadline.' },
  { id: 'LOG_1119', eventId: 'QE_2397', date: '2026-06-18 08:20', role: 'Field Quality', employee: 'Kevin Martinez', status: 'Reported', comment: 'Order reviewed. Hand-of-door spec confirmed LH on original WO paperwork. Event logged as Incorrect Build and escalated to Under Investigation.' },
  { id: 'LOG_1120', eventId: 'QE_2397', date: '2026-06-18 08:45', role: 'Field Quality', employee: 'Kevin Martinez', status: 'Under Investigation', comment: 'Additional info requested: photo of unit label as delivered and copy of delivery receipt confirming RH shipment for FAR build record.' },
  { id: 'LOG_1121', eventId: 'QE_2397', date: '2026-06-18 10:00', role: 'Customer Service', employee: 'Chris A.', status: 'Under Investigation', comment: 'LH operator and guide rail order opened. Procurement flagged as urgent — customer installation deadline is end of this week.' },
  { id: 'LOG_1122', eventId: 'QE_2397', date: '2026-06-18 11:30', role: 'Field Quality', employee: 'Kevin Martinez', status: 'Under Investigation', comment: 'Orlando branch manager notified of timeline risk. Escalation will be filed if replacement shipment is not confirmed by end of day.' },

  // QE_2398 — Detroit, Glass, Factory Issue (Validated)
  { id: 'LOG_1123', eventId: 'QE_2398', date: '2026-06-18 10:20', role: 'Field Technician', employee: 'Bartholomew R. Sinclair', status: 'Reported', comment: 'Event reported via mobile field app. Stress fracture visible at top drill location on All Glass 2000 panel. Fracture propagated after morning thermal cycling.' },
  { id: 'LOG_1124', eventId: 'QE_2398', date: '2026-06-18 10:45', role: 'Field Quality', employee: 'Sarah Mitchell', status: 'Reported', comment: 'Photos reviewed. Fracture pattern consistent with improper tempering at factory drill point. Initiating factory investigation into glass lot #GP-0618.' },
  { id: 'LOG_1125', eventId: 'QE_2398', date: '2026-06-18 11:10', role: 'Field Quality', employee: 'Sarah Mitchell', status: 'Under Investigation', comment: 'Lot #GP-0618 cross-referenced against shipment records. Same lot used on 3 other jobs this week. Advisory issued to FQ team. Plant quality alerted.' },
  { id: 'LOG_1126', eventId: 'QE_2398', date: '2026-06-18 13:00', role: 'Field Quality', employee: 'Sarah Mitchell', status: 'Validated', comment: 'Root cause confirmed as factory tempering defect at drill penetration. Supplier notified and lot #GP-0618 placed on quality hold pending full audit.' },
  { id: 'LOG_1127', eventId: 'QE_2398', date: '2026-06-18 14:30', role: 'Customer Service', employee: 'Maria G.', status: 'Validated', comment: 'Replacement glass panel and retainer clips received and verified against spec. Order QE_2398_Order closed. Customer notified of resolution.' },

  // QE_2399 — Salt Lake City, Threshold, Machining (Reported)
  { id: 'LOG_1128', eventId: 'QE_2399', date: '2026-06-18 14:35', role: 'Field Technician', employee: 'Evangeline C. Holbrook', status: 'Reported', comment: 'Event reported via mobile field app. Threshold profile undersized at center span. 2.1mm light gap confirmed by caliper measurement. Weather seal fails performance spec.' },
  { id: 'LOG_1129', eventId: 'QE_2399', date: '2026-06-18 14:55', role: 'Field Quality', employee: 'Marcus Brooks', status: 'Reported', comment: 'Field measurements verified. 2.1mm shortfall at center is beyond tolerance. Machining defect suspected at FAR production line. Investigation opened.' },
  { id: 'LOG_1130', eventId: 'QE_2399', date: '2026-06-18 15:30', role: 'Customer Service', employee: 'Daniel R.', status: 'Reported', comment: 'Replacement threshold ordered from standard warehouse stock. Expected delivery Monday 2026-06-22.' },
  { id: 'LOG_1131', eventId: 'QE_2399', date: '2026-06-18 16:00', role: 'Field Quality', employee: 'Marcus Brooks', status: 'Reported', comment: 'Supplier inquiry sent to FAR production to confirm whether other units from the same run share the machining deficiency. Awaiting response.' },

  // QE_2400 — New Orleans, Controller, Configuration Problem (Validated)
  { id: 'LOG_1132', eventId: 'QE_2400', date: '2026-06-20 08:10', role: 'Field Technician', employee: 'Archibald M. Tran', status: 'Reported', comment: 'Event reported via mobile field app. Two Magic Access controllers configured for 24V. Job spec is 12V. Field reprogramming not possible without factory reset tool.' },
  { id: 'LOG_1133', eventId: 'QE_2400', date: '2026-06-20 08:30', role: 'Field Quality', employee: 'Tyler Richardson', status: 'Reported', comment: 'Configuration mismatch confirmed against original SO spec. Both units from same FAR build run. Treated as build error, not transit or field issue.' },
  { id: 'LOG_1134', eventId: 'QE_2400', date: '2026-06-20 08:55', role: 'Field Quality', employee: 'Tyler Richardson', status: 'Under Investigation', comment: 'FAR configuration control records reviewed. SO correctly specified 12VDC. Build error originated at FAR assembly station. Plant quality team notified.' },
  { id: 'LOG_1135', eventId: 'QE_2400', date: '2026-06-20 09:30', role: 'Field Quality', employee: 'Tyler Richardson', status: 'Validated', comment: 'Root cause confirmed: configuration problem at FAR assembly. Corrective action filed. Voltage verification step added to FAR build checklist.' },
  { id: 'LOG_1136', eventId: 'QE_2400', date: '2026-06-20 10:00', role: 'Customer Service', employee: 'Ava J. Elizabeth Thompson', status: 'Validated', comment: '12VDC replacement controllers ordered and approved for expedited fulfillment. Estimated delivery 2026-06-22.' },
  { id: 'LOG_1137', eventId: 'QE_2400', date: '2026-06-20 11:00', role: 'Field Quality', employee: 'Tyler Richardson', status: 'Validated', comment: 'FAR plant corrective action implementation verified with plant quality lead. No further units from this build run should be affected.' },

  // QE_2401 — Indianapolis, Header, Loose Component (Under Investigation)
  { id: 'LOG_1138', eventId: 'QE_2401', date: '2026-06-20 09:47', role: 'Field Technician', employee: 'Dominique A. Marchand', status: 'Reported', comment: 'Event reported via mobile field app. Header end cap loose and separating from housing on Dura-Glide 2000 Series. Audible rattle. End cap displaces by hand without tools.' },
  { id: 'LOG_1139', eventId: 'QE_2401', date: '2026-06-20 10:10', role: 'Field Quality', employee: 'Nicole Bennett', status: 'Reported', comment: 'Initial review complete. Component integrity issue confirmed from photos. Status set to Under Investigation. Additional info requested on part number and extent of issue.' },
  { id: 'LOG_1140', eventId: 'QE_2401', date: '2026-06-20 10:35', role: 'Field Quality', employee: 'Nicole Bennett', status: 'Under Investigation', comment: 'End cap part number cross-referenced with QE_2381 — different door model but same retainer clip SKU. Checking if there is a systemic clip sizing issue across models.' },
  { id: 'LOG_1141', eventId: 'QE_2401', date: '2026-06-20 11:00', role: 'Customer Service', employee: 'Lisa P.', status: 'Under Investigation', comment: 'Parts order QE_2401_Order opened for 2 end cap assemblies and 1 retainer clip set. Awaiting FQ validation before approving for fulfillment.' },
  { id: 'LOG_1142', eventId: 'QE_2401', date: '2026-06-20 14:00', role: 'Field Quality', employee: 'Nicole Bennett', status: 'Under Investigation', comment: 'Field tech confirmed issue present on both ends of header. Part number stamp on existing cap confirmed. Root cause analysis ongoing — awaiting clip measurement from field.' },

  // QE_2402 — Atlanta, Panel, Invalidated
  { id: 'LOG_1143', eventId: 'QE_2402', date: '2026-06-20 11:25', role: 'Field Technician', employee: 'Josephine T. Blanchard', status: 'Reported', comment: 'Event reported via mobile field app. Duraguard 3000 panel shows surface discoloration in lower left quadrant. Customer concerned about cosmetic panel defect.' },
  { id: 'LOG_1144', eventId: 'QE_2402', date: '2026-06-20 11:45', role: 'Field Quality', employee: 'Kevin Martinez', status: 'Reported', comment: 'Field photos reviewed. Discoloration pattern appears inconsistent with a finish defect — resembles protective film residue. On-site inspection scheduled.' },
  { id: 'LOG_1145', eventId: 'QE_2402', date: '2026-06-20 12:30', role: 'Field Quality', employee: 'Kevin Martinez', status: 'Under Investigation', comment: 'On-site inspection underway. Panel photos shared with FAR plant quality team for parallel assessment while on-site visit is in progress.' },
  { id: 'LOG_1146', eventId: 'QE_2402', date: '2026-06-20 14:15', role: 'Field Quality', employee: 'Kevin Martinez', status: 'Under Investigation', comment: 'On-site inspection complete. Discoloration is protective film residue not removed at installation. No manufacturing defect present on the panel surface.' },
  { id: 'LOG_1147', eventId: 'QE_2402', date: '2026-06-20 14:30', role: 'Field Quality', employee: 'Kevin Martinez', status: 'Invalidated', comment: 'Event invalidated. Technician briefed on proper film removal procedure. Order QE_2402_Order cancelled. Customer confirmed satisfied after film removal on-site.' },
];

export const logs: ActivityLog[] = [...SEED_LOGS, ...generateLogs()];
