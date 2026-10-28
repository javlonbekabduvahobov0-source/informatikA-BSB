export type CognitiveLevel = 'Bilish' | "Qo'llash" | 'Mulohaza';

export interface Question {
  id: string;
  type: 'multiple_choice' | 'written';
  cognitiveLevel?: CognitiveLevel; // CHSB taxonomy level: Bilish (Knowledge), Qo'llash (Application), Mulohaza (Reasoning)
  question: string;
  options?: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctAnswer: string;
  points: number;
  explanation?: string;
  criteria?: string; // Official scoring rubric from PDF
  rubricSteps?: { step: string; points: number }[]; // Detailed step-by-step criteria
}

export interface StudentRosterItem {
  id: string;
  studentCode: string; // e.g. "01", "7A-1", "K-12"
  name: string; // e.g. "Karimov Jasur"
  studentClass?: string;
}

export interface TestItem {
  id: string;
  code: string;
  title: string;
  subject: string;
  grade: string;
  term: string;
  testType: 'BSB' | 'CHSB' | 'Nazorat ishi';
  format: 'multiple_choice' | 'written' | 'mixed';
  durationMinutes: number;
  totalPoints: number;
  createdAt: string;
  teacherName: string;
  showInstantResult: boolean;
  allowReview: boolean;
  questions: Question[];
  roster?: StudentRosterItem[];
  pdfData?: string; // Stored base64 of the uploaded BSB PDF
  pdfName?: string;
  submissionCount?: number;
  averageScore?: number;
}

export interface StudentSubmission {
  id: string;
  testId: string;
  testCode: string;
  studentCode?: string; // Student's personal PIN code if used
  studentName: string;
  studentClass: string;
  submittedAt: string;
  timeSpentSeconds: number;
  answers: Record<string, string>;
  writtenImages?: Record<string, string>; // questionId -> base64 image of handwritten notebook page
  writtenFeedback?: Record<string, { score: number; comment: string }>;
  score: number;
  maxScore: number;
  percentage: number;
  gradeScore: number; // 2, 3, 4, 5
}

