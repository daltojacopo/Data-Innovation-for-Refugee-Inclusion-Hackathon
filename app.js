const demoCases = window.CASHY_DEMO_CASES;
const referenceMedians = window.CASHY_REFERENCE_MEDIANS;
const factorMetadata = new Map(demoCases[0].factors.map(factor => [factor.key, factor]));
const csvFactorKeys = [
  "Demographics.HH.Head", "Demographics.Language", "Demographics.Profiles", "Demographics.Documentation",
  "Needs_and_Coping.BasicNeeds", "Needs_and_Coping.Housing", "Needs_and_Coping.Neg.mechanism", "Needs_and_Coping.Dependency"
];

function csvHeaderKey(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCsvHousehold(row) {
  const values = new Map(Object.entries(row).map(([key, value]) => [csvHeaderKey(key), value == null ? "" : String(value).trim()]));
  const read = (...keys) => {
    for (const key of keys) {
      const value = values.get(csvHeaderKey(key));
      if (value !== undefined) return value;
    }
    return "";
  };
  const sourceId = read("Household_ID", "Household ID", "id");
  if (!sourceId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sourceId)) throw new Error("missing or invalid household ID");
  const number = (field, ...aliases) => {
    const raw = read(field, ...aliases);
    if (!raw) return NaN;
    return Number(raw.replace(",", "."));
  };
  const members = number("NumIntegrantes", "Household size", "members");
  const score = number("FinalScore", "Final score", "score");
  if (!Number.isInteger(members) || members < 1 || members > 11) throw new Error("invalid household size");
  if (!Number.isFinite(score) || score < 0 || score > 81.1) throw new Error("invalid FinalScore");

  const categoryValue = read("Vulnerability_Category", "Vulnerability category", "category").trim().toLowerCase();
  const category = ({
    "vulnerabilidad baja": "Low", low: "Low", "baja": "Low",
    "vulnerabilidad moderada": "Moderate", moderada: "Moderate", moderate: "Moderate",
    "vulnerabilidad elevada": "High", elevada: "High", high: "High",
    "vulnerabilidad severa": "Severe", severa: "Severe", severe: "Severe"
  })[categoryValue];
  if (!category) throw new Error("unknown vulnerability category");

  const factors = csvFactorKeys.map(key => {
    const metadata = factorMetadata.get(key);
    const value = number(key);
    if (!metadata || !Number.isFinite(value)) throw new Error(`missing or invalid factor: ${key}`);
    return { ...metadata, value };
  });
  const optional = key => read(key);
  return {
    id: `S8-${sourceId}`,
    sourceId,
    source: "S8 sample",
    date: read("month", "date"),
    office: read("OficinaACNUR", "UNHCR field office") || "Not recorded",
    members,
    score,
    category,
    factors,
    admin: {
      comar: optional("ScoreCOMAR_PIL"),
      intentions: optional("ScoreIntenciones"),
      duplicate: optional("ScoreDuplicidad")
    },
    attributes: {
      dependencyCategory: optional("dependencyCategory"),
      femaleHeaded: optional("FemaleHeadedHousehold"),
      soleCarer: optional("CuidadorSolo"),
      spanish: optional("HablaEspanol"),
      illiteracy: optional("Analfabeta_si")
    },
    sourceScores: {
      demographics: number("Demographics_Score"),
      needsAndCoping: number("NeedsandCoping_Score"),
      vulnerabilityIndex: number("Vulnerability_Score")
    }
  };
}

function normalizeCsvRows(rows) {
  const cases = [];
  const errors = [];
  const seen = new Set();
  let duplicates = 0;
  rows.forEach((row, index) => {
    try {
      const household = normalizeCsvHousehold(row);
      if (seen.has(household.id)) { duplicates += 1; return; }
      seen.add(household.id);
      cases.push(household);
    } catch (error) {
      errors.push({ row: row.__csvRow ?? index + 2, reason: error.message });
    }
  });
  return { cases, errors, duplicates };
}

const bundledS8 = normalizeCsvRows(window.CASHY_S8_ROWS || []);
let cases = [...demoCases, ...bundledS8.cases];

let selectedCase = cases[0];
let selectedDecision = null;
let vulnerabilityAscending = true;
const decisionLog = [];
const list = document.getElementById("case-list");
const factorList = document.getElementById("factor-list");
const recordButton = document.getElementById("record-decision");
const feedback = document.getElementById("decision-feedback");
const nextHouseholdButton = document.getElementById("next-household-after-decision");
const queueCompleteNotice = document.getElementById("queue-complete-notice");

const interviewExamples = {
  "HH-0148": { note: "The interviewee describes renting a room month to month. They say essential needs are generally met at present, but they have little room in the budget for unexpected costs.", moments: [["00:34", "I rent the room one month at a time and do not know what will happen after that.", "HOUSING UNCERTAINTY"], ["01:11", "Most weeks I can manage food, but there is not much left for an emergency.", "BUDGET PRESSURE"]] },
  "HH-0152": { note: "The interviewee reports that access to food and hygiene items can become difficult toward the end of the month. They mention relying on occasional help from relatives.", moments: [["00:28", "My relatives help when they can, but I try not to ask too often.", "SUPPORT NETWORK"], ["01:06", "Near the end of the month I sometimes have to choose what to buy first.", "BASIC NEEDS"]] },
  "HH-0156": { note: "The respondent describes balancing housing and food costs for the household. A relative can sometimes help with childcare, though that support is not always available.", moments: [["00:42", "When rent is due, there is less left for other things.", "HOUSEHOLD COSTS"], ["01:19", "My relative can watch the children sometimes, but not every week.", "CARE SUPPORT"]] },
  "HH-0160": { note: "The interviewee says their current accommodation is temporary. They report occasional difficulty covering basic expenses and have limited savings for an unexpected change.", moments: [["00:31", "I can stay here for now, but I do not know how long it will last.", "TEMPORARY HOUSING"], ["01:14", "If something unexpected happens, I do not have savings to fall back on.", "FINANCIAL BUFFER"]] },
  "HH-0164": { note: "The respondent describes recent disruption to their living situation and difficulty meeting essential needs consistently. Follow up on their current accommodation and immediate priorities.", moments: [["00:37", "We have had to move more than once recently.", "RECENT MOVES"], ["01:23", "Some days it is difficult to cover everything we need.", "UNMET NEEDS"]] },
  "HH-0168": { note: "The interviewee reports repeated changes in accommodation and describes caring responsibilities within the household. They say that food can run short before the end of the month.", moments: [["00:24", "We have moved several times and are still looking for somewhere stable.", "HOUSING INSTABILITY"], ["01:02", "I help care for a family member at home.", "CARE RESPONSIBILITY"], ["01:39", "Sometimes food runs short before the month is over.", "FOOD ACCESS"]] }
};

function shortId(id) { return String(id).replace(/^(?:HH-|S8-)/, ""); }
function illustrativeHouseholdMix(item) {
  const headSex = item.attributes.femaleHeaded === "jefatura_femenina" ? "woman" : item.attributes.femaleHeaded === "jefatura_masculina" ? "man" : null;
  const seedSource = item.sourceId || item.id.replace(/\D/g, "");
  const seed = Number(String(seedSource).slice(-2)) || 0;
  const mix = [{ age: "adult", sex: headSex || (seed % 2 ? "woman" : "man"), recorded: Boolean(headSex) }];
  for (let index = 1; index < item.members; index += 1) {
    const isChild = item.members > 2 ? index === item.members - 1 : item.members === 2 && item.attributes.soleCarer === "si";
    mix.push({ age: isChild ? "child" : "adult", sex: ((seed + index) % 2 ? "girl" : "boy"), recorded: false });
  }
  return mix;
}

function personIcon(person) {
  const child = person.age === "child";
  const woman = person.sex === "woman" || person.sex === "girl";
  const viewBox = child ? "0 0 12 18" : "0 0 14 21";
  const cx = child ? 6 : 7;
  const headY = child ? 3 : 4;
  const headR = child ? 2.5 : 3;
  const torso = child ? "M6 7c-1.8 0-3.2 1.4-3.2 3.2v2.3h1.5V18h3.4v-5.5h1.5v-2.3C9.2 8.4 7.8 7 6 7Z" : "M7 9c-2.2 0-4 1.8-4 4v3h2v5h4v-5h2v-3c0-2.2-1.8-4-4-4Z";
  const hair = woman ? `<path d="M${cx - headR} ${headY}c.2-2.2 1.5-3.4 ${headR}-3.4s${headR - .2} 1.2 ${headR} 3.4c-.7-.7-1.5-1-3-1s-2.3.3-3 1Z"/>` : "";
  return `<svg viewBox="${viewBox}" role="img" aria-label="${person.sex === "woman" ? "Adult woman" : person.sex === "man" ? "Adult man" : person.sex === "girl" ? "Girl" : "Boy"}${person.recorded ? ", head sex from source data" : ", illustrative"}" focusable="false"><circle cx="${cx}" cy="${headY}" r="${headR}"/><path d="${torso}"/>${hair}</svg>`;
}

function renderQueue() {
  const previousOpen = Object.fromEntries([...list.querySelectorAll("details[data-queue-group]")].map(group => [group.dataset.queueGroup, group.open]));
  const makeRows = subset => [...subset].sort((a, b) => (a.score - b.score) * (vulnerabilityAscending ? 1 : -1)).map(item => {
    const index = cases.indexOf(item);
    const logged = decisionLog.some(entry => entry.id === item.id);
    return `<button class="case-row ${selectedCase.id === item.id ? "selected" : ""}" data-case-index="${index}" aria-current="${selectedCase.id === item.id}">
      <span class="case-avatar" aria-hidden="true">${escapeHtml(shortId(item.id))}</span><span class="case-row-text"><strong>Household ${escapeHtml(shortId(item.id))}</strong><small>${item.members} ${item.members === 1 ? "member" : "members"} · ${escapeHtml(item.category)} need</small></span><span class="case-state vulnerability-${escapeHtml(item.category.toLowerCase())}" title="${escapeHtml(item.category)} vulnerability" aria-label="Vulnerability: ${escapeHtml(item.category)}"></span>
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
  document.getElementById("case-attributes").innerHTML = labels.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value || "Not recorded")}</strong></div>`).join("");
}
function decodeYesNo(value) { return ({"si":"Yes","no":"No"})[value] || (value ? value : "Not recorded"); }
function decodeSpanish(value) { return ({"espanol_uno_mas_adultos":"One or more adults","espanol_ningun_adulto":"No adult"})[value] || (value ? value : "Not recorded"); }
function decodeIlliteracy(value) { return ({"adultos_ninguno_analfabeta":"No adult","adultos_uno_mas_analfabeta":"One or more adults"})[value] || (value ? value : "Not recorded"); }

function renderInterviewRecord(item) {
  const example = interviewExamples[item.id];
  document.getElementById("interviewer-note-text").textContent = example ? example.note : "No interviewer note is included in this S8 record.";
  document.getElementById("transcript-list").innerHTML = example ? example.moments.map(([time, quote, tag]) => `<div class="transcript-entry"><span class="timestamp">${time}</span><p>“${escapeHtml(quote)}”<br><span class="transcript-tag">${tag}</span></p></div>`).join("") : `<p class="transcript-empty">The S8 CSV contains no interview recording or transcript.</p>`;
}

function setCaseTab(name) {
  document.querySelectorAll("[data-case-tab]").forEach(button => {
    const selected = button.dataset.caseTab === name;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  document.getElementById("assessment-panel").classList.toggle("hidden", name !== "assessment");
  document.getElementById("interview-panel").classList.toggle("hidden", name !== "interview");
}

function renderCase() {
  const item = selectedCase;
  const priorDecision = decisionLog.find(entry => entry.id === item.id);
  document.getElementById("case-id").textContent = item.id;
  document.getElementById("case-date").textContent = item.date;
  document.getElementById("location").textContent = item.office;
  document.getElementById("profile-summary").textContent = priorDecision ? "Case solved" : "Interview completed";
  document.getElementById("case-status").textContent = priorDecision ? "Case solved" : "Awaiting decision";
  document.getElementById("case-status-chip").classList.toggle("solved", Boolean(priorDecision));
  document.getElementById("case-status-chip").classList.toggle("awaiting", !priorDecision);
  document.getElementById("final-score").textContent = item.score.toFixed(1);
  document.getElementById("category").textContent = item.category;
  document.getElementById("score-progress").style.width = `${Math.min(item.score / 81.1 * 100, 100)}%`;
  document.getElementById("score-delta").textContent = `${item.score >= 27.7 ? "+" : ""}${(item.score - 27.7).toFixed(1)} ${item.score >= 27.7 ? "above" : "below"} mean ${item.score >= 27.7 ? "↗" : "↘"}`;
  document.getElementById("household-size").innerHTML = `${item.members} <small>${item.members === 1 ? "person" : "people"}</small>`;
  const peopleIcons = document.getElementById("household-people");
  const householdMix = illustrativeHouseholdMix(item);
  peopleIcons.innerHTML = householdMix.map(personIcon).join("");
  peopleIcons.setAttribute("aria-label", `Illustrative household mix, ${householdMix.map(person => `${person.age} ${person.sex}${person.recorded ? " (head sex from source data)" : " (illustrative)"}`).join(", ")}. Ages and individual sex are not recorded in the source data.`);
  const adminFlagCount = Object.values(item.admin).filter(value => value !== "" && value != null && Number(value) !== 0).length;
  const adminSummary = document.getElementById("admin-checks-summary");
  adminSummary.innerHTML = adminFlagCount ? `${adminFlagCount} <small>${adminFlagCount === 1 ? "flag to review" : "flags to review"}</small>` : "No flags <small>recorded</small>";
  const adminIcon = document.getElementById("admin-checks-icon");
  adminIcon.textContent = adminFlagCount ? "!" : "✓";
  adminIcon.classList.toggle("icon-amber", adminFlagCount > 0);
  adminIcon.classList.toggle("icon-green", adminFlagCount === 0);
  adminIcon.closest(".metric-card").classList.toggle("has-admin-flags", adminFlagCount > 0);
  const cashySignal = document.getElementById("cashy-demo-signal");
  cashySignal.classList.toggle("hidden", !(item.cashyDemoConfidence > 85));
  cashySignal.open = false;
  document.getElementById("profile-summary").setAttribute("aria-label", priorDecision ? "Case solved" : "Interview completed");
  renderFactors(item);
  renderInterviewRecord(item);
  const pendingCount = cases.filter(candidate => !decisionLog.some(entry => entry.id === candidate.id)).length;
  nextHouseholdButton.classList.toggle("hidden", !priorDecision || pendingCount === 0);
  queueCompleteNotice.classList.toggle("hidden", !priorDecision || pendingCount > 0);
  selectedDecision = null;
  feedback.textContent = priorDecision ? `Recorded: ${priorDecision.decision === "eligible" ? "Eligible" : "Not eligible"}.` : "";
  document.querySelectorAll(".decision-button").forEach(button => { button.classList.remove("selected"); button.disabled = Boolean(priorDecision); });
  recordButton.disabled = true;
  renderQueue();
}

function updateDecisionState() {
  recordButton.disabled = !selectedDecision;
  feedback.textContent = selectedDecision ? "Decision selected. Record it when ready." : "";
}

document.querySelectorAll(".decision-button").forEach(button => button.addEventListener("click", () => {
  selectedDecision = button.dataset.decision;
  document.querySelectorAll(".decision-button").forEach(item => item.classList.toggle("selected", item === button));
  updateDecisionState();
}));
recordButton.addEventListener("click", () => {
  if (!selectedDecision || recordButton.disabled) return;
  const recordedAt = new Date();
  decisionLog.unshift({ id: selectedCase.id, decision: selectedDecision, time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(recordedAt), date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(recordedAt) });
  renderCase();
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
nextHouseholdButton.addEventListener("click", () => {
  const pending = cases.filter(item => !decisionLog.some(entry => entry.id === item.id));
  pending.sort((a, b) => (a.score - b.score) * (vulnerabilityAscending ? 1 : -1));
  if (!pending.length) return;
  selectedCase = pending[0];
  setCaseTab("assessment");
  renderCase();
  showView("review");
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

const sidebarToggle = document.getElementById("sidebar-toggle");
sidebarToggle.addEventListener("click", () => {
  const collapsed = document.querySelector(".app-shell").classList.toggle("sidebar-collapsed");
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "Show sidebar" : "Hide sidebar");
  sidebarToggle.title = collapsed ? "Show sidebar" : "Hide sidebar";
});

function parseCsvText(text) {
  const cleaned = String(text).replace(/^\uFEFF/, "");
  const firstLine = cleaned.split(/\r?\n/, 1)[0] || "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const table = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (quoted) {
      if (char === '"' && cleaned[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      row.push(field); field = "";
      if (row.some(value => value.trim() !== "")) table.push(row);
      row = [];
      if (char === "\r" && cleaned[index + 1] === "\n") index += 1;
    } else field += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some(value => value.trim() !== "")) table.push(row);
  if (table.length < 2) throw new Error("The CSV must include a header and at least one household row.");
  const headers = table[0].map(value => value.trim());
  const records = [];
  const errors = [];
  table.slice(1).forEach((values, index) => {
    if (values.length !== headers.length) { errors.push({ row: index + 2, reason: "column count does not match the header" }); return; }
    records.push({ ...Object.fromEntries(headers.map((header, column) => [header, values[column]])), __csvRow: index + 2 });
  });
  return { records, errors };
}

const csvInput = document.getElementById("scorecard-csv-input");
const csvDialog = document.getElementById("csv-import-dialog");
const csvConfirm = document.getElementById("csv-import-confirm");
let pendingCsvCases = [];
let pendingCsvFilename = "";

document.getElementById("import-csv-trigger").addEventListener("click", () => csvInput.click());
document.getElementById("csv-import-close").addEventListener("click", () => csvDialog.close());
document.getElementById("csv-import-cancel").addEventListener("click", () => csvDialog.close());
csvDialog.addEventListener("close", () => { pendingCsvCases = []; csvInput.value = ""; });

csvInput.addEventListener("change", async () => {
  const file = csvInput.files[0];
  if (!file) return;
  pendingCsvFilename = file.name;
  let parsed;
  try {
    parsed = parseCsvText(await file.text());
  } catch (error) {
    parsed = { records: [], errors: [{ row: "—", reason: error.message }] };
  }
  const normalized = normalizeCsvRows(parsed.records);
  const existingIds = new Set(cases.map(item => item.id));
  let existingDuplicates = 0;
  pendingCsvCases = normalized.cases.filter(item => {
    if (existingIds.has(item.id)) { existingDuplicates += 1; return false; }
    existingIds.add(item.id);
    return true;
  });
  const issues = [...parsed.errors, ...normalized.errors];
  const duplicates = normalized.duplicates + existingDuplicates;
  document.getElementById("csv-import-filename").textContent = pendingCsvFilename;
  document.getElementById("csv-import-summary").textContent = `${pendingCsvCases.length} new household${pendingCsvCases.length === 1 ? "" : "s"} ready to add. ${duplicates} duplicate ID${duplicates === 1 ? "" : "s"} will be skipped. ${issues.length} invalid row${issues.length === 1 ? "" : "s"} skipped. Existing households will not be changed.`;
  const issuePanel = document.getElementById("csv-import-issues");
  issuePanel.classList.toggle("hidden", issues.length === 0);
  issuePanel.innerHTML = issues.length ? `<strong>Rows needing attention</strong><ul>${issues.slice(0, 6).map(issue => `<li>Row ${escapeHtml(issue.row)}: ${escapeHtml(issue.reason)}</li>`).join("")}${issues.length > 6 ? `<li>And ${issues.length - 6} more…</li>` : ""}</ul>` : "";
  csvConfirm.disabled = pendingCsvCases.length === 0;
  csvConfirm.textContent = pendingCsvCases.length ? `Add ${pendingCsvCases.length} household${pendingCsvCases.length === 1 ? "" : "s"}` : "No new households";
  csvDialog.showModal();
});

csvConfirm.addEventListener("click", () => {
  if (!pendingCsvCases.length) return;
  const addedCount = pendingCsvCases.length;
  cases.push(...pendingCsvCases);
  pendingCsvCases = [];
  document.getElementById("csv-import-feedback").textContent = `Added ${addedCount} household${addedCount === 1 ? "" : "s"} from ${pendingCsvFilename}.`;
  csvDialog.close();
  renderCase();
});

function renderHistory() {
  const eligible = decisionLog.filter(entry => entry.decision === "eligible").length;
  const notEligible = decisionLog.length - eligible;
  document.getElementById("history-summary").innerHTML = `<article class="history-stat"><span>DECISIONS RECORDED</span><strong>${decisionLog.length}</strong><small>Across this demo session</small></article><article class="history-stat"><span>ELIGIBLE</span><strong>${eligible}</strong><small>Operator decisions</small></article><article class="history-stat"><span>NOT ELIGIBLE</span><strong>${notEligible}</strong><small>Operator decisions</small></article>`;
  const rows = document.getElementById("history-rows");
  rows.innerHTML = decisionLog.map(entry => `<tr><td>${entry.id}</td><td>${entry.decision === "eligible" ? "Eligible" : "Not eligible"}</td><td><span class="history-time">${entry.time}</span><small class="history-date">${entry.date}</small></td></tr>`).join("");
  document.getElementById("empty-history").classList.toggle("hidden", decisionLog.length > 0);
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

document.getElementById("open-notes").addEventListener("click", () => setCaseTab("interview"));
document.querySelectorAll("[data-case-tab]").forEach(button => button.addEventListener("click", () => setCaseTab(button.dataset.caseTab)));
document.querySelector(".case-tabs").addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll("[data-case-tab]")];
  const current = tabs.indexOf(document.activeElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
  tabs[next].focus();
  setCaseTab(tabs[next].dataset.caseTab);
});

setCaseTab("assessment");
renderCase();
