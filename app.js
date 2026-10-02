const cases = [
  { id: "HH-0148", date: "18 JUN 2024", office: "Sotap field office", members: 5, score: 42.6, category: "High", basics: "High", probability: 51, glyph: "⌂", factors: [
    ["Basic needs", 8.7, 5.0, "High", "◒"], ["Housing stability", 8.1, 4.4, "High", "⌂"], ["Negative coping", 7.7, 3.8, "High", "↘"], ["Dependency burden", 5.6, 4.0, "Moderate", "♧"], ["Specific needs", 4.6, 2.2, "Moderate", "✳"], ["Language barrier", 2.5, 2.6, "Low", "文"]
  ], transcript: [["00:34", "We have been staying with relatives, but there is no space for all of us now.", "HOUSING INSTABILITY"], ["01:12", "Some days we skip meals so the children can eat.", "FOOD INSECURITY"], ["01:46", "I am the only adult caring for the children at the moment.", "SOLE CAREGIVER"]] },
  { id: "HH-0152", date: "18 JUN 2024", office: "Sotap field office", members: 3, score: 58.4, category: "Severe", basics: "High", probability: 82, glyph: "♧", factors: [
    ["Housing stability", 9.4, 4.4, "High", "⌂"], ["Basic needs", 9.0, 5.0, "High", "◒"], ["Dependency burden", 8.5, 4.0, "High", "♧"], ["Specific needs", 7.9, 2.2, "High", "✳"], ["Negative coping", 7.0, 3.8, "Moderate", "↘"], ["Documentation", 4.2, 3.3, "Moderate", "▤"]
  ], transcript: [["00:28", "We have moved three times this month and are staying in a temporary shelter.", "UNSTABLE HOUSING"], ["01:03", "My mother needs daily care and I cannot leave her alone.", "CARE NEEDS"], ["01:42", "We have run out of food before the end of the week more than once.", "FOOD INSECURITY"]] },
  { id: "HH-0161", date: "19 JUN 2024", office: "Fupal field office", members: 4, score: 34.2, category: "Moderate", basics: "Moderate", probability: 38, glyph: "◉", factors: [
    ["Basic needs", 6.0, 5.0, "High", "◒"], ["Housing stability", 5.4, 4.4, "Moderate", "⌂"], ["Dependency burden", 4.8, 4.0, "Moderate", "♧"], ["Documentation", 4.1, 3.3, "Moderate", "▤"], ["Language barrier", 3.0, 2.6, "Low", "文"], ["Negative coping", 2.9, 3.8, "Low", "↘"]
  ], transcript: [["00:41", "Rent is difficult to manage, although we have had the same room for several months.", "HOUSING COSTS"], ["01:18", "We have enough food most days, but we sometimes borrow from neighbours.", "BASIC NEEDS"], ["01:54", "My sister helps with the children when I need to look for work.", "SUPPORT NETWORK"]] },
  { id: "HH-0167", date: "19 JUN 2024", office: "Sotap field office", members: 1, score: 24.8, category: "Low", basics: "Moderate", probability: 49, glyph: "◍", factors: [
    ["Housing stability", 5.2, 4.4, "High", "⌂"], ["Basic needs", 4.9, 5.0, "Moderate", "◒"], ["Language barrier", 3.6, 2.6, "Moderate", "文"], ["Documentation", 3.4, 3.3, "Low", "▤"], ["Negative coping", 2.8, 3.8, "Low", "↘"], ["Specific needs", 1.7, 2.2, "Low", "✳"]
  ], transcript: [["00:36", "I rent a room month by month and do not know if I can stay after this one.", "HOUSING SECURITY"], ["01:19", "I have been trying to find more stable work since arriving.", "INCOME UNCERTAINTY"]] },
  { id: "HH-0170", date: "20 JUN 2024", office: "Foten field office", members: 6, score: 47.1, category: "High", basics: "High", probability: 71, glyph: "⌂", factors: [
    ["Dependency burden", 8.9, 4.0, "High", "♧"], ["Basic needs", 8.4, 5.0, "High", "◒"], ["Negative coping", 8.0, 3.8, "High", "↘"], ["Housing stability", 7.6, 4.4, "High", "⌂"], ["Specific needs", 5.6, 2.2, "Moderate", "✳"], ["Documentation", 2.8, 3.3, "Low", "▤"]
  ], transcript: [["00:25", "There are six of us in a one-room apartment, including my elderly father.", "CROWDING & CARE"], ["01:11", "We have reduced meals at the end of the month to make the money last.", "FOOD INSECURITY"], ["01:55", "My father needs help getting to medical appointments.", "CARE NEEDS"]] },
  { id: "HH-0174", date: "20 JUN 2024", office: "Pcr Cdmx field office", members: 2, score: 18.9, category: "Low", basics: "Low", probability: 25, glyph: "◌", factors: [
    ["Documentation", 3.8, 3.3, "Moderate", "▤"], ["Language barrier", 3.1, 2.6, "Moderate", "文"], ["Housing stability", 2.8, 4.4, "Low", "⌂"], ["Basic needs", 2.6, 5.0, "Low", "◒"], ["Dependency burden", 1.9, 4.0, "Low", "♧"], ["Negative coping", 1.4, 3.8, "Low", "↘"]
  ], transcript: [["00:33", "We can cover rent this month, but we have very little set aside for emergencies.", "FINANCIAL RESILIENCE"], ["01:28", "My partner translates for me when we need to visit an office.", "LANGUAGE SUPPORT"]] }
];

let selectedCase = cases[0];
let selectedDecision = null;
const decisionLog = [];
const list = document.getElementById("case-list");
const factorList = document.getElementById("factor-list");
const recordButton = document.getElementById("record-decision");
const reasonInput = document.getElementById("override-reason");
const feedback = document.getElementById("decision-feedback");

function modelDecision(item) { return item.probability > 50 ? "eligible" : "not-eligible"; }
function shortId(id) { return id.replace("HH-", ""); }

function renderQueue() {
  list.innerHTML = cases.map((item, index) => {
    const logged = decisionLog.some(entry => entry.id === item.id);
    return `<button class="case-row ${selectedCase.id === item.id ? "selected" : ""}" data-case-index="${index}" aria-current="${selectedCase.id === item.id}">
      <span class="case-avatar">${item.glyph}</span><span class="case-row-text"><strong>Household ${shortId(item.id)}</strong><small>${item.members} members · ${item.category} need</small></span><span class="case-state ${logged ? "done" : ""}"></span>
    </button>`;
  }).join("");
  document.getElementById("history-count").textContent = decisionLog.length;
}

function renderFactors(item) {
  factorList.innerHTML = item.factors.map(([name, value, reference, impact, glyph]) => `<div class="factor-row">
    <div class="factor-name"><span class="factor-glyph">${glyph}</span><span>${name}</span></div>
    <div class="factor-score">${value.toFixed(1)} <small>/ 10</small></div><div class="sample-score">${reference.toFixed(1)} <small>/ 10</small></div>
    <div class="impact"><span class="impact-badge impact-${impact.toLowerCase()}">${impact}</span></div>
  </div>`).join("");
}

function renderCase() {
  const item = selectedCase;
  const priorDecision = decisionLog.find(entry => entry.id === item.id);
  document.getElementById("case-id").textContent = item.id;
  document.getElementById("case-date").textContent = item.date;
  document.getElementById("location").textContent = item.office;
  document.getElementById("profile-summary").innerHTML = `${String(item.members).padStart(2, "0")} household members <i>·</i> ${priorDecision ? "Case solved" : "Interview completed"}`;
  document.getElementById("case-status").textContent = priorDecision ? "Case solved" : "Awaiting decision";
  document.getElementById("case-status-chip").classList.toggle("solved", Boolean(priorDecision));
  document.getElementById("case-status-chip").classList.toggle("awaiting", !priorDecision);
  document.getElementById("final-score").textContent = item.score.toFixed(1);
  document.getElementById("category").textContent = item.category;
  document.getElementById("score-progress").style.width = `${Math.min(item.score / 81.1 * 100, 100)}%`;
  document.getElementById("score-delta").textContent = `${item.score >= 27.7 ? "+" : ""}${(item.score - 27.7).toFixed(1)} ${item.score >= 27.7 ? "above" : "below"} mean ${item.score >= 27.7 ? "↗" : "↘"}`;
  document.getElementById("household-size").innerHTML = `${String(item.members).padStart(2, "0")} <small>people</small>`;
  document.getElementById("basic-needs-summary").innerHTML = `${item.basics} <small>severity</small>`;
  document.getElementById("probability").textContent = item.probability;
  document.getElementById("probability-fill").style.width = `${item.probability}%`;
  document.getElementById("prob-caption").textContent = item.probability === 50 ? "Even chance" : item.probability > 50 ? item.probability < 60 ? "Slightly more likely eligible" : "More likely eligible" : item.probability > 40 ? "Slightly more likely not eligible" : "More likely not eligible";
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
  decisionLog.unshift({ id: selectedCase.id, probability: selectedCase.probability, model: modelDecision(selectedCase), decision: selectedDecision, override, reason: override ? reasonInput.value.trim() : "", time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date()) });
  feedback.textContent = override ? "Override recorded with your reason." : "Decision recorded.";
  document.getElementById("profile-summary").innerHTML = `${String(selectedCase.members).padStart(2, "0")} household members <i>·</i> Case solved`;
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
  rows.innerHTML = decisionLog.map(entry => `<tr><td>${entry.id}</td><td><span class="table-prob">${entry.probability}%</span> · ${entry.model === "eligible" ? "Eligible" : "Not eligible"}</td><td>${entry.decision === "eligible" ? "Eligible" : "Not eligible"}${entry.reason ? `<br><small class="reason-note">Reason: ${escapeHtml(entry.reason)}</small>` : ""}</td><td><span class="table-chip ${entry.override ? "override" : "agree"}">${entry.override ? "Override" : "Aligned"}</span></td><td>${entry.time}</td></tr>`).join("");
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
