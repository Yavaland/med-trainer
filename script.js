const STORAGE_KEY = "trainer_progress_final";
let questions = [];
let current = 0;

/* ===== PARSE QUESTIONS ===== */
if (typeof rawText !== 'undefined') {
    rawText.trim().split(/\n\s*\n/).forEach((block, id) => {
        const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 3) return;

        const question = lines[0].replace(/^\d+\)?\.?/, "").trim();
        const answers = [];
        const correct = [];

        lines.slice(1).forEach((line, i) => {
            if (line.startsWith("+")) {
                answers.push(line.slice(1).trim());
                correct.push(answers.length - 1);
            } else if (line.startsWith("-")) {
                answers.push(line.slice(1).trim());
            }
        });

        if (answers.length > 0) {
            questions.push({ id, question, answers, correct });
        }
    });
}

/* ===== PROGRESS ===== */
let progress = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    answers: {},
    results: {}
};

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

/* ===== STATS ===== */
function updateStats() {
    let ok = 0, bad = 0;
    for (let id in progress.results) {
        if (progress.results[id]) ok++;
        else bad++;
    }
    const unanswered = questions.length - ok - bad;
    const statsEl = document.getElementById("stats");
    if (statsEl) {
        statsEl.innerHTML = `<span>🟢 ${ok} | 🔴 ${bad} | ⚪ ${unanswered}</span><span>Вопрос ${questions.length ? current + 1 : 0} из ${questions.length}</span>`;
    }
    const barEl = document.getElementById("bar");
    if (barEl && questions.length > 0) {
        const percent = Math.round((ok + bad) / questions.length * 100);
        barEl.style.width = percent + "%";
    }
}

/* ===== LOAD QUESTION ===== */
function loadQuestion() {
    if (questions.length === 0) {
        document.getElementById("question").textContent = "⚠️ Вопросы не найдены. Проверьте разметку в questions.js (нужны символы + и - перед ответами).";
        return;
    }
    const card = document.getElementById("card");
    card.classList.remove("fade-enter-active", "success", "error");
    card.classList.add("fade-enter");
    requestAnimationFrame(() => {
        card.classList.add("fade-enter-active");
    });

    const q = questions[current];
    document.getElementById("question").textContent = q.question;
    document.getElementById("result").textContent = "";

    const a = document.getElementById("answers");
    a.innerHTML = "";
    q.answers.forEach((text, i) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        const span = document.createElement("span");
        input.type = q.correct.length > 1 ? "checkbox" : "radio";
        input.name = "answer";
        input.value = i;
        if (progress.answers[q.id]?.includes(i)) {
            input.checked = true;
        }
        span.textContent = text;
        label.appendChild(input);
        label.appendChild(span);
        a.appendChild(label);
    });

    if (q.id in progress.results) {
        showResult(false);
    }
    updateStats();
}

/* ===== CHECK ===== */
function checkAnswer() {
    if (questions.length === 0) return;
    const q = questions[current];
    const selected = [];
    document.querySelectorAll("input[name='answer']").forEach(i => {
        if (i.checked) selected.push(Number(i.value));
    });
    if (selected.length === 0) return;

    progress.answers[q.id] = selected;
    const ok = selected.length === q.correct.length &&
               selected.every(v => q.correct.includes(v));
    progress.results[q.id] = ok;
    save();
    showResult(true, ok);
    updateStats();
}

/* ===== SHOW RESULT ===== */
function showResult(animate = true, ok = false) {
    const q = questions[current];
    const selected = progress.answers[q.id] || [];
    document.querySelectorAll("#answers label").forEach((l, i) => {
        l.classList.remove("correct", "wrong");
        if (q.correct.includes(i)) {
            l.classList.add("correct");
        } else if (selected.includes(i)) {
            l.classList.add("wrong");
        }
    });

    const resultEl = document.getElementById("result");
    resultEl.textContent = progress.results[q.id] ? "✅ Правильно!" : "❌ Неправильно";
    resultEl.style.color = progress.results[q.id] ? "var(--success)" : "var(--danger)";

    if (!animate) return;
    const card = document.getElementById("card");
    card.classList.remove("success", "error");
    void card.offsetWidth;
    card.classList.add(ok ? "success" : "error");
}

/* ===== NAVIGATION ===== */
function nextQuestion() {
    if (current < questions.length - 1) {
        current++;
        loadQuestion();
    }
}
function prevQuestion() {
    if (current > 0) {
        current--;
        loadQuestion();
    }
}
function jumpTo() {
    const n = Number(document.getElementById("jumpInput").value);
    if (n >= 1 && n <= questions.length) {
        current = n - 1;
        loadQuestion();
        document.getElementById("jumpInput").value = "";
    }
}

/* ===== RESET ===== */
function resetProgress() {
    if (!confirm("Сбросить весь прогресс? Это действие нельзя отменить.")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("nextBtn").addEventListener("click", nextQuestion);
    document.getElementById("prevBtn").addEventListener("click", prevQuestion);
    document.getElementById("checkBtn").addEventListener("click", checkAnswer);
    document.getElementById("resetBtn").addEventListener("click", resetProgress);
    document.getElementById("jumpBtn").addEventListener("click", jumpTo);

    document.getElementById("jumpInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") jumpTo();
    });

    document.addEventListener("keydown", (e) => {
        if (document.activeElement.tagName === "INPUT") return;
        if (e.key >= "1" && e.key <= "9") {
            const idx = Number(e.key) - 1;
            const inputs = document.querySelectorAll("input[name='answer']");
            if (inputs[idx]) inputs[idx].click();
        }
        if (e.key === "Enter") checkAnswer();
        if (e.key === "ArrowRight") nextQuestion();
        if (e.key === "ArrowLeft") prevQuestion();
        if (e.key.toLowerCase() === "r") resetProgress();
    });

    loadQuestion();
});