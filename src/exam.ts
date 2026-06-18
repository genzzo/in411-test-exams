import type { Exam, Question } from "./types.ts";
import { examMetas } from "./data/index.ts";

interface ExamState {
  answers: Record<string, string>;
  submitted: boolean;
  score?: number;
}

export type Band = "red" | "amber" | "green";

function storageKey(id: number): string {
  return `in411:exam:${id}`;
}

function loadState(id: number): ExamState {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ExamState>;
      return {
        answers: parsed.answers ?? {},
        submitted: !!parsed.submitted,
        score: parsed.score,
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { answers: {}, submitted: false };
}

function saveState(id: number, state: ExamState): void {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(state));
  } catch {
    /* storage may be unavailable */
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function correctLabel(q: Question): string {
  const o = q.options.find((opt) => opt.correct);
  return o ? o.label : "";
}

function computeScore(exam: Exam, state: ExamState): number {
  let score = 0;
  for (const q of exam.questions) {
    const a = state.answers[q.id];
    if (a && a === correctLabel(q)) score++;
  }
  return score;
}

export function scoreBand(score: number, total: number): Band {
  const pct = total ? (score / total) * 100 : 0;
  if (pct < 50) return "red";
  if (pct < 75) return "amber";
  return "green";
}

export interface StoredResult {
  submitted: boolean;
  score: number;
}

// Reads only from storage (no question bank needed) so the landing page stays light.
export function getStoredResult(examId: number): StoredResult {
  const state = loadState(examId);
  return {
    submitted: state.submitted,
    score: state.score ?? 0,
  };
}

function questionHtml(q: Question, index: number): string {
  const opts = q.options
    .map(
      (o) => `
      <label class="opt" data-label="${o.label}">
        <input type="radio" name="${esc(q.id)}" value="${o.label}" />
        <span class="opt-key">${o.label}</span>
        <span class="opt-text">${esc(o.text)}</span>
        <span class="opt-mark" aria-hidden="true"></span>
      </label>`,
    )
    .join("");

  const rationales = q.options
    .map(
      (o) => `
      <li class="rat" data-label="${o.label}">
        <span class="rat-key">${o.label}</span>
        <span class="rat-text">${esc(o.rationale)}</span>
      </li>`,
    )
    .join("");

  return `
    <li class="qcard" data-qid="${esc(q.id)}">
      <div class="qhead">
        <span class="qnum">${index + 1}</span>
        <span class="qresult" aria-hidden="true"></span>
      </div>
      <p class="stem">${esc(q.stem)}</p>
      <div class="options" role="radiogroup" aria-label="Answer options for question ${index + 1}">${opts}</div>
      <details class="rationales">
        <summary class="rat-head">Correct answer: <strong>${correctLabel(q)}</strong> — <span class="rat-toggle"></span></summary>
        <ul>${rationales}</ul>
      </details>
    </li>`;
}

export function renderExam(app: HTMLElement, exam: Exam): void {
  let state = loadState(exam.examId);
  const total = exam.questions.length;
  const others = examMetas.filter((e) => e.examId !== exam.examId);
  const ctaHtml = others
    .map(
      (e) =>
        `<a class="cta-exam" href="#/exam/${e.examId}">${esc(e.title)} →</a>`,
    )
    .join("");

  app.innerHTML = `
    <div class="exam-page${state.submitted ? " submitted" : ""}" id="exam-page">
      <header class="exam-header">
        <a class="back" href="#/">← All exams</a>
        <h1>${esc(exam.title)}</h1>
        <p class="sub">${total} questions across all five chapters · choose one answer per question · feedback is shown only after you submit.</p>
      </header>

      <button type="button" class="view-score" id="view-score">↓ View your score &amp; feedback</button>

      <ol class="questions">
        ${exam.questions.map((q, i) => questionHtml(q, i)).join("")}
      </ol>

      <div class="submit-row">
        <button type="button" class="btn-submit" id="submit-btn">Submit exam</button>
        <p class="submit-note">You can change answers freely until you submit.</p>
      </div>

      <section class="result-footer" id="result-footer" aria-hidden="true">
        <div class="result-banner" id="result-banner" role="status" aria-live="polite"></div>
        <h2>Review your feedback</h2>
        <p>Each question above is marked correct, incorrect, or unanswered, with an explanation for every option — scroll up to review them.</p>
        <div class="cta-row">
          <button type="button" class="cta-top" id="cta-top">↑ Scroll up to review your marked answers</button>
        </div>
        <h2 class="next-h">Try the other two exams</h2>
        <div class="cta-row">${ctaHtml}</div>
        <div class="cta-row">
          <button type="button" class="btn-retake" id="retake-btn">Retake this exam</button>
        </div>
      </section>

      <div class="exam-nav">
        <button type="button" id="nav-top">↑ Top</button>
        <button type="button" id="nav-bottom">↓ Bottom</button>
        <form class="goto" id="goto-form">
          <input type="number" id="goto-input" min="1" max="${total}" placeholder="#" aria-label="Go to question number" />
          <button type="submit">Go</button>
        </form>
      </div>

      <div class="progress-bar" id="progress-bar">
        <span class="progress-text" id="progress-text">0 / ${total} answered</span>
        <button type="button" class="btn-submit small" id="submit-btn-sticky">Submit</button>
      </div>
    </div>`;

  const root = app.querySelector<HTMLElement>("#exam-page")!;

  // Restore previously selected answers.
  for (const q of exam.questions) {
    const sel = state.answers[q.id];
    if (!sel) continue;
    const input = root.querySelector<HTMLInputElement>(
      `input[name="${q.id}"][value="${sel}"]`,
    );
    if (input) input.checked = true;
  }

  function answeredCount(): number {
    let n = 0;
    for (const q of exam.questions) if (state.answers[q.id]) n++;
    return n;
  }

  function updateProgress(): void {
    const pt = root.querySelector("#progress-text");
    if (pt) pt.textContent = `${answeredCount()} / ${total} answered`;
  }

  function fillBanner(score: number): void {
    const banner = root.querySelector<HTMLElement>("#result-banner")!;
    const band = scoreBand(score, total);
    const pct = total ? Math.round((score / total) * 100) : 0;
    const msg =
      band === "green"
        ? "Excellent — strong command of the material."
        : band === "amber"
          ? "Good effort — review the misses below to close the gaps."
          : "Keep studying — work through the explanations above.";
    banner.className = `result-banner show band-${band}`;
    banner.innerHTML = `
      <div class="score-num">${score}<span>/${total}</span></div>
      <div class="score-meta">
        <p class="score-msg">${esc(msg)} <span class="score-pct">(${pct}%)</span></p>
        <p class="score-sub">Each question above is marked correct or incorrect, with an explanation for every option.</p>
      </div>`;
  }

  function applyResults(): void {
    const cards = root.querySelectorAll<HTMLElement>(".qcard");
    cards.forEach((card) => {
      const qid = card.getAttribute("data-qid") ?? "";
      const q = exam.questions.find((x) => x.id === qid);
      if (!q) return;
      const correct = correctLabel(q);
      const chosen = state.answers[qid];

      card.classList.remove("correct", "incorrect", "unanswered");
      if (!chosen) card.classList.add("unanswered");
      else if (chosen === correct) card.classList.add("correct");
      else card.classList.add("incorrect");

      // Default: open the analysis for wrong/unanswered, keep it closed for correct.
      const details = card.querySelector<HTMLDetailsElement>(".rationales");
      if (details) details.open = chosen !== correct;

      card.querySelectorAll<HTMLElement>(".opt").forEach((opt) => {
        const label = opt.getAttribute("data-label");
        const input = opt.querySelector<HTMLInputElement>("input");
        if (input) input.disabled = true;
        opt.classList.remove("is-correct", "is-chosen", "is-wrong");
        if (label === correct) opt.classList.add("is-correct");
        if (label && label === chosen) {
          opt.classList.add("is-chosen");
          if (chosen !== correct) opt.classList.add("is-wrong");
        }
      });

      card.querySelectorAll<HTMLElement>(".rat").forEach((r) => {
        const label = r.getAttribute("data-label");
        r.classList.remove("is-correct", "is-chosen");
        if (label === correct) r.classList.add("is-correct");
        if (label && label === chosen) r.classList.add("is-chosen");
      });

      const res = card.querySelector(".qresult");
      if (res) {
        res.textContent = !chosen
          ? "— not answered"
          : chosen === correct
            ? "✓ correct"
            : "✗ incorrect";
      }
    });
    fillBanner(computeScore(exam, state));
  }

  function doSubmit(): void {
    if (state.submitted) return;
    const unanswered = total - answeredCount();
    if (unanswered > 0) {
      const ok = window.confirm(
        `You have ${unanswered} unanswered question(s). They will be counted as incorrect. Submit anyway?`,
      );
      if (!ok) return;
    }
    state.submitted = true;
    state.score = computeScore(exam, state);
    saveState(exam.examId, state);
    root.classList.add("submitted");
    root.querySelector("#result-footer")?.setAttribute("aria-hidden", "false");
    applyResults();
    root
      .querySelector("#result-footer")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function doRetake(): void {
    localStorage.removeItem(storageKey(exam.examId));
    state = { answers: {}, submitted: false };
    renderExam(app, exam);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  // Answer selection (event delegation).
  root.querySelector(".questions")!.addEventListener("change", (ev) => {
    const t = ev.target as HTMLElement;
    if (t instanceof HTMLInputElement && t.type === "radio") {
      state.answers[t.name] = t.value;
      saveState(exam.examId, state);
      updateProgress();
    }
  });

  root.querySelector("#submit-btn")!.addEventListener("click", doSubmit);
  root.querySelector("#submit-btn-sticky")!.addEventListener("click", doSubmit);
  root.querySelector("#retake-btn")!.addEventListener("click", doRetake);
  const toTop = (): void => window.scrollTo({ top: 0, behavior: "auto" });
  const toBottom = (): void =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "auto",
    });
  const toResults = (): void => {
    root
      .querySelector("#result-footer")
      ?.scrollIntoView({ behavior: "auto", block: "start" });
  };
  root.querySelector("#cta-top")!.addEventListener("click", toTop);
  root.querySelector("#view-score")!.addEventListener("click", toResults);
  root.querySelector("#nav-top")!.addEventListener("click", toTop);
  root.querySelector("#nav-bottom")!.addEventListener("click", toBottom);
  root.querySelector("#goto-form")!.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = root.querySelector<HTMLInputElement>("#goto-input");
    if (!input) return;
    const n = parseInt(input.value, 10);
    if (Number.isNaN(n) || n < 1 || n > total) return;
    const card = root.querySelectorAll<HTMLElement>(".qcard")[n - 1];
    if (card) card.scrollIntoView({ behavior: "auto", block: "start" });
    input.blur();
  });

  updateProgress();

  // If this exam was already submitted in a previous visit, show results immediately.
  if (state.submitted) {
    root.querySelector("#result-footer")?.setAttribute("aria-hidden", "false");
    applyResults();
  }
}
