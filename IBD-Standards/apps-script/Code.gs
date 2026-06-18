const RESPONSES_SHEET = "Responses";
const SETTINGS_SHEET = "Settings";
const HASH_PROPERTY = "IBD_SURNAME_HASH_SALT";

function setupWorkbook() {
  const ss = SpreadsheetApp.getActive();
  getOrCreateSheet_(ss, RESPONSES_SHEET);
  const settings = getOrCreateSheet_(ss, SETTINGS_SHEET);
  settings.clear();
  settings.getRange(1, 1, 4, 2).setValues([
    ["Setting", "Value"],
    ["Purpose", "IBD Standards self-assessment response store"],
    ["Privacy", "Surname is hashed by Apps Script before storage and is not displayed on the dashboard."],
    ["Duplicate rule", "A later submission with the same surname hash replaces the earlier submission."]
  ]);
  ensureSalt_();
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents);
    const result = saveSubmission_(payload);
    return json_({ ok: true, result });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function doGet(event) {
  try {
    const action = event.parameter.action || "summary";
    if (action !== "summary") {
      throw new Error("Unknown action.");
    }
    return json_({ ok: true, summary: buildSummary_() });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function saveSubmission_(payload) {
  if (!payload.surname) {
    throw new Error("Surname is required for duplicate checking.");
  }
  if (!Array.isArray(payload.responses) || !payload.responses.length) {
    throw new Error("No standard responses were supplied.");
  }

  const ss = SpreadsheetApp.getActive();
  const sheet = getOrCreateSheet_(ss, RESPONSES_SHEET);
  const hash = hashSurname_(payload.surname);
  const standards = payload.responses.map((item) => String(item.number));
  const headers = ensureHeaders_(sheet, standards);
  const row = buildRow_(headers, hash, payload);
  const existingRow = findHashRow_(sheet, hash);

  if (existingRow) {
    sheet.getRange(existingRow, 1, 1, headers.length).setValues([row]);
    return { mode: "updated" };
  }

  sheet.appendRow(row);
  return { mode: "created" };
}

function ensureHeaders_(sheet, standards) {
  const fixed = ["RespondentHash", "SubmittedAt", "Role"];
  const standardHeaders = [];
  standards.forEach((number) => {
    standardHeaders.push(`S${number} Rating`);
    standardHeaders.push(`S${number} Comment`);
  });
  const headers = fixed.concat(standardHeaders);
  const existingLastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const existing = sheet.getLastRow()
    ? sheet.getRange(1, 1, 1, existingLastColumn).getValues()[0].filter(String)
    : [];

  if (!existing.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return headers;
  }

  const merged = existing.slice();
  headers.forEach((header) => {
    if (!merged.includes(header)) {
      merged.push(header);
    }
  });
  sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
  sheet.setFrozenRows(1);
  return merged;
}

function buildRow_(headers, hash, payload) {
  const responseMap = {};
  payload.responses.forEach((item) => {
    responseMap[`S${item.number} Rating`] = Number(item.rating || "");
    responseMap[`S${item.number} Comment`] = String(item.comment || "");
  });

  return headers.map((header) => {
    if (header === "RespondentHash") return hash;
    if (header === "SubmittedAt") return new Date();
    if (header === "Role") return String(payload.role || "");
    return responseMap[header] || "";
  });
}

function findHashRow_(sheet, hash) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const index = values.findIndex((row) => row[0] === hash);
  return index === -1 ? null : index + 2;
}

function buildSummary_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = getOrCreateSheet_(ss, RESPONSES_SHEET);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 4) {
    return { generatedAt: new Date().toISOString(), respondentCount: 0, standards: [] };
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0];
  const rows = values.slice(1).filter((row) => row[0]);
  const standards = headers
    .map((header) => {
      const match = String(header).match(/^S(\d+\.\d+) Rating$/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    respondentCount: rows.length,
    standards: standards.map((number) => summarizeStandard_(number, headers, rows))
  };
}

function summarizeStandard_(number, headers, rows) {
  const ratingIndex = headers.indexOf(`S${number} Rating`);
  const commentIndex = headers.indexOf(`S${number} Comment`);
  const ratings = rows
    .map((row) => Number(row[ratingIndex]))
    .filter((value) => value >= 1 && value <= 5)
    .sort((a, b) => a - b);
  const comments = rows
    .map((row) => ({
      rating: Number(row[ratingIndex]),
      comment: String(row[commentIndex] || "").trim()
    }))
    .filter((item) => item.comment);

  return {
    number,
    median: median_(ratings),
    min: ratings.length ? ratings[0] : null,
    max: ratings.length ? ratings[ratings.length - 1] : null,
    comments
  };
}

function median_(values) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function hashSurname_(surname) {
  const normalized = String(surname).trim().toLowerCase().replace(/\s+/g, " ");
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${ensureSalt_()}:${normalized}`,
    Utilities.Charset.UTF_8
  );
  return bytes.map((byte) => {
    const value = byte < 0 ? byte + 256 : byte;
    return (`0${value.toString(16)}`).slice(-2);
  }).join("");
}

function ensureSalt_() {
  const properties = PropertiesService.getScriptProperties();
  let salt = properties.getProperty(HASH_PROPERTY);
  if (!salt) {
    salt = Utilities.getUuid();
    properties.setProperty(HASH_PROPERTY, salt);
  }
  return salt;
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
