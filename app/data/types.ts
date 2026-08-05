export type EventStatus =
  | 'Reported'
  | 'Under Investigation'
  | 'Validated'
  | 'Invalidated';

export type RootCause =
  | 'Ordering Error'
  | 'Wrong Order From Branch'
  | 'Sales Order Error'
  | 'Installation Error'
  | 'Factory Issue'
  | 'Configuration Problem'
  | 'Training Issue'
  | 'Supplier Issue'
  | 'Engineering Issue'
  | 'Short Shipping';

export interface EditHistoryEntry {
  id: string;
  timestamp: string;
  editedBy: string;
  role: string;
  field: string;
  from: string | null;
  to: string | null;
}

export type AdditionalInfoRequestKind = 'initial' | 'followup' | 'new' | 'reply';

export interface AdditionalInfoRequest {
  id: string;
  text: string;
  sentAt: string;
  kind: AdditionalInfoRequestKind;
  relatesTo?: string;
  resendCount?: number;
  // Office side: Field Quality / Customer Service (absent = Field Quality).
  // Reporter side: Tech (mobile app) or Intake (branch office via the portal
  // intake surface, INTAKE-SPEC.md) — both satisfy an awaiting thread.
  sentBy?: 'Field Quality' | 'Customer Service' | 'Tech' | 'Branch';
}

export interface QualityEvent {
  id: string;
  date: string;
  jobNo: string;
  // SO job number keyed by hand at submission instead of barcode-scanned.
  // SO-only; absence means scanned (the normal path). Never set on WOs.
  jobNoManualEntry?: boolean;
  dfo: number;
  elLine?: number;
  status: EventStatus;
  // Primary root cause (first of rootCauses) kept for single-value consumers.
  rootCause: RootCause | null;
  rootCauses?: string[];
  branch: string;
  plant: string;
  component: string;
  issue: string;
  door: string;
  issueDescription: string;
  assignee: string;
  reportedBy: string;
  reportedAt: string;
  additionalInfoRequested?: boolean;
  additionalInfoNote?: string;
  additionalInfoRequests?: AdditionalInfoRequest[];
  partsRequest?: Array<{
    partNumber: string;
    quantityType: string;
    quantity: number;
    description: string;
  }>;
  // Where the replacement part ships, chosen by the tech at submission.
  // Applies to the parts request as a whole. Absent means 'branch'.
  shipTo?: 'branch' | 'address';
  shipToAddress?: {
    street: string;
    cityStateZip: string;
  };
  hardwareKit?: {
    kitInfo: string;
    serialNumber: string;
    quantityType: string;
    quantity: number;
  };
  tags?: string[];
  editHistory?: EditHistoryEntry[];
}

// Escalation types are a managed taxonomy (Categories > Escalations), so the
// type is an open string rather than a fixed union. Seed types live in
// data/manageLists.ts; runtime additions in store/escalationTypeStore.ts.
export type EscalationType = string;

export type EscalationStatus = 'Open' | 'Closed';

export interface Escalation {
  id: string;
  type: EscalationType;
  title: string;
  status: EscalationStatus;
  reportedIssue: string;
  rootCause: string | null;
  correctionImplemented: string | null;
  correctionImages?: string[];
  fieldAction: string | null;
  eventIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface ActivityLog {
  id: string;
  eventId: string;
  date: string;
  role: string;
  employee: string;
  status: EventStatus;
  comment: string;
  editFrom?: string | null;
  editTo?: string | null;
}
