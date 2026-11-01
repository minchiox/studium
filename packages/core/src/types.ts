import { z } from 'zod';

// =============================================================== Domain model

export interface Course {
  code: string;
  title: string;
  cfu: number | null;
  /** Year of the study plan (1, 2…), null when unknown. */
  year: number | null;
  ssd: string | null;
  /** 0–100 video progress reported by the platform; null when the course has no lessons yet. */
  progress: number | null;
  completed: boolean | null;
  /** Exam outcome from the career, when the course is part of the study plan. */
  exam: CareerExam | null;
  /** Last lesson watched on the platform. */
  lastWatched: { lpId: number; at: string } | null;
}

export interface Paragraph {
  number: number;
  title: string;
  durationS: number;
  progress: number | null;
  videoUrl: string | null;
  vttUrl: string | null;
}

export interface SelfTest {
  title: string;
  progress: number | null;
}

export interface Lesson {
  number: number;
  lpId: number;
  title: string;
  teacher: string | null;
  progress: number | null;
  objectives: string | null;
  dispensaUrl: string | null;
  selfTest: SelfTest | null;
  paragraphs: Paragraph[];
}

export interface Student {
  firstName: string;
  lastName: string;
  studentId: string;
  degree: string;
  enrolmentYear: string | null;
  currentYear: number | null;
  status: string | null;
}

export interface CareerExam {
  code: string;
  title: string;
  year: number | null;
  ssd: string | null;
  type: string | null;
  optional: boolean;
  requiredCfu: number;
  acquiredCfu: number;
  passed: boolean;
  /** Platform label, e.g. "DA SOSTENERE". */
  statusLabel: string;
  statusCode: string;
  /** 18–30, or 31 for "30 e lode" when the platform encodes it so; null when there is no grade. */
  vote: number | null;
  /** Whether the grade counts towards the average. */
  countsForAverage: boolean;
  date: string | null;
}

export interface CareerSummary {
  acquiredCfu: number;
  requiredCfu: number;
  remainingCfu: number;
  examsRemaining: number | null;
  currentYear: number | null;
  /** Weighted average as published by the platform (null when not available or zero). */
  platformWeightedAverage: number | null;
}

export interface Career {
  summary: CareerSummary;
  years: { year: number; exams: CareerExam[] }[];
}

export interface ExamBooking {
  id: string;
  courseCode: string;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  end: string | null;
  location: string | null;
  type: string | null;
  online: boolean;
}

export interface ExamSession {
  id: string;
  courseCode: string;
  title: string;
  module: string | null;
  date: string; // YYYY-MM-DD
  start: string | null;
  end: string | null;
  cfu: number | null;
  type: string | null;
}

export interface NoticeAttachment {
  id: string;
  title: string;
  file: string;
  size: string | null;
  extension: string | null;
}

export interface Notice {
  id: string;
  title: string;
  html: string;
  text: string;
  category: string | null;
  start: string | null;
  end: string | null;
  createdAt: string | null;
  attachments: NoticeAttachment[];
}

export interface LiveClass {
  id: string;
  title: string;
  description: string | null;
  start: string; // ISO
  end: string | null;
  state: string | null;
  courses: { code: string; title: string }[];
}

// =============================================================== Raw API schemas
// Lenient (unknown keys kept, most fields optional) but explicit about what we read.

const num = z.coerce.number();
const optStr = z.string().nullish();
const optNum = num.nullish();

export const ApiCourseProgress = z.looseObject({
  code: z.string(),
  title: z.string(),
  cfu: optNum,
  progress: optNum,
  completed: z.boolean().nullish(),
  lp_id: z.looseObject({ lp_id: optNum, watched_at: optStr }).nullish(),
});
export type ApiCourseProgress = z.infer<typeof ApiCourseProgress>;

export const ApiLessonRef = z.looseObject({
  lp_id: num,
  display_order: num,
  title: z.string(),
  percentage: optNum,
});
export type ApiLessonRef = z.infer<typeof ApiLessonRef>;

export const ApiLessonItem = z.looseObject({
  contentType: z.string(),
  title: optStr,
  description: optStr,
  paragNumber: optNum,
  duration_s: optNum,
  videoUrl: optStr,
  percentage: optNum,
  teacherName: optStr,
  teacherSurname: optStr,
  mer_BookUrl: optStr,
  bookUrl: optStr,
});
export type ApiLessonItem = z.infer<typeof ApiLessonItem>;

export const ApiStudent = z.looseObject({
  user: z.looseObject({ official_code: optStr }).nullish(),
  enrolment: z
    .looseObject({
      official_code: optStr,
      corso: optStr,
      anno_accademico_immatricolazione: optStr,
      anno_attuale_iscrizione: optNum,
      stato: optStr,
    })
    .nullish(),
  registry: z.looseObject({ firstname: optStr, lastname: optStr }).nullish(),
});

export const ApiCareerEvent = z.looseObject({
  status: optStr,
  status_name: optStr,
  date_conv: optStr,
  vote: optNum,
  media: z.boolean().nullish(),
  acquired_cfu: optNum,
});

export const ApiCareerEntry = z.looseObject({
  course_code: optStr,
  exam_course_code: optStr,
  title: z.string(),
  year: z.union([z.string(), z.number()]).nullish(),
  ssd: optStr,
  type_name: optStr,
  optional_exam: z.boolean().nullish(),
  required_cfu: optNum,
  acquired_cfu: optNum,
  events: z.array(ApiCareerEvent).nullish(),
});

export const ApiCareer = z.looseObject({
  profile: z
    .looseObject({
      acquired_cfu: optNum,
      required_cfu: optNum,
      remaining_cfu: optNum,
      num_exam_remaining: optNum,
      current_year: optNum,
      vote_weighted: z.union([z.string(), z.number()]).nullish(),
    })
    .nullish(),
  career: z.array(z.array(ApiCareerEntry)).nullish(),
});

export const ApiReservation = z.looseObject({
  id_reservation: z.union([z.string(), z.number()]),
  course_code: z.string(),
  exam_date: z.string(),
  exam_hour: optStr,
  exam_hour_finish: optStr,
  location: optStr,
  type_of_exam: optStr,
  exam_online_flag: optNum,
});

export const ApiActiveExam = z.looseObject({
  exam_id: z.union([z.string(), z.number()]),
  course_code: z.string(),
  title_exam: z.string(),
  title_module: optStr,
  date_exam: z.string(),
  exam_hour: optStr,
  exam_hour_finish: optStr,
  cfu: optNum,
  exam_type: optStr,
});

export const ApiNotice = z.looseObject({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  body: optStr,
  start: optStr,
  end: optStr,
  created_at: optStr,
  notice_category: z.looseObject({ name: optStr }).nullish(),
  attachments: z
    .array(
      z.looseObject({
        id: z.union([z.string(), z.number()]),
        title: optStr,
        filesize: optStr,
        file: z.string(),
        typefile: z.looseObject({ extension: optStr }).nullish(),
      }),
    )
    .nullish(),
});

export const ApiLiveClass = z.looseObject({
  id: z.union([z.string(), z.number()]),
  name_class: optStr,
  description_class: optStr,
  start_class: z.string(),
  end_class: optStr,
  state: optStr,
  courses: z.array(z.looseObject({ code: z.string(), title: optStr })).nullish(),
});
