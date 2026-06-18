const RATINGS = [
  { value: 1, label: "Strongly disagree", color: "#c93737", tint: "rgba(201, 55, 55, 0.13)" },
  { value: 2, label: "Disagree", color: "#df8f28", tint: "rgba(223, 143, 40, 0.15)" },
  { value: 3, label: "Neutral", color: "#e6bd35", tint: "rgba(230, 189, 53, 0.18)" },
  { value: 4, label: "Agree", color: "#93bf48", tint: "rgba(147, 191, 72, 0.16)" },
  { value: 5, label: "Strongly agree", color: "#2d8b57", tint: "rgba(45, 139, 87, 0.14)" }
];

const CONFIG = window.IBD_CONFIG || {};
const LOCAL_KEY = "ibd-standards-demo-responses";

let standards = [];

document.addEventListener("DOMContentLoaded", async () => {
  applyPrintPreviewFromUrl();
  document.title = CONFIG.DASHBOARD_TITLE || document.title;
  document.getElementById("page-title").textContent =
    `${CONFIG.SERVICE_NAME || "IBD Service"} self-assessment`;

  standards = await fetch("standards.json").then((response) => response.json());
  renderAssessment();
  wireEvents();
  seedDemoDataFromUrl();
  await renderDashboard();
  openInitialViewFromUrl();
});

function wireEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(`${button.dataset.view}-view`).classList.add("active");
      if (button.dataset.view === "dashboard") {
        await renderDashboard();
      }
    });
  });

  document.getElementById("assessment-form").addEventListener("submit", submitAssessment);
  document.getElementById("print-report").addEventListener("click", () => window.print());
}

function applyPrintPreviewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("print") === "preview") {
    document.body.classList.add("print-preview");
  }
}

function renderAssessment() {
  const container = document.getElementById("standards-form");
  let currentSection = null;

  standards.forEach((standard) => {
    if (standard.section !== currentSection) {
      currentSection = standard.section;
      const heading = document.createElement("h2");
      heading.className = "section-break";
      heading.textContent = `Section ${standard.section}: ${standard.sectionTitle}`;
      container.appendChild(heading);
    }

    const card = document.createElement("section");
    card.className = "standard-card";
    card.innerHTML = `
      <div class="standard-title">
        <span class="standard-number">${standard.number}</span>
          <h3 class="standard-question">Does the service meet this standard?</h3>
      </div>
      <p class="statement assessment-statement">${escapeHtml(standard.statement)}</p>
      <fieldset class="rating-group">
        <legend class="sr-only">Rating for standard ${standard.number}</legend>
        ${RATINGS.map((rating) => `
          <label class="rating-option" style="--rating-color: ${rating.color}; --rating-tint: ${rating.tint};">
            <input type="radio" name="rating-${standard.number}" value="${rating.value}" required>
            ${rating.label}
          </label>
        `).join("")}
      </fieldset>
      <label>
        Explain your reason for this rating:
        <textarea name="comment-${standard.number}"></textarea>
      </label>
    `;
    container.appendChild(card);
  });
}

async function submitAssessment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("submit-status");
  const formData = new FormData(form);

  const payload = {
    surname: String(formData.get("surname") || "").trim(),
    submittedAt: new Date().toISOString(),
    responses: standards.map((standard) => ({
      number: standard.number,
      rating: Number(formData.get(`rating-${standard.number}`)),
      comment: String(formData.get(`comment-${standard.number}`) || "").trim()
    }))
  };

  if (!payload.surname) {
    status.textContent = "Please enter your surname for duplicate checking.";
    return;
  }

  status.textContent = "Submitting...";

  try {
    if (CONFIG.API_URL) {
      const response = await fetch(CONFIG.API_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error || "The response could not be saved.");
      }
    } else {
      saveLocalResponse(payload);
    }

    status.textContent = "Thank you. Your assessment has been submitted.";
    form.reset();
    document.querySelector('[data-view="dashboard"]').click();
  } catch (error) {
    status.textContent = error.message;
  }
}

async function renderDashboard() {
  const status = document.getElementById("dashboard-status");
  const content = document.getElementById("dashboard-content");
  content.innerHTML = "";
  status.textContent = CONFIG.API_URL
    ? "Loading latest Google Sheet results..."
    : "Demo mode: showing responses saved in this browser until Google Sheets is connected.";

  try {
    const summary = CONFIG.API_URL ? await fetchRemoteSummary() : buildSummary(getLocalResponses());
    document.getElementById("respondent-count").textContent = `Respondents: ${summary.respondentCount}`;
    document.getElementById("dashboard-date").textContent = `Date: ${formatDate(summary.generatedAt)}`;

    const summaryByNumber = new Map(summary.standards.map((item) => [item.number, item]));
    let currentSection = null;
    standards.forEach((standard) => {
      const item = summaryByNumber.get(standard.number) || {
        number: standard.number,
        median: null,
        min: null,
        max: null,
        comments: []
      };

      if (standard.section !== currentSection) {
        currentSection = standard.section;
        const heading = document.createElement("h2");
        heading.className = "section-break";
        heading.textContent = `Section ${standard.section}: ${standard.sectionTitle}`;
        content.appendChild(heading);
      }

      const card = document.createElement("article");
      card.className = "dashboard-card";
      card.innerHTML = `
        <div class="dashboard-standard-text">
          <div class="standard-title">
            <span class="standard-number">${standard.number}</span>
            <h3>${escapeHtml(standard.statement)}</h3>
          </div>
        </div>
        <div class="gauge-wrap">
          ${renderGauge(item.median)}
          <p class="rating-extremes">Min: ${ratingLabel(item.min)} | Max: ${ratingLabel(item.max)}</p>
        </div>
        <div class="comments-panel">
          ${renderComments(item.comments)}
        </div>
      `;
      content.appendChild(card);
    });

    status.textContent = summary.respondentCount
      ? ""
      : "No submitted responses yet.";
  } catch (error) {
    status.textContent = error.message;
  }
}

async function fetchRemoteSummary() {
  const response = await fetch(`${CONFIG.API_URL}?action=summary`, { mode: "cors" });
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error || "The dashboard summary could not be loaded.");
  }
  return result.summary;
}

function saveLocalResponse(payload) {
  const responses = getLocalResponses().filter(
    (item) => item.localKey !== normalizeSurname(payload.surname)
  );
  responses.push({
    ...payload,
    localKey: normalizeSurname(payload.surname),
    surname: undefined
  });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(responses));
}

function seedDemoDataFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (CONFIG.API_URL || params.get("demo") !== "sample") {
    return;
  }

  const sampleComments = [
    "Clear process in place, though documentation could be easier to find.",
    "Generally working well, but consistency varies between clinic areas.",
    "Team felt this is a priority area for the next improvement cycle.",
    "Good examples exist, but they are not yet embedded across the whole service.",
    "Evidence is strong and regularly reviewed."
  ];

  const respondents = ["ash", "brooks", "clarke", "davis", "evans", "foster", "green"];
  const responses = respondents.map((name, personIndex) => ({
    submittedAt: new Date(Date.now() - personIndex * 3600000).toISOString(),
    localKey: name,
    responses: standards.map((standard, standardIndex) => {
      const base = ((standardIndex + personIndex) % 5) + 1;
      const rating = Math.max(1, Math.min(5, base + (standard.section >= 5 ? 0 : 1)));
      const shouldComment = (standardIndex + personIndex) % 6 === 0;
      return {
        number: standard.number,
        rating,
        comment: shouldComment ? sampleComments[(standardIndex + personIndex) % sampleComments.length] : ""
      };
    })
  }));

  localStorage.setItem(LOCAL_KEY, JSON.stringify(responses));
}

function openInitialViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "dashboard") {
    document.querySelector('[data-view="dashboard"]').click();
  }
}

function getLocalResponses() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function buildSummary(responses) {
  const items = standards.map((standard) => {
    const entries = responses
      .map((response) => response.responses.find((item) => item.number === standard.number))
      .filter(Boolean);
    const values = entries.map((entry) => Number(entry.rating)).filter(Boolean).sort((a, b) => a - b);
    return {
      number: standard.number,
      median: median(values),
      min: values.length ? values[0] : null,
      max: values.length ? values[values.length - 1] : null,
      comments: entries
        .filter((entry) => entry.comment)
        .map((entry) => ({ rating: Number(entry.rating), comment: entry.comment }))
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    respondentCount: responses.length,
    standards: items
  };
}

function median(values) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function renderGauge(value) {
  const rotation = value ? -90 + ((value - 1) / 4) * 180 : -90;
  const segmentPaths = [
    "M 30 120 A 90 90 0 0 1 47.2 67.1",
    "M 47.2 67.1 A 90 90 0 0 1 92.2 34.4",
    "M 92.2 34.4 A 90 90 0 0 1 147.8 34.4",
    "M 147.8 34.4 A 90 90 0 0 1 192.8 67.1",
    "M 192.8 67.1 A 90 90 0 0 1 210 120"
  ];
  return `
    <svg class="gauge" viewBox="0 0 240 150" role="img" aria-label="Median rating ${ratingLabel(value)}">
      ${segmentPaths.map((path, index) => `
        <path d="${path}" fill="none" stroke="${RATINGS[index].color}" stroke-width="24" />
      `).join("")}
      <g class="needle" style="transform: rotate(${rotation}deg)">
        <line x1="120" y1="120" x2="120" y2="44" stroke="#17202a" stroke-width="4" stroke-linecap="round" />
        <circle cx="120" cy="120" r="8" fill="#17202a" />
      </g>
      <text x="120" y="143" text-anchor="middle" font-size="13" font-weight="700">${ratingLabel(value)}</text>
    </svg>
  `;
}

function renderComments(comments) {
  if (!comments.length) {
    return '<p class="empty">No comments submitted for this standard.</p>';
  }
  return `
    <table class="comment-table">
      <thead>
        <tr><th>Rating</th><th>Comment</th></tr>
      </thead>
      <tbody>
        ${comments.map((item) => `
          <tr>
            <td>${ratingLabel(item.rating)}</td>
            <td>${escapeHtml(item.comment)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function ratingLabel(value) {
  if (!value) return "No data";
  const rounded = Math.round(value);
  return RATINGS.find((rating) => rating.value === rounded)?.label || "No data";
}

function normalizeSurname(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
