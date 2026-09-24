const STORAGE_KEY = "trainer_progress_final";
const THEME_KEY = "trainer_theme";
let allQuestions = [];
let filteredQuestions = [];
let current = 0;
let currentFilter = "all";
let searchQuery = "";
let searchTimeout = null;
let isHintShown = false; // Флаг для кнопки подсказки

/* ===== THEME ===== */
function initTheme() {
    var saved = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(saved);
}
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = document.getElementById("themeToggle");
    if (btn) {
        btn.textContent = theme === "dark" ? "☀️" : "🌙";
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#1c1c1f" : "#4f46e5");
}
function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") || "light";
    var next = cur === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
}

/* ===== PARSE QUESTIONS ===== */
if (typeof rawText !== 'undefined') {
    rawText.trim().split(/\n\s*\n/).forEach(function(block, id) {
        var lines = block.split("\n").map(function(l) { return l.trim(); }).filter(Boolean);
        if (lines.length < 3) return;
        var question = lines[0].replace(/^\d+\)?\.?/, "").trim();
        var answers = [];
        var correct = [];
        lines.slice(1).forEach(function(line) {
            if (line.startsWith("+")) {
                answers.push(line.slice(1).trim());
                correct.push(answers.length - 1);
            } else if (line.startsWith("-")) {
                answers.push(line.slice(1).trim());
            }
        });
        if (answers.length > 0) {
            allQuestions.push({ id: id, question: question, answers: answers, correct: correct });
        }
    });
    filteredQuestions = allQuestions.slice();
}

/* ===== PROGRESS ===== */
var progress = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { answers: {}, results: {} };
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }

/* ===== STATS ===== */
function updateStats() {
    var ok = 0, bad = 0;
    for (var id in progress.results) {
        if (progress.results[id]) ok++; else bad++;
    }
    var unanswered = allQuestions.length - ok - bad;
    var statsEl = document.getElementById("stats");
    if (statsEl) {
        var shown = filteredQuestions.length;
        var total = allQuestions.length;
        var info = (currentFilter !== "all" || searchQuery) ? " · " + shown + " из " + total : "";
        statsEl.innerHTML = "<span>🟢" + ok + " 🔴" + bad + " ⚪" + unanswered + "</span><span>" + (shown ? current + 1 : 0) + "/" + shown + info + "</span>";
    }
    var barEl = document.getElementById("bar");
    if (barEl && allQuestions.length > 0) {
        barEl.style.width = Math.round((ok + bad) / allQuestions.length * 100) + "%";
    }
}

/* ===== FILTERS ===== */
function applyFilters() {
    filteredQuestions = allQuestions.filter(function(q) {
        var passFilter = true;
        if (currentFilter === "wrong") passFilter = progress.results[q.id] === false;
        else if (currentFilter === "correct") passFilter = progress.results[q.id] === true;
        else if (currentFilter === "unanswered") passFilter = !(q.id in progress.results);
        
        var passSearch = true;
        if (searchQuery.trim()) {
            var query = searchQuery.toLowerCase().trim();
            passSearch = q.question.toLowerCase().indexOf(query) !== -1 || q.answers.join(" ").toLowerCase().indexOf(query) !== -1;
        }
        return passFilter && passSearch;
    });
    if (current >= filteredQuestions.length) current = 0;
    loadQuestion();
    updateStats();
}

/* ===== HIGHLIGHT ===== */
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function highlightText(text, query) {
    if (!query.trim()) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var regex = new RegExp("(" + escapeRegex(query) + ")", 'gi');
    return escaped.replace(regex, '<span class="highlight">$1</span>');
}

/* ===== LOAD QUESTION ===== */
function loadQuestion() {
    var card = document.getElementById("card");
    card.innerHTML = '<div class="question-number" id="questionNumber"></div><div class="question-text" id="question"></div><div class="answers-list" id="answers"></div><div class="result-message" id="result"></div>';

    if (filteredQuestions.length === 0) {
        card.innerHTML = '<div class="no-results"><div class="no-results-icon">🔍</div><div>Ничего не найдено</div><button class="btn btn-outline" onclick="resetAll()" style="margin-top:16px">Сбросить фильтры</button></div>';
        return;
    }

    card.classList.remove("fade-enter-active", "success", "error");
    card.classList.add("fade-enter");
    requestAnimationFrame(function() { card.classList.add("fade-enter-active"); });

    var q = filteredQuestions[current];
    var globalNum = 0;
    for (var i = 0; i < allQuestions.length; i++) {
        if (allQuestions[i].id === q.id) { globalNum = i + 1; break; }
    }

    var numEl = document.getElementById("questionNumber");
    numEl.textContent = "Вопрос №" + globalNum + " из " + allQuestions.length;
    if (currentFilter !== "all" || searchQuery) {
        var info = document.createElement("div");
        info.className = "filter-info";
        info.textContent = "В выборке: " + (current + 1) + " из " + filteredQuestions.length;
        numEl.insertAdjacentElement("afterend", info);
    }

    document.getElementById("question").innerHTML = highlightText(q.question, searchQuery);
    document.getElementById("result").textContent = "";

    var a = document.getElementById("answers");
    a.innerHTML = "";
    q.answers.forEach(function(text, i) {
        var label = document.createElement("label");
        var input = document.createElement("input");
        var span = document.createElement("span");
        input.type = q.correct.length > 1 ? "checkbox" : "radio";
        input.name = "answer";
        input.value = i;
        if (progress.answers[q.id] && progress.answers[q.id].indexOf(i) !== -1) input.checked = true;
        span.innerHTML = highlightText(text, searchQuery);
        label.appendChild(input);
        label.appendChild(span);
        a.appendChild(label);
    });

    // Сбрасываем подсказку при новом вопросе
    isHintShown = false;
    document.getElementById("showAnswerBtn").textContent = "💡 Показать ответ";

    if (q.id in progress.results) showResult(false);
    updateStats();
}

/* ===== CHECK ===== */
function checkAnswer() {
    if (filteredQuestions.length === 0) return;
    var q = filteredQuestions[current];
    var selected = [];
    document.querySelectorAll("input[name='answer']").forEach(function(i) {
        if (i.checked) selected.push(Number(i.value));
    });
    if (selected.length === 0) return;
    
    progress.answers[q.id] = selected;
    var ok = selected.length === q.correct.length && selected.every(function(v) { return q.correct.indexOf(v) !== -1; });
    progress.results[q.id] = ok;
    save();
    showResult(true, ok);
    updateStats();
}

/* ===== SHOW RESULT ===== */
function showResult(animate, ok) {
    var q = filteredQuestions[current];
    var selected = progress.answers[q.id] || [];
    document.querySelectorAll("#answers label").forEach(function(l, i) {
        l.classList.remove("correct", "wrong", "hint-correct");
        if (q.correct.indexOf(i) !== -1) l.classList.add("correct");
        else if (selected.indexOf(i) !== -1) l.classList.add("wrong");
    });
    var resultEl = document.getElementById("result");
    resultEl.textContent = progress.results[q.id] ? "✅ Правильно!" : "❌ Неправильно";
    resultEl.style.color = progress.results[q.id] ? "var(--success)" : "var(--danger)";
    if (!animate) return;
    var card = document.getElementById("card");
    card.classList.remove("success", "error");
    void card.offsetWidth;
    card.classList.add(ok ? "success" : "error");
}

/* ===== NAVIGATION ===== */
function nextQuestion() { if (current < filteredQuestions.length - 1) { current++; loadQuestion(); } }
function prevQuestion() { if (current > 0) { current--; loadQuestion(); } }
function jumpTo() {
    var n = Number(document.getElementById("jumpInput").value);
    if (n >= 1 && n <= filteredQuestions.length) {
        current = n - 1;
        loadQuestion();
        document.getElementById("jumpInput").value = "";
    }
}

/* ===== RESET ===== */
function resetProgress() {
    if (!confirm("Сбросить весь прогресс?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}
function resetAll() {
    document.getElementById("searchInput").value = "";
    searchQuery = "";
    currentFilter = "all";
    document.querySelectorAll(".btn-filter").forEach(function(b) { b.classList.remove("active"); });
    document.getElementById("showAllBtn").classList.add("active");
    applyFilters();
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", function() {
    initTheme();
    document.getElementById("themeToggle").addEventListener("click", toggleTheme);
    document.getElementById("nextBtn").addEventListener("click", nextQuestion);
    document.getElementById("prevBtn").addEventListener("click", prevQuestion);
    document.getElementById("checkBtn").addEventListener("click", checkAnswer);
    document.getElementById("resetBtn").addEventListener("click", resetProgress);
    document.getElementById("jumpBtn").addEventListener("click", jumpTo);
    document.getElementById("jumpInput").addEventListener("keypress", function(e) { if (e.key === "Enter") jumpTo(); });

    // НОВАЯ КНОПКА: Показать ответ
    document.getElementById("showAnswerBtn").addEventListener("click", function() {
        if (filteredQuestions.length === 0) return;
        var q = filteredQuestions[current];
        var labels = document.querySelectorAll("#answers label");
        
        if (!isHintShown) {
            q.correct.forEach(function(i) {
                labels[i].classList.add("hint-correct");
            });
            isHintShown = true;
            this.textContent = "🙈 Скрыть ответ";
        } else {
            q.correct.forEach(function(i) {
                labels[i].classList.remove("hint-correct");
            });
            isHintShown = false;
            this.textContent = "💡 Показать ответ";
            // Если вопрос уже был решен, восстанавливаем его реальный статус
            if (q.id in progress.results) showResult(false);
        }
    });

    var filters = { showAllBtn: "all", showWrongBtn: "wrong", showCorrectBtn: "correct", showUnansweredBtn: "unanswered" };
    Object.keys(filters).forEach(function(btnId) {
        document.getElementById(btnId).addEventListener("click", function() {
            currentFilter = filters[btnId];
            document.querySelectorAll(".btn-filter").forEach(function(b) { b.classList.remove("active"); });
            document.getElementById(btnId).classList.add("active");
            applyFilters();
        });
    });

    var searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", function(e) {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() { searchQuery = e.target.value; applyFilters(); }, 400);
    });
    document.getElementById("clearSearchBtn").addEventListener("click", resetAll);

    document.addEventListener("keydown", function(e) {
        if (document.activeElement.tagName === "INPUT") {
            if (e.key === "Escape") { resetAll(); searchInput.blur(); }
            return;
        }
        if (e.key >= "1" && e.key <= "9") {
            var idx = Number(e.key) - 1;
            var inputs = document.querySelectorAll("input[name='answer']");
            if (inputs[idx]) inputs[idx].click();
        }
        if (e.key === "Enter") checkAnswer();
        if (e.key === "ArrowRight") nextQuestion();
        if (e.key === "ArrowLeft") prevQuestion();
        if (e.key.toLowerCase() === "r") resetProgress();
        if (e.key.toLowerCase() === "h") document.getElementById("showAnswerBtn").click(); // Горячая клавиша H
        if (e.key === "/") { e.preventDefault(); searchInput.focus(); }
    });

    loadQuestion();
});const STORAGE_KEY = "trainer_progress_final";
const THEME_KEY = "trainer_theme";
let allQuestions = [];
let filteredQuestions = [];
let current = 0;
let currentFilter = "all";
let searchQuery = "";
let searchTimeout = null;

/* ===== THEME ===== */
function initTheme() {
    var saved = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(saved);
}
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = document.getElementById("themeToggle");
    if (btn) {
        btn.textContent = theme === "dark" ? "☀️" : "🌙";
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#1c1c1f" : "#4f46e5");
}
function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") || "light";
    var next = cur === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
}

/* ===== PARSE QUESTIONS ===== */
if (typeof rawText !== 'undefined') {
    rawText.trim().split(/\n\s*\n/).forEach(function(block, id) {
        var lines = block.split("\n").map(function(l) { return l.trim(); }).filter(Boolean);
        if (lines.length < 3) return;
        var question = lines[0].replace(/^\d+\)?\.?/, "").trim();
        var answers = [];
        var correct = [];
        lines.slice(1).forEach(function(line) {
            if (line.startsWith("+")) {
                answers.push(line.slice(1).trim());
                correct.push(answers.length - 1);
            } else if (line.startsWith("-")) {
                answers.push(line.slice(1).trim());
            }
        });
        if (answers.length > 0) {
            allQuestions.push({ id: id, question: question, answers: answers, correct: correct });
        }
    });
    filteredQuestions = allQuestions.slice();
}

/* ===== PROGRESS ===== */
var progress = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { answers: {}, results: {} };
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }

/* ===== STATS ===== */
function updateStats() {
    var ok = 0, bad = 0;
    for (var id in progress.results) {
        if (progress.results[id]) ok++; else bad++;
    }
    var unanswered = allQuestions.length - ok - bad;
    var statsEl = document.getElementById("stats");
    if (statsEl) {
        var shown = filteredQuestions.length;
        var total = allQuestions.length;
        var info = (currentFilter !== "all" || searchQuery) ? " · " + shown + " из " + total : "";
        statsEl.innerHTML = "<span>🟢" + ok + " 🔴" + bad + " ⚪" + unanswered + "</span><span>" + (shown ? current + 1 : 0) + "/" + shown + info + "</span>";
    }
    var barEl = document.getElementById("bar");
    if (barEl && allQuestions.length > 0) {
        barEl.style.width = Math.round((ok + bad) / allQuestions.length * 100) + "%";
    }
}

/* ===== FILTERS ===== */
function applyFilters() {
    filteredQuestions = allQuestions.filter(function(q) {
        var passFilter = true;
        if (currentFilter === "wrong") passFilter = progress.results[q.id] === false;
        else if (currentFilter === "correct") passFilter = progress.results[q.id] === true;
        else if (currentFilter === "unanswered") passFilter = !(q.id in progress.results);
        var passSearch = true;
        if (searchQuery.trim()) {
            var query = searchQuery.toLowerCase().trim();
            passSearch = q.question.toLowerCase().indexOf(query) !== -1 ||
                         q.answers.join(" ").toLowerCase().indexOf(query) !== -1;
        }
        return passFilter && passSearch;
    });
    if (current >= filteredQuestions.length) current = 0;
    loadQuestion();
    updateStats();
}

/* ===== HIGHLIGHT ===== */
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function highlightText(text, query) {
    if (!query.trim()) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var regex = new RegExp("(" + escapeRegex(query) + ")", 'gi');
    return escaped.replace(regex, '<span class="highlight">$1</span>');
}

/* ===== LOAD QUESTION ===== */
function loadQuestion() {
    var card = document.getElementById("card");
    card.innerHTML = '<div class="question-number" id="questionNumber"></div><div class="question-text" id="question"></div><div class="answers-list" id="answers"></div><div class="result-message" id="result"></div>';

    if (filteredQuestions.length === 0) {
        card.innerHTML = '<div class="no-results"><div class="no-results-icon">🔍</div><div>Ничего не найдено</div><button class="btn btn-outline" onclick="resetAll()" style="margin-top:16px">Сбросить фильтры</button></div>';
        return;
    }

    card.classList.remove("fade-enter-active", "success", "error");
    card.classList.add("fade-enter");
    requestAnimationFrame(function() { card.classList.add("fade-enter-active"); });

    var q = filteredQuestions[current];
    var globalNum = 0;
    for (var i = 0; i < allQuestions.length; i++) {
        if (allQuestions[i].id === q.id) { globalNum = i + 1; break; }
    }

    var numEl = document.getElementById("questionNumber");
    numEl.textContent = "Вопрос №" + globalNum + " из " + allQuestions.length;
    if (currentFilter !== "all" || searchQuery) {
        var info = document.createElement("div");
        info.className = "filter-info";
        info.textContent = "В выборке: " + (current + 1) + " из " + filteredQuestions.length;
        numEl.insertAdjacentElement("afterend", info);
    }

    document.getElementById("question").innerHTML = highlightText(q.question, searchQuery);
    document.getElementById("result").textContent = "";

    var a = document.getElementById("answers");
    a.innerHTML = "";
    q.answers.forEach(function(text, i) {
        var label = document.createElement("label");
        var input = document.createElement("input");
        var span = document.createElement("span");
        input.type = q.correct.length > 1 ? "checkbox" : "radio";
        input.name = "answer";
        input.value = i;
        if (progress.answers[q.id] && progress.answers[q.id].indexOf(i) !== -1) input.checked = true;
        span.innerHTML = highlightText(text, searchQuery);
        label.appendChild(input);
        label.appendChild(span);
        a.appendChild(label);
    });

    if (q.id in progress.results) showResult(false);
    updateStats();
}

/* ===== CHECK ===== */
function checkAnswer() {
    if (filteredQuestions.length === 0) return;
    var q = filteredQuestions[current];
    var selected = [];
    document.querySelectorAll("input[name='answer']").forEach(function(i) {
        if (i.checked) selected.push(Number(i.value));
    });
    if (selected.length === 0) return;
    progress.answers[q.id] = selected;
    var ok = selected.length === q.correct.length && selected.every(function(v) { return q.correct.indexOf(v) !== -1; });
    progress.results[q.id] = ok;
    save();
    showResult(true, ok);
    updateStats();
}

/* ===== SHOW RESULT ===== */
function showResult(animate, ok) {
    var q = filteredQuestions[current];
    var selected = progress.answers[q.id] || [];
    document.querySelectorAll("#answers label").forEach(function(l, i) {
        l.classList.remove("correct", "wrong");
        if (q.correct.indexOf(i) !== -1) l.classList.add("correct");
        else if (selected.indexOf(i) !== -1) l.classList.add("wrong");
    });
    var resultEl = document.getElementById("result");
    resultEl.textContent = progress.results[q.id] ? "✅ Правильно!" : "❌ Неправильно";
    resultEl.style.color = progress.results[q.id] ? "var(--success)" : "var(--danger)";
    if (!animate) return;
    var card = document.getElementById("card");
    card.classList.remove("success", "error");
    void card.offsetWidth;
    card.classList.add(ok ? "success" : "error");
}

/* ===== NAVIGATION ===== */
function nextQuestion() { if (current < filteredQuestions.length - 1) { current++; loadQuestion(); } }
function prevQuestion() { if (current > 0) { current--; loadQuestion(); } }
function jumpTo() {
    var n = Number(document.getElementById("jumpInput").value);
    if (n >= 1 && n <= filteredQuestions.length) {
        current = n - 1;
        loadQuestion();
        document.getElementById("jumpInput").value = "";
    }
}

/* ===== RESET ===== */
function resetProgress() {
    if (!confirm("Сбросить весь прогресс?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}
function resetAll() {
    document.getElementById("searchInput").value = "";
    searchQuery = "";
    currentFilter = "all";
    document.querySelectorAll(".btn-filter").forEach(function(b) { b.classList.remove("active"); });
    document.getElementById("showAllBtn").classList.add("active");
    applyFilters();
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", function() {
    initTheme();
    document.getElementById("themeToggle").addEventListener("click", toggleTheme);
    document.getElementById("nextBtn").addEventListener("click", nextQuestion);
    document.getElementById("prevBtn").addEventListener("click", prevQuestion);
    document.getElementById("checkBtn").addEventListener("click", checkAnswer);
    document.getElementById("resetBtn").addEventListener("click", resetProgress);
    document.getElementById("jumpBtn").addEventListener("click", jumpTo);
    document.getElementById("jumpInput").addEventListener("keypress", function(e) { if (e.key === "Enter") jumpTo(); });

    var filters = { showAllBtn: "all", showWrongBtn: "wrong", showCorrectBtn: "correct", showUnansweredBtn: "unanswered" };
    Object.keys(filters).forEach(function(btnId) {
        document.getElementById(btnId).addEventListener("click", function() {
            currentFilter = filters[btnId];
            document.querySelectorAll(".btn-filter").forEach(function(b) { b.classList.remove("active"); });
            document.getElementById(btnId).classList.add("active");
            applyFilters();
        });
    });

    var searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", function(e) {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() { searchQuery = e.target.value; applyFilters(); }, 400);
    });
    document.getElementById("clearSearchBtn").addEventListener("click", resetAll);

    document.addEventListener("keydown", function(e) {
        if (document.activeElement.tagName === "INPUT") {
            if (e.key === "Escape") { resetAll(); searchInput.blur(); }
            return;
        }
        if (e.key >= "1" && e.key <= "9") {
            var idx = Number(e.key) - 1;
            var inputs = document.querySelectorAll("input[name='answer']");
            if (inputs[idx]) inputs[idx].click();
        }
        if (e.key === "Enter") checkAnswer();
        if (e.key === "ArrowRight") nextQuestion();
        if (e.key === "ArrowLeft") prevQuestion();
        if (e.key.toLowerCase() === "r") resetProgress();
        if (e.key.toLowerCase() === "t") toggleTheme();
        if (e.key === "/") { e.preventDefault(); searchInput.focus(); }
    });

    loadQuestion();
});
