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

export interface QualityEvent {
  id: string;
  date: string;
  jobNo: string;
  dfo: number;
  elLine?: number;
  status: EventStatus;
  rootCause: RootCause | null;
  branch: string;
  plant: string;
  product: string;
  discrepancy: string;
  door: string;
  issueDescription: string;
  assignee: string;
  reportedBy: string;
  reportedAt: string;
  additionalInfoRequested?: boolean;
  additionalInfoNote?: string;
  partsRequest?: Array<{
    partNumber: string;
    quantityType: string;
    quantity: number;
    description: string;
  }>;
  hardwareKit?: {
    kitInfo: string;
    serialNumber: string;
    quantityType: string;
    quantity: number;
  };
  tags?: string[];
}

export type EscalationType =
  | 'IT Ticket'
  | 'EH&S'
  | 'Corrective Action Report'
  | 'Problem Report'
  | 'Custom';

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
}
