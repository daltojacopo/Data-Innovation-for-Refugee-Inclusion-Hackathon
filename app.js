const cases = window.CASHY_DEMO_CASES;
const referenceMedians = window.CASHY_REFERENCE_MEDIANS;

let selectedCase = cases[0];
let selectedDecision = null;
let vulnerabilityAscending = true;
const decisionLog = [];
const list = document.getElementById("case-list");
const factorList = document.getElementById("factor-list");
const recordButton = document.getElementById("record-decision");
const reasonInput = document.getElementById("override-reason");
const feedback = document.getElementById("decision-feedback");

function modelDecision(item) { return item.probability > 50 ? "eligible" : "not-eligible"; }
function shortId(id) { return id.replace("HH-", ""); }
function householdLabel(count) { return `${count} household ${count === 1 ? "member" : "members"}`; }

function renderQueue() {
  const previousOpen = Object.fromEntries([...list.querySelectorAll("details[data-queue-group]")].map(group => [group.dataset.queueGroup, group.open]));
  const makeRows = subset => [...subset].sort((a, b) => (a.score - b.score) * (vulnerabilityAscending ? 1 : -1)).map(item => {
    const index = cases.indexOf(item);
    const logged = decisionLog.some(entry => entry.id === item.id);
    return `<button class="case-row ${selectedCase.id === item.id ? "selected" : ""}" data-case-index="${index}" aria-current="${selectedCase.id === item.id}">
      <span class="case-avatar" aria-hidden="true">${shortId(item.id)}</span><span class="case-row-text"><strong>Household ${shortId(item.id)}</strong><small>${item.members} ${item.members === 1 ? "member" : "members"} · ${item.category} need</small></span><span class="case-state vulnerability-${item.category.toLowerCase()}" title="${item.category} vulnerability" aria-label="Vulnerability: ${item.category}"></span>
    </button>`;
  }).join("");
  const completed = cases.filter(item => decisionLog.some(entry => entry.id === item.id));
  const pending = cases.filter(item => !decisionLog.some(entry => entry.id === item.id));
  const group = (key, title, subset) => `<details class="case-queue-group" data-queue-group="${key}" ${previousOpen[key] ?? true ? "open" : ""}><summary><span>${title}</span><b>${subset.length}</b></summary><div class="case-queue-items">${makeRows(subset) || `<p class="empty-queue">No households</p>`}</div></details>`;
  list.innerHTML = group("pending", "To complete", pending) + group("completed", "Completed", completed);
  const sortButton = document.getElementById("sort-households");
  sortButton.querySelector("span").textContent = `Vulnerability: ${vulnerabilityAscending ? "Low → High" : "High → Low"}`;
  sortButton.setAttribute("aria-label", `Sort households by vulnerability, ${vulnerabilityAscending ? "low to high" : "high to low"}. Activate to reverse order.`);
  sortButton.title = `Reverse vulnerability order (${vulnerabilityAscending ? "currently low to high" : "currently high to low"})`;
  document.getElementById("history-count").textContent = decisionLog.length;
  document.getElementById("household-total").textContent = String(cases.length).padStart(2, "0");
}

function renderFactors(item) {
  const order = ["Demographics", "Needs and coping"];
  factorList.innerHTML = order.map(group => `<details class="factor-group" open><summary>${group} <span>scorecard block</span></summary>${item.factors.filter(factor => factor.group === group).map(factor => {
    const median = referenceMedians[factor.key];
    const distance = factor.value - median;
    const comparison = Math.abs(distance) < 0.0005 ? "At median" : `${distance > 0 ? "+" : "−"}${Math.abs(distance).toFixed(2)} vs median`;
    return `<div class="factor-row">
      <div class="factor-name"><span class="factor-glyph">${factorGlyph(factor.key)}</span><span>${factor.name}</span></div>
      <div class="factor-score">${factor.value.toFixed(2)}</div><div class="sample-score">${median.toFixed(2)}</div>
      <div class="importance-cell" title="Global importance: ${factor.importance.toFixed(4)} ± ${factor.std.toFixed(4)}; p = ${factor.p.toExponential(2)}"><small class="factor-delta">${comparison}</small><span class="importance-bar"><i style="width:${factor.importance / 0.069211 * 100}%"></i></span><small>Global ${factor.importance.toFixed(3)}</small></div>
    </div>`;
  }).join("")}</details>`).join("");
  renderAdministrativeChecks(item);
}

function factorGlyph(key) {
  return ({"Demographics.HH.Head":"⌂","Demographics.Language":"文","Demographics.Profiles":"✳","Demographics.Documentation":"▤","Needs_and_Coping.BasicNeeds":"◒","Needs_and_Coping.Housing":"⌂","Needs_and_Coping.Neg.mechanism":"↘","Needs_and_Coping.Dependency":"♧"})[key];
}

function flagDisplay(value, type) {
  if (value === "" || value == null) return { status: "Not applicable", detail: "Blank in source record", state: "neutral" };
  const numeric = Number(value);
  if (type === "comar") return numeric === 0 ? {status:"No score modifier", detail:"0 recorded", state:"clear"} : {status:"Administrative modifier", detail:`${numeric > 0 ? "+" : ""}${numeric} in source record`, state:"flagged"};
  return numeric === 0 ? {status:"No flag recorded", detail:"0 recorded", state:"clear"} : {status:"Flag recorded", detail:`${numeric} in source record`, state:"flagged"};
}

function renderAdministrativeChecks(item) {
  const checks = [
    ["Asylum procedure (COMAR)", flagDisplay(item.admin.comar, "comar")],
    ["Stated intentions", flagDisplay(item.admin.intentions, "flag")],
    ["Duplicate registration", flagDisplay(item.admin.duplicate, "flag")]
  ];
  document.getElementById("admin-flags").innerHTML = checks.map(([label, info]) => `<article class="admin-flag ${info.state}"><span class="admin-indicator" aria-hidden="true"></span><div><strong>${label}</strong><b>${info.status}</b><small>${info.detail}</small></div></article>`).join("");
  const attrs = item.attributes;
  const labels = [["Dependency category", attrs.dependencyCategory], ["Female-headed household", decodeYesNo(attrs.femaleHeaded)], ["Sole carer", decodeYesNo(attrs.soleCarer)], ["Adult speaks Spanish", decodeSpanish(attrs.spanish)], ["Adult illiteracy", decodeIlliteracy(attrs.illiteracy)], ["Field office", item.office]];
  document.getElementById("case-attributes").innerHTML = labels.map(([label, value]) => `<div><span>${label}</span><strong>${value || "Not recorded"}</strong></div>`).join("");
}
function decodeYesNo(value) { return ({"si":"Yes","no":"No"})[value] || (value ? value : "Not recorded"); }
function decodeSpanish(value) { return ({"espanol_uno_mas_adultos":"One or more adults","espanol_ningun_adulto":"No adult"})[value] || (value ? value : "Not recorded"); }
function decodeIlliteracy(value) { return ({"adultos_ninguno_analfabeta":"No adult","adultos_uno_mas_analfabeta":"One or more adults"})[value] || (value ? value : "Not recorded"); }

function renderCase() {
  const item = selectedCase;
  const priorDecision = decisionLog.find(entry => entry.id === item.id);
  document.getElementById("case-id").textContent = item.id;
  document.getElementById("case-date").textContent = item.date;
  document.getElementById("location").textContent = item.office;
  document.getElementById("profile-summary").innerHTML = `${householdLabel(item.members)} <i>·</i> ${priorDecision ? "Case solved" : "Interview completed"}`;
  document.getElementById("case-status").textContent = priorDecision ? "Case solved" : "Awaiting decision";
  document.getElementById("case-status-chip").classList.toggle("solved", Boolean(priorDecision));
  document.getElementById("case-status-chip").classList.toggle("awaiting", !priorDecision);
  document.getElementById("final-score").textContent = item.score.toFixed(1);
  document.getElementById("category").textContent = item.category;
  document.getElementById("score-progress").style.width = `${Math.min(item.score / 81.1 * 100, 100)}%`;
  document.getElementById("score-delta").textContent = `${item.score >= 27.7 ? "+" : ""}${(item.score - 27.7).toFixed(1)} ${item.score >= 27.7 ? "above" : "below"} mean ${item.score >= 27.7 ? "↗" : "↘"}`;
  document.getElementById("household-size").innerHTML = `${item.members} <small>${item.members === 1 ? "person" : "people"}</small>`;
  document.getElementById("basic-needs-summary").innerHTML = `${item.basics} <small>severity</small>`;
  document.getElementById("probability").textContent = item.probability;
  document.getElementById("probability-fill").style.width = `${item.probability}%`;
  const probabilityCaption = document.getElementById("prob-caption");
  probabilityCaption.textContent = item.probability === 50 ? "Even chance" : item.probability > 50 ? item.probability < 60 ? "Slightly more likely eligible" : "More likely eligible" : item.probability > 40 ? "Slightly more likely not eligible" : "More likely not eligible";
  const probabilityDot = probabilityCaption.previousElementSibling;
  probabilityDot.classList.remove("dot-yellow", "dot-light-green", "dot-dark-green");
  if (item.probability >= 25 && item.probability < 50) probabilityDot.classList.add("dot-yellow");
  else if (item.probability >= 50 && item.probability < 75) probabilityDot.classList.add("dot-light-green");
  else if (item.probability >= 75) probabilityDot.classList.add("dot-dark-green");
  document.getElementById("profile-summary").setAttribute("aria-label", `${item.members} household members, ${priorDecision ? "case solved" : "interview completed"}`);
  renderFactors(item);
  selectedDecision = null;
  reasonInput.value = "";
  reasonInput.classList.add("hidden");
  feedback.textContent = priorDecision ? `Recorded: ${priorDecision.decision === "eligible" ? "Eligible" : "Not eligible"}${priorDecision.override ? " · override reason saved" : ""}.` : "";
  document.querySelectorAll(".decision-button").forEach(button => { button.classList.remove("selected"); button.disabled = Boolean(priorDecision); });
  recordButton.disabled = true;
  renderQueue();
}

function updateDecisionState() {
  const isOverride = selectedDecision && selectedDecision !== modelDecision(selectedCase);
  reasonInput.classList.toggle("hidden", !isOverride);
  recordButton.disabled = !selectedDecision || (isOverride && !reasonInput.value.trim());
  feedback.textContent = isOverride ? "This differs from the probability-based audit category. Add a short reason to record the override." : selectedDecision ? "This decision matches the probability-based audit category." : "";
}

document.querySelectorAll(".decision-button").forEach(button => button.addEventListener("click", () => {
  selectedDecision = button.dataset.decision;
  document.querySelectorAll(".decision-button").forEach(item => item.classList.toggle("selected", item === button));
  updateDecisionState();
}));
reasonInput.addEventListener("input", updateDecisionState);

recordButton.addEventListener("click", () => {
  if (!selectedDecision || recordButton.disabled) return;
  const override = selectedDecision !== modelDecision(selectedCase);
  const recordedAt = new Date();
  decisionLog.unshift({ id: selectedCase.id, probability: selectedCase.probability, model: modelDecision(selectedCase), decision: selectedDecision, override, reason: override ? reasonInput.value.trim() : "", time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(recordedAt), date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(recordedAt) });
  feedback.textContent = override ? "Override recorded with your reason." : "Decision recorded.";
  document.getElementById("profile-summary").innerHTML = `${householdLabel(selectedCase.members)} <i>·</i> Case solved`;
  document.getElementById("case-status").textContent = "Case solved";
  document.getElementById("case-status-chip").classList.remove("awaiting");
  document.getElementById("case-status-chip").classList.add("solved");
  document.querySelectorAll(".decision-button").forEach(button => { button.disabled = true; });
  renderQueue();
  recordButton.disabled = true;
  document.getElementById("history-count").textContent = decisionLog.length;
});

list.addEventListener("click", event => {
  const button = event.target.closest("[data-case-index]");
  if (!button) return;
  selectedCase = cases[Number(button.dataset.caseIndex)];
  renderCase();
  showView("review");
});
document.getElementById("sort-households").addEventListener("click", () => {
  vulnerabilityAscending = !vulnerabilityAscending;
  renderQueue();
});
document.getElementById("next-case").addEventListener("click", () => {
  selectedCase = cases[(cases.indexOf(selectedCase) + 1) % cases.length];
  renderCase();
});

function showView(name) {
  const history = name === "history";
  document.getElementById("review-view").classList.toggle("hidden", history);
  document.getElementById("history-view").classList.toggle("hidden", !history);
  document.getElementById("topbar-view").textContent = history ? "Decision history" : "Case review";
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  if (history) renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
document.getElementById("back-to-review").addEventListener("click", () => showView("review"));
document.getElementById("start-review").addEventListener("click", () => showView("review"));

function renderHistory() {
  const overrides = decisionLog.filter(entry => entry.override).length;
  const average = decisionLog.length ? Math.round(decisionLog.reduce((total, entry) => total + entry.probability, 0) / decisionLog.length) : "—";
  document.getElementById("history-summary").innerHTML = `<article class="history-stat"><span>DECISIONS RECORDED</span><strong>${decisionLog.length}</strong><small>Across this demo session</small></article><article class="history-stat"><span>OVERRIDES</span><strong>${overrides}</strong><small>Decision differs from probability category</small></article><article class="history-stat"><span>MEAN CASHY PROBABILITY</span><strong>${average}${average === "—" ? "" : "%"}</strong><small>Descriptive only · not a performance score</small></article>`;
  const rows = document.getElementById("history-rows");
  rows.innerHTML = decisionLog.map(entry => `<tr><td>${entry.id}</td><td><span class="table-prob">${entry.probability}%</span> · ${entry.model === "eligible" ? "Eligible" : "Not eligible"}</td><td>${entry.decision === "eligible" ? "Eligible" : "Not eligible"}${entry.reason ? `<br><small class="reason-note">Reason: ${escapeHtml(entry.reason)}</small>` : ""}</td><td><span class="table-chip ${entry.override ? "override" : "agree"}">${entry.override ? "Override" : "Aligned"}</span></td><td><span class="history-time">${entry.time}</span><small class="history-date">${entry.date}</small></td></tr>`).join("");
  document.getElementById("empty-history").classList.toggle("hidden", decisionLog.length > 0);
}
function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

const modal = document.getElementById("notes-modal");
function openNotes() {
  document.getElementById("transcript-list").innerHTML = selectedCase.transcript.map(([time, quote, tag]) => `<div class="transcript-entry"><span class="timestamp">${time}</span><p>“${escapeHtml(quote)}”<br><span class="transcript-tag">${tag}</span></p></div>`).join("");
  modal.classList.remove("hidden");
}
function closeNotes() { modal.classList.add("hidden"); }
document.getElementById("open-notes").addEventListener("click", openNotes);
document.getElementById("close-notes").addEventListener("click", closeNotes);
document.getElementById("done-notes").addEventListener("click", closeNotes);
modal.addEventListener("click", event => { if (event.target === modal) closeNotes(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeNotes(); });

renderCase();
