import './style.css'
import type { ExamMeta } from './data/index.ts'
import { examMetas, loadExam } from './data/index.ts'
import { renderExam, getStoredResult, scoreBand } from './exam.ts'

const app = document.querySelector<HTMLDivElement>('#app')!

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cardHtml(meta: ExamMeta): string {
  const d = meta.difficulty
  const result = getStoredResult(meta.examId)
  const status = result.submitted
    ? `<span class="card-score band-${scoreBand(result.score, meta.total)}">Last score ${result.score}/${meta.total}</span>`
    : `<span class="card-status">Not yet attempted</span>`
  return `
    <a class="exam-card" href="#/exam/${meta.examId}">
      <div class="card-top">
        <span class="card-tag">Exam ${meta.examId}</span>
        ${status}
      </div>
      <h2>${esc(meta.title)}</h2>
      <p class="card-meta">${meta.total} questions · ${meta.chapters} of 5 chapters</p>
      <ul class="card-diff">
        <li class="easy">${d.easy} easy</li>
        <li class="moderate">${d.moderate} moderate</li>
        <li class="challenging">${d.challenging} challenging</li>
      </ul>
      <span class="card-go">${result.submitted ? 'Review or retake' : 'Start exam'} →</span>
    </a>`
}

function renderHome(): void {
  app.innerHTML = `
    <div class="home">
      <header class="home-hero">
        <span class="kicker">IN411 · Introduction to Big Data</span>
        <h1>Practice Exams</h1>
        <p class="lede">
          Three independent 100-question exams spanning all five chapters — Overview of Big Data,
          the Hadoop Ecosystem, Apache Spark, NoSQL Databases, and Data Lake Concepts. Each tests
          understanding and application, not memorisation. Answers and explanations are revealed only
          when you submit.
        </p>
      </header>
      <div class="exam-grid">
        ${examMetas.map((m) => cardHtml(m)).join('')}
      </div>
      <footer class="home-foot">
        <p>Pick any exam to begin. Your progress is saved in this browser until you submit or retake.</p>
      </footer>
    </div>`
  window.scrollTo({ top: 0, behavior: 'auto' })
}

function renderLoading(id: number): void {
  app.innerHTML = `<div class="loading"><p>Loading Practice Exam ${id}…</p></div>`
}

function currentExamId(): number | null {
  const m = location.hash.match(/^#\/exam\/(\d+)$/)
  return m ? Number(m[1]) : null
}

// Inserts the theme toggle at the top of the page (in normal flow) after each
// render, and wires it. #app is rebuilt per route, so this re-mounts each time.
function mountThemeToggle(): void {
  app.insertAdjacentHTML(
    'afterbegin',
    '<div class="topbar"><button type="button" class="theme-toggle" id="theme-toggle"></button></div>',
  )
  const btn = app.querySelector<HTMLButtonElement>('#theme-toggle')
  if (!btn) return
  const apply = (): void => {
    const dark = document.documentElement.dataset.theme === 'dark'
    btn.textContent = dark ? '☀ Light' : '☾ Dark'
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
  }
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('in411:theme', next)
    } catch {
      /* storage may be unavailable */
    }
    apply()
  })
  apply()
}

async function route(): Promise<void> {
  const id = currentExamId()
  if (id !== null && examMetas.some((e) => e.examId === id)) {
    renderLoading(id)
    mountThemeToggle()
    const exam = await loadExam(id)
    // The user may have navigated elsewhere while the chunk loaded.
    if (currentExamId() !== id) return
    if (exam) {
      renderExam(app, exam)
      mountThemeToggle()
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
  }
  renderHome()
  mountThemeToggle()
}

window.addEventListener('hashchange', () => {
  void route()
})
void route()
