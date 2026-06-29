export type { Escalation, EscalationType } from './types';
import type { Escalation } from './types';

const ESC_001: Escalation = {
  id: 'ESC_001',
  type: 'Corrective Action Report',
  title: 'Plate Lock Installation — Missing Jamb Lock & Rework',
  status: 'Closed',
  reportedIssue:
    'Incorrect or incomplete plate lock installation led to missing jamb plate lock and rework during field installation at multiple sites.',
  rootCause:
    'Operators were executing plate lock installation without clear steps, leading to assembly errors. Work instructions lacked specificity for single slide door variants.',
  correctionImplemented:
    'New work instructions for Plate Lock Installation have been published:\n\n1. Preparation: Verify if the jamb is a Single Slide door requiring a lock (BOT OF LTCH JMB TO BOT OF SLOT, e.g., 42.063 inches). Confirm Plate Lock part number: 413068 or 417172.\n\n2. Verification: Check that the jamb holes for the lock plate are machined correctly. STOP and contact your supervisor if holes are missing or incorrectly aligned.\n\n3. Inspection: Verify alignment of the punch with the lock plate. STOP and escalate if alignment fails.',
  correctionImages: [],
  fieldAction:
    'If you encounter a missing plate lock assembly, please submit an iQ Quality event.',
  eventIds: ['QE_2392', 'QE_2391', 'QE_2388'],
  createdBy: 'Bertram M. Foxhollow',
  createdAt: '2026-05-20T09:00:00',
  updatedAt: '2026-05-28T14:30:00',
  closedAt: '2026-05-28T14:30:00',
};

const ESC_002: Escalation = {
  id: 'ESC_002',
  type: 'Corrective Action Report',
  title: 'Motor/Gearbox Mounting Holes Mislocated — Magic Access Header',
  status: 'Closed',
  reportedIssue:
    'Motor/gearbox mounting holes were positioned too close to the back side of the header across multiple Magic Access units.',
  rootCause:
    'The machining program was calculating the hole reference from the inside wall of the back of the header, but the machine can only reference the outside wall. This mismatch caused incorrect hole locations.',
  correctionImplemented:
    'CNC program updated to reference the outside wall, aligning the hole location with the intended dimension. This change is implemented for all Magic Access headers manufactured in 2026.',
  correctionImages: [],
  fieldAction:
    'If you encounter a header with motor/gearbox holes that appear mislocated, please submit a Quality Event and include photos with a tape measure indicating the location.',
  eventIds: ['QE_2385', 'QE_2381', 'QE_2379', 'QE_2376'],
  createdBy: 'Bertram M. Foxhollow',
  createdAt: '2026-05-15T10:00:00',
  updatedAt: '2026-06-01T11:00:00',
  closedAt: '2026-06-01T11:00:00',
};

const ESC_003: Escalation = {
  id: 'ESC_003',
  type: 'Problem Report',
  title: 'Controller Voltage Misconfiguration — 24V Built as 12V',
  status: 'Open',
  reportedIssue:
    'Multiple Magic Access controllers shipped with incorrect voltage configuration. Units ordered as 12VDC were assembled and shipped as 24VDC.',
  rootCause:
    'Build error at FAR assembly station. Configuration control records confirm SO correctly specified 12VDC but the error originated during FAR assembly.',
  correctionImplemented: null,
  correctionImages: [],
  fieldAction:
    'Do not attempt field reprogramming. Submit a Quality Event immediately if you encounter a controller that will not power up on your site voltage.',
  eventIds: ['QE_2400', 'QE_2393'],
  createdBy: 'Caspian T. Moorwick',
  createdAt: '2026-06-20T11:00:00',
  updatedAt: '2026-06-20T11:00:00',
};

export const escalations: Escalation[] = [ESC_001, ESC_002, ESC_003];
