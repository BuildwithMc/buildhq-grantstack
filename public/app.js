/* GrantStack Frontend — BuildHQ */

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Tw7qAcGpfUQm_byFJnH6rpO0X4S4B8ER6paKaH4hkb8";
let allGrants = [];

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("sheet-link").href = SHEET_URL;
  document.getElementById("footer-sheet-link").href = SHEET_URL;
  loadAll();
});

async function loadAll() {
  await Promise.all([loadStats(), loadClosingSoon(), loadGrants()]);
}

// ─────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await fetch("/api/stats").then((r) => r.json());
    document.getElementById("stat-total").textContent = data.total ?? "—";
    document.getElementById("stat-closing").textContent = data.closingSoon ?? "—";
    document.getElementById("stat-applied").textContent = data.applied ?? "—";
    document.getElementById("stat-awarded").textContent = data.awarded ?? "—";
  } catch {}
}

// ─────────────────────────────────────────────
// CLOSING SOON CARDS
// ─────────────────────────────────────────────
async function loadClosingSoon() {
  const container = document.getElementById("closing-soon-cards");
  try {
    const grants = await fetch("/api/grants/closing-soon").then((r) => r.json());
    if (grants.length === 0) {
      container.innerHTML = `<div class="no-closing">No grants with known deadlines closing in the next 60 days. Check the full sheet for rolling deadlines.</div>`;
      return;
    }
    container.innerHTML = grants.map((g) => buildClosingCard(g)).join("");
  } catch {
    container.innerHTML = `<div class="no-closing">Could not load closing soon data.</div>`;
  }
}

function buildClosingCard(g) {
  const days = g._daysUntil;
  const isCritical = days <= 14;
  const label = days === 0 ? "Closes TODAY" : days === 1 ? "1 day left" : `${days} days left`;
  return `
    <div class="closing-card" onclick="openModal(${JSON.stringify(g).replace(/"/g, "&quot;")})">
      <div class="days-badge ${isCritical ? "critical" : ""}">${label}</div>
      <h3>${esc(g["Grant Name"])}</h3>
      <div class="org">${esc(g["Organization"])}</div>
      <div class="amount">${esc(g["Est. Amount (USD)"] || "TBD")}</div>
      <div>
        <span class="type-tag">${esc(g["Grant Type"])}</span>
        <span class="type-tag" style="margin-left:4px">${esc(g["Industry Category"])}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
// GRANTS TABLE
// ─────────────────────────────────────────────
async function loadGrants() {
  try {
    allGrants = await fetch("/api/grants").then((r) => r.json());
    renderTable(allGrants);
  } catch {
    document.getElementById("grants-tbody").innerHTML =
      `<tr><td colspan="9" class="loading">Could not load grants.</td></tr>`;
  }
}

function renderTable(grants) {
  const tbody = document.getElementById("grants-tbody");
  const count = document.getElementById("table-count");

  if (grants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading">No grants match your filters.</td></tr>`;
    count.textContent = "";
    return;
  }

  tbody.innerHTML = grants.map((g) => {
    const days = g._daysUntil;
    let deadlineClass = "";
    if (days !== null) {
      if (days <= 14) deadlineClass = "critical";
      else if (days <= 60) deadlineClass = "soon";
    }
    return `
      <tr onclick="openModal(${JSON.stringify(g).replace(/"/g, "&quot;")})">
        <td class="td-name">${esc(g["Grant Name"])}</td>
        <td class="td-org">${esc(g["Organization"])}</td>
        <td><span class="tag tag-type">${esc(g["Grant Type"])}</span></td>
        <td><span class="tag tag-industry">${esc(g["Industry Category"])}</span></td>
        <td><span class="tag ${g["Equity-Free?"] === "Yes" ? "tag-equity-yes" : "tag-equity-no"}">${esc(g["Equity-Free?"])}</span></td>
        <td class="td-amount">${esc(g["Est. Amount (USD)"] || "TBD")}</td>
        <td class="td-deadline ${deadlineClass}">
          ${esc(g["Deadline"])}
          ${days !== null && days <= 60 ? `<br><small>${days === 0 ? "TODAY" : days + "d left"}</small>` : ""}
        </td>
        <td>${statusBadge(g["Status"])}</td>
        <td onclick="event.stopPropagation()">
          <a href="${esc(g["Apply Link"])}" target="_blank" class="apply-btn">Apply ↗</a>
        </td>
      </tr>`;
  }).join("");

  count.textContent = `Showing ${grants.length} of ${allGrants.length} grants`;
}

function statusBadge(status) {
  const map = {
    "Not Started": "not-started",
    "Researching": "researching",
    "In Progress": "in-progress",
    "Submitted": "submitted",
    "Awaiting Response": "awaiting",
    "Awarded": "awarded",
    "Rejected": "rejected",
  };
  const cls = map[status] || "not-started";
  return `<span class="status-badge status-${cls}">${esc(status || "Not Started")}</span>`;
}

// ─────────────────────────────────────────────
// FILTERS
// ─────────────────────────────────────────────
function applyFilters() {
  const type = document.getElementById("filter-type").value;
  const industry = document.getElementById("filter-industry").value;
  const equity = document.getElementById("filter-equity").value;
  const status = document.getElementById("filter-status").value;
  const search = document.getElementById("search-input").value.toLowerCase();

  const filtered = allGrants.filter((g) => {
    if (type && g["Grant Type"] !== type) return false;
    if (industry && g["Industry Category"] !== industry) return false;
    if (equity && g["Equity-Free?"] !== equity) return false;
    if (status && g["Status"] !== status) return false;
    if (search) {
      const haystack = [g["Grant Name"], g["Organization"], g["Grant Brief"], g["BuildHQ Match"]]
        .join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  renderTable(filtered);
}

// ─────────────────────────────────────────────
// SUBMIT GRANT URL
// ─────────────────────────────────────────────
async function submitGrantUrl() {
  const input = document.getElementById("grant-url");
  const btn = document.getElementById("submit-btn-text");
  const result = document.getElementById("submit-result");
  const url = input.value.trim();

  if (!url) return;

  btn.textContent = "Analysing...";
  document.querySelector(".submit-form .btn").disabled = true;
  result.className = "submit-result hidden";

  try {
    const res = await fetch("/api/submit-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    result.className = `submit-result ${data.status === "duplicate" ? "duplicate" : "success"}`;
    result.textContent = data.message;
    result.classList.remove("hidden");

    if (data.status === "added") {
      input.value = "";
      await loadAll();
    }
  } catch (err) {
    result.className = "submit-result error";
    result.textContent = "Error: " + err.message;
    result.classList.remove("hidden");
  } finally {
    btn.textContent = "Add to Sheet";
    document.querySelector(".submit-form .btn").disabled = false;
  }
}

// ─────────────────────────────────────────────
// REFRESH
// ─────────────────────────────────────────────
async function triggerRefresh() {
  const btn = document.getElementById("refresh-btn");
  btn.textContent = "Refreshing...";
  btn.disabled = true;
  try {
    await fetch("/api/refresh", { method: "POST" });
    setTimeout(async () => {
      await loadAll();
      btn.textContent = "Refresh Grants";
      btn.disabled = false;
    }, 35000);
  } catch {
    btn.textContent = "Refresh Grants";
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────
function openModal(grant) {
  const days = grant._daysUntil;
  let deadlineLabel = grant["Deadline"] || "Check official site";
  let deadlineClass = "";
  if (days !== null) {
    const suffix = days === 0 ? " — Closes TODAY!" : days === 1 ? " — 1 day left!" : ` — ${days} days left`;
    deadlineLabel += suffix;
    deadlineClass = days <= 14 ? "soon" : days <= 60 ? "soon" : "";
  }

  document.getElementById("modal-content").innerHTML = `
    <div class="modal-grant-name">${esc(grant["Grant Name"])}</div>
    <div class="modal-org">${esc(grant["Organization"])}</div>
    <div class="modal-tags">
      <span class="tag tag-type">${esc(grant["Grant Type"])}</span>
      <span class="tag tag-industry">${esc(grant["Industry Category"])}</span>
      <span class="tag ${grant["Equity-Free?"] === "Yes" ? "tag-equity-yes" : "tag-equity-no"}">
        ${grant["Equity-Free?"] === "Yes" ? "Equity-Free" : "Equity Required"}
      </span>
      ${statusBadge(grant["Status"])}
    </div>
    <div class="modal-amount">${esc(grant["Est. Amount (USD)"] || "Amount TBD")}</div>

    <div class="modal-section">
      <div class="modal-section-label">About This Grant</div>
      <div class="modal-section-body">${esc(grant["Grant Brief"])}</div>
    </div>

    <div class="modal-section modal-match">
      <div class="modal-section-label">Why BuildHQ Matches</div>
      <div class="modal-section-body">${esc(grant["BuildHQ Match"])}</div>
    </div>

    ${grant["Notes"] ? `
    <div class="modal-section">
      <div class="modal-section-label">Notes</div>
      <div class="modal-section-body">${esc(grant["Notes"])}</div>
    </div>` : ""}

    <div class="modal-footer">
      <a href="${esc(grant["Apply Link"])}" target="_blank" class="btn btn-primary">Apply Now ↗</a>
      <a href="${SHEET_URL}" target="_blank" class="btn btn-outline">Open in Sheet ↗</a>
      <span class="modal-deadline ${deadlineClass}">📅 ${esc(deadlineLabel)}</span>
    </div>`;

  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
