export interface InstitutionalConfig {
  institutionName: string;
  city?: string;
  teacherName: string;
  teacherRole: string;
  area: string;
  subjects: string[];
  grades: string[];
  academicYear: number;
  passingScore: number;
  institutionalHeaderNote: string;
  institutionalFooterNote: string;
}

export interface AcademicContentRow {
  id: string;
  competency: string;
  topics: string;
  activities: string;
  evaluationCriteria: string;
  bibliography: string;
}

export interface AssignedWork {
  id: string;
  title: string;
  description: string;
  deliveryFormat?: string;
  dueDate?: string;
}

export interface SupportPlan {
  id: string;
  code: string;
  institutionName: string;
  city?: string;
  teacherName: string;
  teacherRole: string;
  area: string;
  subject: string;
  grade: string;
  course: string;
  period: string;
  academicYear: number;
  studentName: string;
  studentCode?: string;
  deliveryDate: string;
  supportDeadline?: string;
  observations?: string;
  rows: AcademicContentRow[];
  assignedWorks?: AssignedWork[];
  createdAt: string;
  updatedAt: string;
  batchId?: string;
}

export interface LibraryItem {
  id: string;
  grade: string;
  subject: string;
  period?: string;
  topic: string;
  academicYear: number;
  competency: string;
  topics: string;
  activities: string;
  evaluationCriteria: string;
  bibliography: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRosterEntry {
  id: string;
  code: string;
  name: string;
  grade: string;
  course: string;
  subject: string;
  period: string;
  academicYear: number;
  periodScore: number | null;
  finalScore: number | null;
  performanceLevel: string;
  needsSupport: boolean;
}

export interface AppDatabase {
  config: InstitutionalConfig;
  plans: SupportPlan[];
  library: LibraryItem[];
  rosters: StudentRosterEntry[];
}

export interface PlanDraft {
  editingPlanId?: string;
  institutionName: string;
  city?: string;
  teacherName: string;
  teacherRole: string;
  area: string;
  subject: string;
  grade: string;
  course: string;
  period: string;
  academicYear: number;
  studentName: string;
  studentCode: string;
  deliveryDate: string;
  supportDeadline: string;
  observations: string;
  rows: AcademicContentRow[];
  assignedWorks: AssignedWork[];
}

export type AppSection =
  | 'dashboard'
  | 'create'
  | 'batch'
  | 'library'
  | 'history'
  | 'settings';

export interface WorkspaceLinks {
  spreadsheetId: string;
  spreadsheetTitle?: string;
  driveFolderId: string;
  driveFolderName?: string;
  lastSyncedAt?: string;
}

export interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
}

