// ===========================================================
// Application Tracker — frontend logic (vanilla JS, no build step)
// ===========================================================

const STATUS_VALUES = [
  "researching", "in_progress", "submitted", "interview",
  "accepted", "rejected", "waitlisted", "declined", "withdrawn",
];

const STATUS_LABELS = {
  researching: "Researching", in_progress: "In Progress", submitted: "Submitted",
  interview: "Interview", accepted: "Accepted", rejected: "Rejected",
  waitlisted: "Waitlisted", declined: "Declined", withdrawn: "Withdrawn",
};

const COUNTRY_FLAGS = {
  "germany": "🇩🇪", "canada": "🇨🇦", "united kingdom": "🇬🇧", "uk": "🇬🇧",
  "finland": "🇫🇮", "sweden": "🇸🇪", "netherlands": "🇳🇱", "poland": "🇵🇱",
  "south korea": "🇰🇷", "japan": "🇯🇵", "usa": "🇺🇸", "united states": "🇺🇸",
  "france": "🇫🇷", "italy": "🇮🇹", "spain": "🇪🇸", "switzerland": "🇨🇭",
  "austria": "🇦🇹", "denmark": "🇩🇰", "norway": "🇳🇴", "ireland": "🇮🇪",
  "australia": "🇦🇺", "new zealand": "🇳🇿", "singapore": "🇸🇬", "china": "🇨🇳",
  "pakistan": "🇵🇰", "india": "🇮🇳", "uae": "🇦🇪", "belgium": "🇧🇪",
  "czech republic": "🇨🇿", "portugal": "🇵🇹", "hungary": "🇭🇺", "estonia": "🇪🇪",
};

const state = {
  applications: [],
  recommenders: [],
  currentDetailId: null,
  currentDetailData: null,
};

// ----------------------------------------------------------
// API helpers
// ----------------------------------------------------------

async function api(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    toast(err.message || "Something went wrong", true);
    throw err;
  }
}

function apiJSON(url, method, payload) {
  return api(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ----------------------------------------------------------
// Toasts
// ----------------------------------------------------------

function toast(message, isError = false) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ----------------------------------------------------------
// Date / urgency helpers (mirrors backend logic)
// ----------------------------------------------------------

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}

function urgencyFor(days) {
  if (days === null || days === undefined) return "none";
  if (days < 0) return "past";
  if (days <= 7) return "critical";
  if (days <= 21) return "soon";
  if (days <= 45) return "upcoming";
  return "far";
}

function formatDays(days) {
  if (days === null || days === undefined) return "—";
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  return `${days}d`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function flagFor(country) {
  if (!country) return "🌐";
  return COUNTRY_FLAGS[country.trim().toLowerCase()] || "🌐";
}

// ----------------------------------------------------------
// Modal helpers
// ----------------------------------------------------------

function openModal(id) {
  document.getElementById(id).classList.add("show");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("show");
  });
});

// ----------------------------------------------------------
// Tabs (top-level view + detail tabs)
// ----------------------------------------------------------

document.querySelectorAll("#main-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#main-tabs .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const view = tab.dataset.view;
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    if (view === "applications") renderApplicationsView();
    if (view === "recommenders") renderRecommendersView();
  });
});

document.querySelectorAll("#detail-tabs .detail-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#detail-tabs .detail-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".detail-pane").forEach((p) => p.classList.remove("active"));
    document.querySelector(`.detail-pane[data-dpane="${tab.dataset.dtab}"]`).classList.add("active");
  });
});

// ----------------------------------------------------------
// Facet ring (signature completion indicator)
// ----------------------------------------------------------

function facetRingSVG(pct, idSuffix) {
  const cx = 23, cy = 23, r = 17;
  const pts = [-90, -30, 30, 90, 150, 210].map((a) => {
    const rad = (a * Math.PI) / 180;
    return [(cx + r * Math.cos(rad)).toFixed(2), (cy + r * Math.sin(rad)).toFixed(2)];
  });
  const pointsStr = pts.map((p) => p.join(",")).join(" ");
  const perimeter = 6 * r;
  const dash = (Math.min(pct, 100) / 100) * perimeter;
  const gradId = `facetGrad-${idSuffix}`;
  const strokeColor = pct >= 100 ? "var(--success)" : `url(#${gradId})`;
  return `
    <svg class="facet-ring" viewBox="0 0 46 46">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#4dd8e8"/>
          <stop offset="1" stop-color="#9b7fe8"/>
        </linearGradient>
      </defs>
      <polygon points="${pointsStr}" fill="none" stroke="var(--border)" stroke-width="3"/>
      <polygon points="${pointsStr}" fill="none" stroke="${strokeColor}" stroke-width="3"
        stroke-dasharray="${dash.toFixed(1)} ${perimeter}" stroke-linecap="round"
        transform="rotate(-90 23 23)"/>
      <text x="23" y="27" text-anchor="middle" font-family="JetBrains Mono, monospace"
        font-size="11" font-weight="700" fill="var(--text-primary)">${pct}</text>
    </svg>`;
}

// ----------------------------------------------------------
// Loading applications / recommenders
// ----------------------------------------------------------

async function loadApplications() {
  state.applications = await api("/api/applications");
  return state.applications;
}

async function loadRecommenders() {
  state.recommenders = await api("/api/recommenders");
  return state.recommenders;
}

async function refreshAll() {
  await Promise.all([loadApplications(), loadRecommenders()]);
  renderDashboard();
  if (document.getElementById("view-applications").classList.contains("active")) {
    renderApplicationsView();
  }
  if (document.getElementById("view-recommenders").classList.contains("active")) {
    renderRecommendersView();
  }
  populateCountryDatalist();
}

function populateCountryDatalist() {
  const dl = document.getElementById("country-list");
  const known = new Set(Object.keys(COUNTRY_FLAGS).map((c) => c.replace(/\b\w/g, (m) => m.toUpperCase())));
  state.applications.forEach((a) => { if (a.country) known.add(a.country); });
  dl.innerHTML = [...known].sort().map((c) => `<option value="${escapeHTML(c)}">`).join("");
}

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ----------------------------------------------------------
// Dashboard rendering
// ----------------------------------------------------------

async function renderDashboard() {
  const stats = await api("/api/dashboard/stats");

  const statsRow = document.getElementById("stats-row");
  const submitted = (stats.by_status.submitted || 0) + (stats.by_status.interview || 0)
    + (stats.by_status.accepted || 0) + (stats.by_status.rejected || 0) + (stats.by_status.waitlisted || 0);
  statsRow.innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Applications</div><div class="stat-value">${stats.total_applications}</div></div>
    <div class="stat-card"><div class="stat-label">Submitted+</div><div class="stat-value">${submitted}</div></div>
    <div class="stat-card"><div class="stat-label">Accepted</div><div class="stat-value accent">${stats.by_status.accepted || 0}</div></div>
    <div class="stat-card"><div class="stat-label">Avg. Completion</div><div class="stat-value">${stats.avg_completion}%</div></div>
  `;

  const dl = document.getElementById("deadlines-list");
  if (!stats.upcoming_deadlines.length) {
    dl.innerHTML = `<div class="empty-note">No upcoming deadlines tracked yet. Add an application to get started.</div>`;
  } else {
    dl.innerHTML = stats.upcoming_deadlines.map((d) => `
      <div class="deadline-row urgency-${d.urgency}" data-app-id="${d.application_id}">
        <div class="deadline-days">${formatDays(d.days)}</div>
        <div class="deadline-info">
          <div class="deadline-title">${escapeHTML(d.type)}</div>
          <div class="deadline-sub">${escapeHTML(d.university)} — ${escapeHTML(d.program)}</div>
        </div>
        <div class="deadline-date">${formatDate(d.date)}</div>
      </div>
    `).join("");
    dl.querySelectorAll(".deadline-row").forEach((row) => {
      row.addEventListener("click", () => openDetail(parseInt(row.dataset.appId)));
    });
  }

  const breakdown = document.getElementById("status-breakdown");
  const maxCount = Math.max(1, ...Object.values(stats.by_status));
  const order = STATUS_VALUES.filter((s) => stats.by_status[s]);
  if (!order.length) {
    breakdown.innerHTML = `<div class="empty-note">No applications yet.</div>`;
  } else {
    breakdown.innerHTML = order.map((s) => `
      <div class="status-bar-row">
        <div class="status-bar-label">${STATUS_LABELS[s]}</div>
        <div class="status-bar-track"><div class="status-bar-fill" style="width:${(stats.by_status[s] / maxCount) * 100}%"></div></div>
        <div class="status-bar-count">${stats.by_status[s]}</div>
      </div>
    `).join("");
  }

  renderAppsGrid("dashboard-apps-grid", state.applications);
}

// ----------------------------------------------------------
// Application cards / grid
// ----------------------------------------------------------

function appCardHTML(a) {
  const nd = a.next_deadline;
  const urgency = nd ? nd.urgency : "none";
  const deadlineLabel = nd ? nd.label + " deadline" : "No deadline set";
  const deadlineValue = nd ? `${formatDays(nd.days)} · ${formatDate(nd.date)}` : "—";
  return `
    <div class="app-card" data-app-id="${a.id}">
      <div class="app-card-top">
        <div class="app-card-titles">
          <div class="app-card-uni">${escapeHTML(a.university)}</div>
          <div class="app-card-program">${escapeHTML(a.program)}${a.degree_type ? " · " + escapeHTML(a.degree_type) : ""}</div>
          <div class="app-card-loc">${flagFor(a.country)} ${escapeHTML(a.country || "Location TBD")}${a.city ? ", " + escapeHTML(a.city) : ""}</div>
        </div>
        ${facetRingSVG(a.completion_pct, a.id)}
      </div>
      <div class="app-card-mid">
        <span class="pill pill-status-${a.status}">${STATUS_LABELS[a.status] || a.status}</span>
        <span class="pill pill-priority-${a.priority}">${a.priority}</span>
      </div>
      <div class="app-card-bottom">
        <div>
          <div class="app-card-deadline-label">${deadlineLabel}</div>
          <div class="app-card-deadline-value urgency-${urgency}-text">${deadlineValue}</div>
        </div>
        <div class="app-card-checklist-mini">${a.checklist_done + a.lor_done}/${a.checklist_total + a.lor_total} done</div>
      </div>
    </div>
  `;
}

function renderAppsGrid(containerId, apps) {
  const container = document.getElementById(containerId);
  if (!apps.length) {
    container.innerHTML = `<div class="empty-state"><h3>No applications yet</h3><p>Click "+ New Application" to start tracking your first program.</p></div>`;
    return;
  }
  container.innerHTML = apps.map(appCardHTML).join("");
  container.querySelectorAll(".app-card").forEach((card) => {
    card.addEventListener("click", () => openDetail(parseInt(card.dataset.appId)));
  });
}

// ----------------------------------------------------------
// Applications view (filters/sort/search)
// ----------------------------------------------------------

function setupFilterOptions() {
  const statusSel = document.getElementById("filter-status");
  if (statusSel.children.length === 1) {
    STATUS_VALUES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s; opt.textContent = STATUS_LABELS[s];
      statusSel.appendChild(opt);
    });
  }
}

function renderApplicationsView() {
  setupFilterOptions();

  const countrySel = document.getElementById("filter-country");
  const currentCountryVal = countrySel.value;
  const countries = [...new Set(state.applications.map((a) => a.country).filter(Boolean))].sort();
  countrySel.innerHTML = `<option value="">All countries</option>` +
    countries.map((c) => `<option value="${escapeHTML(c)}">${flagFor(c)} ${escapeHTML(c)}</option>`).join("");
  countrySel.value = currentCountryVal;

  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  const q = document.getElementById("search-input").value.trim().toLowerCase();
  const statusF = document.getElementById("filter-status").value;
  const priorityF = document.getElementById("filter-priority").value;
  const countryF = document.getElementById("filter-country").value;
  const sortBy = document.getElementById("sort-by").value;

  let list = state.applications.filter((a) => {
    if (q && !(a.university.toLowerCase().includes(q) || a.program.toLowerCase().includes(q))) return false;
    if (statusF && a.status !== statusF) return false;
    if (priorityF && a.priority !== priorityF) return false;
    if (countryF && a.country !== countryF) return false;
    return true;
  });

  list = list.slice().sort((a, b) => {
    if (sortBy === "name") return a.university.localeCompare(b.university);
    if (sortBy === "completion") return b.completion_pct - a.completion_pct;
    if (sortBy === "status") return a.status.localeCompare(b.status);
    // deadline
    const da = a.next_deadline ? a.next_deadline.days : Infinity;
    const db = b.next_deadline ? b.next_deadline.days : Infinity;
    return da - db;
  });

  renderAppsGrid("applications-grid", list);
}

["search-input", "filter-status", "filter-priority", "filter-country", "sort-by"].forEach((id) => {
  document.getElementById(id).addEventListener("input", applyFiltersAndRender);
  document.getElementById(id).addEventListener("change", applyFiltersAndRender);
});

// ----------------------------------------------------------
// New application modal
// ----------------------------------------------------------

function populateStatusSelect(selectEl, current) {
  selectEl.innerHTML = STATUS_VALUES.map((s) =>
    `<option value="${s}" ${s === current ? "selected" : ""}>${STATUS_LABELS[s]}</option>`
  ).join("");
}

document.getElementById("new-app-btn").addEventListener("click", () => {
  document.getElementById("form-new-app").reset();
  populateStatusSelect(document.getElementById("new-app-status"), "researching");
  openModal("modal-new-app");
});

document.getElementById("form-new-app").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.use_default_checklist = fd.has("use_default_checklist");
  try {
    await apiJSON("/api/applications", "POST", payload);
    closeModal("modal-new-app");
    toast("Application created");
    await refreshAll();
  } catch (e) { /* toast already shown */ }
});

// ----------------------------------------------------------
// Application detail modal
// ----------------------------------------------------------

async function openDetail(id) {
  state.currentDetailId = id;
  const data = await api(`/api/applications/${id}`);
  state.currentDetailData = data;

  document.getElementById("detail-university").textContent = data.university;
  document.getElementById("detail-program").textContent = data.program + (data.degree_type ? " · " + data.degree_type : "");

  // reset to overview tab
  document.querySelectorAll("#detail-tabs .detail-tab").forEach((t) => t.classList.remove("active"));
  document.querySelector('#detail-tabs .detail-tab[data-dtab="overview"]').classList.add("active");
  document.querySelectorAll(".detail-pane").forEach((p) => p.classList.remove("active"));
  document.querySelector('.detail-pane[data-dpane="overview"]').classList.add("active");

  renderOverviewPane(data);
  renderChecklistPane(data.checklist);
  renderDocumentsPane(data.documents);
  renderLorPane(data.lor_requests);

  openModal("modal-detail");
}

function renderOverviewPane(a) {
  const c = document.getElementById("detail-overview-container");
  c.innerHTML = `
    <div class="form-grid">
      <label class="field span-2"><span>University</span><input type="text" data-f="university" value="${escapeHTML(a.university)}"></label>
      <label class="field span-2"><span>Program</span><input type="text" data-f="program" value="${escapeHTML(a.program)}"></label>
      <label class="field"><span>Degree type</span><input type="text" data-f="degree_type" value="${escapeHTML(a.degree_type)}"></label>
      <label class="field"><span>Country</span><input type="text" data-f="country" value="${escapeHTML(a.country)}" list="country-list"></label>
      <label class="field"><span>City</span><input type="text" data-f="city" value="${escapeHTML(a.city)}"></label>
      <label class="field"><span>Funding / scholarship</span><input type="text" data-f="funding_type" value="${escapeHTML(a.funding_type)}"></label>
      <label class="field"><span>Application deadline</span><input type="date" data-f="application_deadline" value="${a.application_deadline || ""}"></label>
      <label class="field"><span>Scholarship deadline</span><input type="date" data-f="scholarship_deadline" value="${a.scholarship_deadline || ""}"></label>
      <label class="field"><span>Decision date</span><input type="date" data-f="decision_date" value="${a.decision_date || ""}"></label>
      <label class="field"><span>Status</span><select data-f="status"></select></label>
      <label class="field"><span>Priority</span>
        <select data-f="priority">
          <option value="reach" ${a.priority === "reach" ? "selected" : ""}>Reach</option>
          <option value="target" ${a.priority === "target" ? "selected" : ""}>Target</option>
          <option value="safety" ${a.priority === "safety" ? "selected" : ""}>Safety</option>
        </select>
      </label>
      <label class="field"><span>Application fee</span><input type="number" step="0.01" data-f="application_fee" value="${a.application_fee ?? ""}"></label>
      <label class="field checkbox-field"><input type="checkbox" data-f="fee_paid" ${a.fee_paid ? "checked" : ""}><span>Fee paid</span></label>
      <label class="field"><span>English test required</span><input type="text" data-f="test_required" value="${escapeHTML(a.test_required)}"></label>
      <label class="field"><span>Portal username</span><input type="text" data-f="portal_username" value="${escapeHTML(a.portal_username)}"></label>
      <label class="field span-2"><span>Application URL / portal link</span><input type="text" data-f="application_url" value="${escapeHTML(a.application_url)}"></label>
      <label class="field span-2"><span>Notes</span><textarea data-f="notes" rows="4" placeholder="Faculty contacts, interview prep, anything worth remembering…">${escapeHTML(a.notes)}</textarea></label>
    </div>
    <div class="save-bar">
      <span class="save-status" id="overview-save-status"></span>
      ${a.application_url ? `<a class="btn btn-ghost" href="${escapeHTML(a.application_url)}" target="_blank" rel="noopener">Open Portal ↗</a>` : ""}
      <button class="btn btn-primary" id="save-overview-btn">Save Changes</button>
    </div>
  `;
  populateStatusSelect(c.querySelector('select[data-f="status"]'), a.status);

  document.getElementById("save-overview-btn").addEventListener("click", saveOverview);
}

async function saveOverview() {
  const c = document.getElementById("detail-overview-container");
  const payload = {};
  c.querySelectorAll("[data-f]").forEach((el) => {
    const key = el.dataset.f;
    if (el.type === "checkbox") payload[key] = el.checked;
    else payload[key] = el.value;
  });
  const status = document.getElementById("overview-save-status");
  status.textContent = "Saving…";
  try {
    await apiJSON(`/api/applications/${state.currentDetailId}`, "PUT", payload);
    status.textContent = "Saved ✓";
    toast("Changes saved");
    await refreshAll();
    setTimeout(() => { if (status) status.textContent = ""; }, 2000);
  } catch (e) {
    status.textContent = "";
  }
}

document.getElementById("delete-app-btn").addEventListener("click", async () => {
  if (!state.currentDetailId) return;
  if (!confirm("Delete this application and all of its checklist items, documents, and recommender links? This can't be undone.")) return;
  await api(`/api/applications/${state.currentDetailId}`, { method: "DELETE" });
  closeModal("modal-detail");
  toast("Application deleted");
  await refreshAll();
});

// ----------------------------------------------------------
// Checklist pane
// ----------------------------------------------------------

function renderChecklistPane(items) {
  const container = document.getElementById("checklist-items");
  if (!items.length) {
    container.innerHTML = `<div class="empty-note">No checklist items yet. Add the documents and tasks this program requires.</div>`;
    return;
  }
  container.innerHTML = items.map((it) => {
    const days = daysUntil(it.due_date);
    const urgency = urgencyFor(days);
    return `
      <div class="checklist-item status-${it.status}" data-id="${it.id}">
        <button class="check-toggle" data-action="toggle">${it.status === "done" ? "✓" : it.status === "in_progress" ? "…" : ""}</button>
        <div>
          <div class="ci-title">${escapeHTML(it.title)}</div>
          <div class="ci-cat">${escapeHTML(it.category)}</div>
        </div>
        <div class="ci-due ${it.due_date ? "urgency-" + urgency + "-text" : ""}">${it.due_date ? formatDate(it.due_date) : ""}</div>
        <div></div>
        <button class="ci-delete" data-action="delete" title="Delete item">✕</button>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".checklist-item").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="toggle"]').addEventListener("click", () => cycleChecklistStatus(id));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteChecklistItem(id));
  });
}

const STATUS_CYCLE = { not_started: "in_progress", in_progress: "done", done: "not_started" };

async function cycleChecklistStatus(id) {
  const item = state.currentDetailData.checklist.find((c) => String(c.id) === String(id));
  const next = STATUS_CYCLE[item.status] || "not_started";
  await apiJSON(`/api/checklist/${id}`, "PUT", { status: next });
  await openDetail(state.currentDetailId);
  await refreshAll();
}

async function deleteChecklistItem(id) {
  await api(`/api/checklist/${id}`, { method: "DELETE" });
  await openDetail(state.currentDetailId);
  await refreshAll();
}

document.getElementById("add-checklist-btn").addEventListener("click", addChecklistItem);
document.getElementById("new-checklist-title").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addChecklistItem();
});

async function addChecklistItem() {
  const titleInput = document.getElementById("new-checklist-title");
  const catInput = document.getElementById("new-checklist-category");
  const dueInput = document.getElementById("new-checklist-due");
  const title = titleInput.value.trim();
  if (!title) return;
  await apiJSON(`/api/applications/${state.currentDetailId}/checklist`, "POST", {
    title, category: catInput.value.trim() || "Other", due_date: dueInput.value || null,
  });
  titleInput.value = ""; catInput.value = ""; dueInput.value = "";
  await openDetail(state.currentDetailId);
  await refreshAll();
}

// ----------------------------------------------------------
// Documents pane
// ----------------------------------------------------------

function renderDocumentsPane(documents) {
  const container = document.getElementById("documents-list");
  if (!documents.length) {
    container.innerHTML = `<div class="empty-note">No documents uploaded yet. Upload your first SOP / CV / transcript draft above — every re-upload to the same category is tracked as a new version.</div>`;
    return;
  }
  const byCategory = {};
  documents.forEach((d) => {
    if (!byCategory[d.category]) byCategory[d.category] = [];
    byCategory[d.category].push(d);
  });
  container.innerHTML = Object.keys(byCategory).sort().map((cat) => `
    <div class="doc-category-group">
      <div class="doc-category-title">${escapeHTML(cat)}</div>
      ${byCategory[cat].map((d) => `
        <div class="doc-version-row ${d.is_current ? "is-current" : ""}" data-id="${d.id}">
          <div class="doc-version-badge">v${d.version_number}</div>
          <div>
            <div class="doc-filename">${escapeHTML(d.filename)}${d.is_current ? '<span class="current-tag">CURRENT</span>' : ""}</div>
            <div class="doc-meta">${formatDate(d.uploaded_at.slice(0, 10))} · ${(d.file_size / 1024).toFixed(0)} KB</div>
          </div>
          <a class="btn btn-ghost btn-tiny" href="/api/documents/${d.id}/download">Download</a>
          ${!d.is_current ? `<button class="btn btn-secondary btn-tiny" data-action="make-current">Make current</button>` : `<span></span>`}
          <button class="ci-delete" data-action="delete-doc" title="Delete this version">✕</button>
        </div>
      `).join("")}
    </div>
  `).join("");

  container.querySelectorAll(".doc-version-row").forEach((row) => {
    const id = row.dataset.id;
    const mc = row.querySelector('[data-action="make-current"]');
    if (mc) mc.addEventListener("click", async () => {
      await api(`/api/documents/${id}/make-current`, { method: "PUT" });
      await openDetail(state.currentDetailId);
    });
    row.querySelector('[data-action="delete-doc"]').addEventListener("click", async () => {
      if (!confirm("Delete this document version?")) return;
      await api(`/api/documents/${id}`, { method: "DELETE" });
      await openDetail(state.currentDetailId);
    });
  });
}

document.getElementById("upload-doc-btn").addEventListener("click", async () => {
  const catInput = document.getElementById("doc-category-input");
  const fileInput = document.getElementById("doc-file-input");
  const category = catInput.value.trim();
  if (!category) { toast("Give the document a category (e.g. SOP, CV)", true); return; }
  if (!fileInput.files.length) { toast("Choose a file to upload", true); return; }

  const fd = new FormData();
  fd.append("file", fileInput.files[0]);
  fd.append("category", category);

  try {
    await api(`/api/applications/${state.currentDetailId}/documents`, { method: "POST", body: fd });
    catInput.value = ""; fileInput.value = "";
    toast("Document version uploaded");
    await openDetail(state.currentDetailId);
  } catch (e) { /* toast shown */ }
});

// ----------------------------------------------------------
// LOR / Recommenders pane (within detail)
// ----------------------------------------------------------

const LOR_STATUS_VALUES = ["not_requested", "requested", "in_progress", "submitted", "declined"];
const LOR_STATUS_LABELS = {
  not_requested: "Not requested", requested: "Requested", in_progress: "In progress",
  submitted: "Submitted", declined: "Declined",
};

function renderLorPane(lorRequests) {
  populateLorRecommenderSelect();
  const container = document.getElementById("lor-list");
  if (!lorRequests.length) {
    container.innerHTML = `<div class="empty-note">No letters requested yet. Pick a recommender above to start tracking a request.</div>`;
    return;
  }
  container.innerHTML = lorRequests.map((l) => {
    const days = daysUntil(l.due_date);
    const urgency = urgencyFor(days);
    return `
      <div class="lor-row" data-id="${l.id}">
        <div class="lor-top">
          <div>
            <div class="lor-name">${escapeHTML(l.recommender_name)}</div>
            <div class="lor-meta">${escapeHTML(l.recommender_institution || "")}${l.recommender_email ? " · " + escapeHTML(l.recommender_email) : ""}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${l.due_date ? `<span class="ci-due urgency-${urgency}-text">due ${formatDate(l.due_date)}</span>` : ""}
            <select class="lor-status-select" data-action="status">
              ${LOR_STATUS_VALUES.map((s) => `<option value="${s}" ${s === l.status ? "selected" : ""}>${LOR_STATUS_LABELS[s]}</option>`).join("")}
            </select>
            <button class="ci-delete" data-action="delete-lor" title="Remove">✕</button>
          </div>
        </div>
        <div class="lor-dates">
          <label>Due <input type="date" data-action="due" value="${l.due_date || ""}"></label>
          <label>Requested <input type="date" data-action="requested" value="${l.requested_date || ""}"></label>
          <label>Submitted <input type="date" data-action="submitted" value="${l.submitted_date || ""}"></label>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".lor-row").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="status"]').addEventListener("change", (e) =>
      updateLor(id, { status: e.target.value }));
    row.querySelector('[data-action="due"]').addEventListener("change", (e) =>
      updateLor(id, { due_date: e.target.value }));
    row.querySelector('[data-action="requested"]').addEventListener("change", (e) =>
      updateLor(id, { requested_date: e.target.value }));
    row.querySelector('[data-action="submitted"]').addEventListener("change", (e) =>
      updateLor(id, { submitted_date: e.target.value }));
    row.querySelector('[data-action="delete-lor"]').addEventListener("click", async () => {
      if (!confirm("Remove this letter request?")) return;
      await api(`/api/lor/${id}`, { method: "DELETE" });
      await openDetail(state.currentDetailId);
      await refreshAll();
    });
  });
}

async function updateLor(id, payload) {
  await apiJSON(`/api/lor/${id}`, "PUT", payload);
  await openDetail(state.currentDetailId);
  await refreshAll();
}

function populateLorRecommenderSelect() {
  const sel = document.getElementById("lor-recommender-select");
  if (!state.recommenders.length) {
    sel.innerHTML = `<option value="">No recommenders yet — add one in the Recommenders tab</option>`;
    return;
  }
  sel.innerHTML = `<option value="">Select a recommender…</option>` +
    state.recommenders.map((r) => `<option value="${r.id}">${escapeHTML(r.name)}${r.institution ? " — " + escapeHTML(r.institution) : ""}</option>`).join("");
}

document.getElementById("add-lor-btn").addEventListener("click", async () => {
  const sel = document.getElementById("lor-recommender-select");
  const dueInput = document.getElementById("lor-due-date");
  if (!sel.value) { toast("Choose a recommender first", true); return; }
  await apiJSON(`/api/applications/${state.currentDetailId}/lor`, "POST", {
    recommender_id: parseInt(sel.value), due_date: dueInput.value || null, status: "requested",
    requested_date: new Date().toISOString().slice(0, 10),
  });
  dueInput.value = "";
  toast("Letter request added");
  await openDetail(state.currentDetailId);
  await refreshAll();
});

// ----------------------------------------------------------
// Recommenders view
// ----------------------------------------------------------

function renderRecommendersView() {
  const container = document.getElementById("recommenders-grid");
  if (!state.recommenders.length) {
    container.innerHTML = `<div class="empty-state"><h3>No recommenders yet</h3><p>Add the people who write your letters once, then link them to any application.</p></div>`;
    return;
  }
  container.innerHTML = state.recommenders.map((r) => `
    <div class="recommender-card" data-id="${r.id}">
      <div class="recommender-name">${escapeHTML(r.name)}</div>
      <div class="recommender-meta">${escapeHTML(r.title || "")}${r.institution ? (r.title ? " · " : "") + escapeHTML(r.institution) : ""}</div>
      <div class="recommender-meta">${escapeHTML(r.email || "")}</div>
      <div class="recommender-stat">Used in ${r.used_in} application${r.used_in === 1 ? "" : "s"}</div>
      <div class="recommender-actions">
        <button class="btn btn-ghost btn-tiny" data-action="edit">Edit</button>
        <button class="btn btn-danger-ghost btn-tiny" data-action="delete">Delete</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".recommender-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm("Delete this recommender? This also removes any letter requests linked to them.")) return;
      await api(`/api/recommenders/${id}`, { method: "DELETE" });
      toast("Recommender deleted");
      await refreshAll();
      renderRecommendersView();
    });
    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      const r = state.recommenders.find((x) => String(x.id) === id);
      const form = document.getElementById("form-new-recommender");
      form.name.value = r.name; form.email.value = r.email; form.institution.value = r.institution;
      form.title.value = r.title; form.notes.value = r.notes;
      form.dataset.editingId = id;
      document.querySelector("#modal-new-recommender h2").textContent = "Edit Recommender";
      openModal("modal-new-recommender");
    });
  });
}

document.getElementById("new-recommender-btn").addEventListener("click", () => {
  const form = document.getElementById("form-new-recommender");
  form.reset();
  delete form.dataset.editingId;
  document.querySelector("#modal-new-recommender h2").textContent = "Add Recommender";
  openModal("modal-new-recommender");
});

document.getElementById("form-new-recommender").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  try {
    if (form.dataset.editingId) {
      await apiJSON(`/api/recommenders/${form.dataset.editingId}`, "PUT", payload);
      toast("Recommender updated");
    } else {
      await apiJSON("/api/recommenders", "POST", payload);
      toast("Recommender added");
    }
    closeModal("modal-new-recommender");
    await refreshAll();
    if (document.getElementById("view-recommenders").classList.contains("active")) renderRecommendersView();
    if (document.getElementById("modal-detail").classList.contains("show")) populateLorRecommenderSelect();
  } catch (e) { /* toast shown */ }
});

// ----------------------------------------------------------
// Export dropdown
// ----------------------------------------------------------

document.getElementById("export-toggle").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("export-dropdown").classList.toggle("show");
});
document.addEventListener("click", () => document.getElementById("export-dropdown").classList.remove("show"));

// ----------------------------------------------------------
// Import Excel modal
// ----------------------------------------------------------

document.getElementById("import-btn").addEventListener("click", () => {
  // Reset modal state
  document.getElementById("import-file-input").value = "";
  document.getElementById("import-filename").textContent = "";
  document.getElementById("import-status").textContent = "";
  document.getElementById("import-status").className = "import-status";
  document.getElementById("import-submit-btn").disabled = true;
  openModal("modal-import");
});

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("import-file-input");

// Drag-and-drop visual feedback
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) setImportFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setImportFile(fileInput.files[0]);
});

function setImportFile(file) {
  document.getElementById("import-filename").textContent = `📎 ${file.name}`;
  document.getElementById("import-status").textContent = "";
  document.getElementById("import-status").className = "import-status";
  document.getElementById("import-submit-btn").disabled = false;
  // Store file on the button for later retrieval
  document.getElementById("import-submit-btn")._file = file;
}

document.getElementById("import-submit-btn").addEventListener("click", async () => {
  const btn = document.getElementById("import-submit-btn");
  const file = btn._file;
  if (!file) return;

  const statusEl = document.getElementById("import-status");
  btn.disabled = true;
  btn.textContent = "Importing…";
  statusEl.className = "import-status";
  statusEl.textContent = "Reading your file and creating entries…";

  try {
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch("/api/import/excel", { method: "POST", body: fd });
    const result = await resp.json();

    if (!resp.ok) {
      statusEl.className = "import-status error";
      statusEl.textContent = result.error || "Import failed.";
      btn.disabled = false;
      btn.textContent = "Import";
      return;
    }

    // Show summary
    statusEl.className = "import-status success";
    statusEl.innerHTML = `<strong>✓ Done!</strong> Added <strong>${result.added}</strong> application${result.added !== 1 ? "s" : ""}${result.skipped ? `, skipped ${result.skipped} already in DB` : ""}.`;

    if (result.applications && result.applications.length) {
      const list = document.createElement("div");
      list.className = "import-results-list";
      list.innerHTML = result.applications.map(a =>
        `<div class="import-result-row"><span class="irc">${escapeHTML(a.country)}</span><span>${escapeHTML(a.university)} — ${escapeHTML(a.program)}</span></div>`
      ).join("");
      statusEl.appendChild(list);
    }

    btn.textContent = "Done";
    await refreshAll();
  } catch (e) {
    statusEl.className = "import-status error";
    statusEl.textContent = "Network error — is the server running?";
    btn.disabled = false;
    btn.textContent = "Import";
  }
});

// ----------------------------------------------------------
// Init
// ----------------------------------------------------------

refreshAll();
