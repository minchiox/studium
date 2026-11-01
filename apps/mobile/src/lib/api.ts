import {
  type AgendaItem,
  type Career,
  type Course,
  fetchTransport,
  type Lesson,
  LmsClient,
  type Notice,
  type Student,
} from '@studium/core';
import { useQuery } from '@tanstack/react-query';
import { tokenSource } from './auth';
import { profile } from './profile';

let client: LmsClient | null = null;

/** The read-only platform client, created on first use. */
export function api(): LmsClient {
  client ??= new LmsClient(profile, fetchTransport(fetch, 25_000), tokenSource, {
    concurrency: 4,
    onBlocked: (method, url) => console.warn(`[guard] blocked ${method} ${url}`),
  });
  return client;
}

const MIN = 60_000;

export const keys = {
  courses: ['courses'] as const,
  career: ['career'] as const,
  student: ['student'] as const,
  agenda: ['agenda'] as const,
  notices: ['notices'] as const,
  unread: ['notices', 'unread'] as const,
  lessons: (code: string) => ['lessons', code] as const,
};

export const useCourses = () =>
  useQuery<Course[]>({ queryKey: keys.courses, queryFn: () => api().listCourses(), staleTime: 10 * MIN });

export const useCareer = () =>
  useQuery<Career>({ queryKey: keys.career, queryFn: () => api().getCareer(), staleTime: 30 * MIN });

export const useStudent = () =>
  useQuery<Student>({ queryKey: keys.student, queryFn: () => api().getStudent(), staleTime: 24 * 60 * MIN });

export const useNotices = () =>
  useQuery<Notice[]>({ queryKey: keys.notices, queryFn: () => api().getNotices(), staleTime: 15 * MIN });

export const useUnreadNotices = () =>
  useQuery<number>({ queryKey: keys.unread, queryFn: () => api().getUnreadNotices(), staleTime: 15 * MIN });

export function useAgenda() {
  const courses = useCourses();
  const titles = Object.fromEntries((courses.data ?? []).map((c) => [c.code, c.title]));
  return useQuery<AgendaItem[]>({
    queryKey: [...keys.agenda, Object.keys(titles).length],
    queryFn: () => api().getAgenda(titles),
    staleTime: 15 * MIN,
  });
}

export const useLessons = (code: string) =>
  useQuery<Lesson[]>({
    queryKey: keys.lessons(code),
    queryFn: () => api().listLessons(code),
    staleTime: 10 * MIN,
  });

export function useLesson(code: string, n: number) {
  const q = useLessons(code);
  return { ...q, data: q.data?.find((l) => l.number === n) };
}
