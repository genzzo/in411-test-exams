import type { Exam } from '../types.ts'
import manifest from './manifest.json'

export interface ExamMeta {
  examId: number
  title: string
  total: number
  chapters: number
  difficulty: { easy: number; moderate: number; challenging: number }
}

// Lightweight metadata (statically bundled) used by the landing page.
export const examMetas: ExamMeta[] = manifest as ExamMeta[]

// Full question banks are loaded on demand so the landing page stays small.
const loaders: Record<number, () => Promise<{ default: unknown }>> = {
  1: () => import('./exam1.json'),
  2: () => import('./exam2.json'),
  3: () => import('./exam3.json'),
}

export async function loadExam(id: number): Promise<Exam | undefined> {
  const loader = loaders[id]
  if (!loader) return undefined
  const mod = await loader()
  return mod.default as Exam
}
