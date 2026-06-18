export type Difficulty = 'easy' | 'moderate' | 'challenging'
export type QuestionType = 'standard' | 'negation'
export type OptionLabel = 'A' | 'B' | 'C' | 'D'
export type ChapterId = 1 | 2 | 3 | 4 | 5

export interface Option {
  label: OptionLabel
  text: string
  correct: boolean
  rationale: string
}

export interface Question {
  id: string
  chapter: ChapterId
  difficulty: Difficulty
  type: QuestionType
  stem: string
  options: Option[]
}

export interface Exam {
  examId: number
  title: string
  questions: Question[]
}
