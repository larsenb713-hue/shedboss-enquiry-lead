import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Search,
  Download,
  FileText,
  Trash2,
  Edit3,
  ArrowLeft,
  Save,
  X,
  MapPin,
  User,
  Ruler,
  Hammer,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  Printer,
  Upload,
  Sparkles,
  Copy,
  Share2,
  AlertCircle,
  AlertTriangle,
  MoreVertical,
  Loader2,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
} from "lucide-react";

/* ---------- CONSTANTS ---------- */

const COLORS = {
  red: "#C8102E",
  redDark: "#9E0A22",
  charcoal: "#1A1A1A",
  charcoalLight: "#2B2B2B",
  steel: "#546E7A",
  steelLight: "#90A4AE",
  offWhite: "#F5F4F2",
  paper: "#FAFAF8",
  border: "#E4E2DE",
  green: "#2E7D32",
  amber: "#B45309",
  amberBg: "#FEF3C7",
};

const APP_NAME = "Shed Boss Enquiry/Lead";
const STORAGE_KEY_PREFIX = "shedboss:enquiry-lead:lead:";
const INDEX_KEY = "shedboss:enquiry-lead:index";
const CONFIG_KEY = "shedboss:enquiry-lead:config";
// Legacy keys — migrated once at startup.
const LEGACY_KEYS = [
  { prefix: "shedboss:lead-enquiry:lead:", index: "shedboss:lead-enquiry:index" },
  { prefix: "shedboss:lead:", index: "shedboss:index" },
];

/* Airtable */
const AIRTABLE_BASE_URL = "https://api.airtable.com/v0";
const AIRTABLE_RATE_LIMIT_MS = 220; // 5 req/sec = 200ms; +20ms buffer
const DEFAULT_BASE_ID = "appE9kDl2kCBJ5tY8";
const DEFAULT_TABLE_NAME = "Leads";

const MARKETING_SOURCES = [
  "TV Advertisement",
  "Yellow Pages / Local Directory",
  "Internet",
  "Drive By",
  "Repeat Business",
  "Other",
];

const WORK_SCOPE = ["Kit", "Slab", "Erect", "Footings", "Delivery", "Council"];

const DEFAULT_MATERIALS = [
  { id: "m1", description: "Roof Sheets", size: "", qty: "", material: "Colorbond" },
  { id: "m2", description: "Wall Sheets", size: "", qty: "", material: "Colorbond" },
  { id: "m3", description: "Guttering", size: "", qty: "", material: "" },
  { id: "m4", description: "Dividing Walls", size: "", qty: "", material: "" },
  { id: "m5", description: "PA Door", size: "2040 x 840", qty: "", material: "" },
  { id: "m6", description: "Windows / Screens", size: "790 x 1274", qty: "", material: "" },
  { id: "m7", description: "Windows / Screens", size: "790 x 1500", qty: "", material: "" },
  { id: "m8", description: "Roller Door 1", size: "H x W", qty: "", material: "" },
  { id: "m9", description: "Roller Door 2", size: "H x W", qty: "", material: "" },
  { id: "m10", description: "Roller Door 3", size: "H x W", qty: "", material: "" },
  { id: "m11", description: "Glass Door / Screens", size: "", qty: "", material: "" },
  { id: "m12", description: "Roller Door Motor", size: "", qty: "", material: "" },
  { id: "m13", description: "Insulation Roof", size: "", qty: "", material: "" },
  { id: "m14", description: "Insulation Walls", size: "", qty: "", material: "" },
  { id: "m15", description: "Vermin Flashing", size: "", qty: "", material: "" },
  { id: "m16", description: "Ventilators", size: "", qty: "", material: "" },
];

const emptyLead = () => ({
  id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  status: "New",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  date: new Date().toISOString().slice(0, 10),
  quoteNo: "",
  quotePreparedBy: "",
  clientName: "",
  phone: "",
  mobile: "",
  email: "",
  siteAddress: "",
  postalAddress: "",
  postalAsAbove: true,
  propertyOwner: "",
  sendQuoteBy: "",
  structureType: "Shed",
  length: "",
  width: "",
  height: "",
  design: "",
  purpose: "",
  timeFrame: "",
  marketingSource: "",
  marketingOther: "",
  access: "",
  level: "",
  power: "",
  water: "",
  sewerSeptic: "",
  sheetsRoof: "",
  sheetsWalls: "",
  overheadPower: false,
  trees: false,
  stormwater: false,
  boundaryNotes: "",
  notes: "",
  fullBuildQuote: false,
  kitOnlyQuote: false,
  workScope: [],
  materials: JSON.parse(JSON.stringify(DEFAULT_MATERIALS)),
  // Airtable integration:
  airtableRecordId: null,
  syncStatus: "local", // 'local' | 'syncing' | 'synced' | 'error'
  syncError: null,
  lastSyncAt: null,
});

/* ---------- SAFE STORAGE ---------- */

async function safeStorageGet(key) {
  try {
    if (!window.storage) return { ok: false, error: "storage unavailable" };
    const res = await window.storage.get(key);
    return { ok: true, value: res ? res.value : null };
  } catch (e) {
    return { ok: false, error: e?.message || "get failed" };
  }
}

async function safeStorageSet(key, value) {
  try {
    if (!window.storage) return { ok: false, error: "storage unavailable" };
    await window.storage.set(key, value);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "set failed" };
  }
}

async function safeStorageDelete(key) {
  try {
    if (!window.storage) return { ok: false, error: "storage unavailable" };
    await window.storage.delete(key);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "delete failed" };
  }
}

/* ---------- NORMALISE ---------- */

function normaliseLead(data) {
  const base = emptyLead();
  const out = { ...base, ...data };
  if (!out.id) out.id = base.id;
  if (!Array.isArray(out.materials) || out.materials.length === 0) {
    out.materials = JSON.parse(JSON.stringify(DEFAULT_MATERIALS));
  } else {
    out.materials = out.materials.map((m, i) => ({
      id: m.id || `m_import_${Date.now()}_${i}`,
      description: m.description || "",
      size: m.size || "",
      qty: m.qty || "",
      material: m.material || "",
    }));
  }
  if (!Array.isArray(out.workScope)) out.workScope = [];
  if (!out.createdAt) out.createdAt = new Date().toISOString();
  out.updatedAt = new Date().toISOString();
  if (typeof out.airtableRecordId === "undefined") out.airtableRecordId = null;
  if (!out.syncStatus) out.syncStatus = "local";
  if (typeof out.syncError === "undefined") out.syncError = null;
  if (typeof out.lastSyncAt === "undefined") out.lastSyncAt = null;
  return out;
}

/* ---------- VALIDATION ---------- */

function validateLead(lead) {
  const errors = [];
  if (!lead.clientName || !lead.clientName.trim()) {
    errors.push("Client Name is required.");
  }
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())) {
    errors.push("Email address looks invalid.");
  }
  return errors;
}

/* ---------- CLIPBOARD + SHARE ---------- */

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return { ok };
  } catch (e) {
    return { ok: false, error: e?.message || "copy failed" };
  }
}

async function shareContent(text, filename, mimeType = "text/plain") {
  try {
    if (typeof File !== "undefined" && navigator.canShare) {
      const file = new File([text], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return { ok: true, method: "share-file" };
      }
    }
  } catch (e) {
    if (e?.name === "AbortError") return { ok: true, method: "cancelled" };
  }
  try {
    if (navigator.share) {
      await navigator.share({ title: filename, text });
      return { ok: true, method: "share-text" };
    }
  } catch (e) {
    if (e?.name === "AbortError") return { ok: true, method: "cancelled" };
  }
  const r = await copyToClipboard(text);
  return { ok: r.ok, method: "clipboard", error: r.error };
}

/* Desktop-only: download as file */
function downloadFile(text, filename, mimeType = "text/plain") {
  try {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "download failed" };
  }
}

/* Rough desktop detection — used only to show/hide the Download button */
function isLikelyDesktop() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const hasTouch = "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 1;
  return !isMobileUA && !hasTouch;
}

/* =====================================================================
   AIRTABLE CLIENT
   ---------------------------------------------------------------------
   Serialised via a simple rate limiter chain (~4.5 req/sec) to stay
   under Airtable's 5 req/sec per-base limit. All errors throw with
   HTTP status attached so the UI can render useful messages.
   ===================================================================== */

class RateLimiter {
  constructor(minInterval) {
    this.minInterval = minInterval;
    this.last = 0;
    this.chain = Promise.resolve();
  }
  run(fn) {
    const next = this.chain.then(async () => {
      const wait = Math.max(0, this.minInterval - (Date.now() - this.last));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      return fn();
    });
    // Keep the chain alive on error so later calls still queue.
    this.chain = next.catch(() => {});
    return next;
  }
}

const airtableRateLimiter = new RateLimiter(AIRTABLE_RATE_LIMIT_MS);

function airtableUrl(baseId, tableName, recordId) {
  const base = `${AIRTABLE_BASE_URL}/${baseId}/${encodeURIComponent(tableName)}`;
  return recordId ? `${base}/${recordId}` : base;
}

async function airtableRequest({ baseId, tableName, pat, method = "GET", recordId, body, query }) {
  if (!baseId || !pat || !tableName) {
    const e = new Error("Airtable not configured");
    e.status = 0;
    throw e;
  }
  const url = airtableUrl(baseId, tableName, recordId) + (query ? `?${query}` : "");
  return airtableRateLimiter.run(async () => {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${pat}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      // Network error — offline, CORS, DNS, etc.
      const err = new Error(e?.message || "Network request failed");
      err.status = 0;
      err.network = true;
      throw err;
    }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      let details = "";
      try {
        const data = await res.json();
        if (data?.error?.message) details = data.error.message;
        else if (data?.error?.type) details = data.error.type;
        else if (typeof data?.error === "string") details = data.error;
      } catch {}
      if (details) msg = `${msg} — ${details}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  });
}

const airtable = {
  async testConnection(config) {
    // Light request — fetches at most 1 record.
    await airtableRequest({
      baseId: config.baseId,
      tableName: config.tableName,
      pat: config.pat,
      query: "maxRecords=1",
    });
    return true;
  },

  async listRecords(config) {
    const records = [];
    let offset;
    let pageCount = 0;
    const MAX_PAGES = 50; // hard cap: 5,000 records. Bump if needed.
    do {
      const params = new URLSearchParams({ pageSize: "100" });
      if (offset) params.set("offset", offset);
      const data = await airtableRequest({
        baseId: config.baseId,
        tableName: config.tableName,
        pat: config.pat,
        query: params.toString(),
      });
      if (Array.isArray(data?.records)) records.push(...data.records);
      offset = data?.offset;
      pageCount += 1;
      if (pageCount >= MAX_PAGES) {
        console.warn(`Airtable list hit ${MAX_PAGES}-page cap; stopping.`);
        break;
      }
    } while (offset);
    return records;
  },

  async createRecord(config, fields) {
    return airtableRequest({
      baseId: config.baseId,
      tableName: config.tableName,
      pat: config.pat,
      method: "POST",
      body: { fields, typecast: true },
    });
  },

  async updateRecord(config, recordId, fields) {
    return airtableRequest({
      baseId: config.baseId,
      tableName: config.tableName,
      pat: config.pat,
      method: "PATCH",
      recordId,
      body: { fields, typecast: true },
    });
  },

  async deleteRecord(config, recordId) {
    return airtableRequest({
      baseId: config.baseId,
      tableName: config.tableName,
      pat: config.pat,
      method: "DELETE",
      recordId,
    });
  },
};

function friendlyAirtableError(err) {
  if (!err) return "Unknown error";
  if (err.network) return "Network error — offline or blocked";
  if (err.status === 401) return "Unauthorised — check Personal Access Token";
  if (err.status === 403) return "Forbidden — token lacks access to this base";
  if (err.status === 404) return "Not found — check Base ID and Table name";
  if (err.status === 422) return `Invalid data — ${err.message.replace(/^HTTP 422\s*—\s*/, "")}`;
  if (err.status === 429) return "Rate limited — retry in a moment";
  if (err.status >= 500) return "Airtable server error — retry in a moment";
  return err.message || "Request failed";
}

/* =====================================================================
   FIELD MAPPER
   ---------------------------------------------------------------------
   toAirtable(lead)        → Airtable "fields" object
   fromAirtable(record)    → app-shaped lead
   Primary field "Name" carries clientName.
   Single-select fields are OMITTED when empty (Airtable rejects "").
   Created At / Updated At are computed server-side — never sent.
   ===================================================================== */

function toAirtable(lead) {
  const fields = {};

  // Primary key — Airtable default primary field.
  if (lead.clientName) fields["Name"] = lead.clientName;
  else fields["Name"] = ""; // allow clearing on update

  // Single-selects: omit if empty to avoid 422.
  if (lead.status) fields["Status"] = lead.status;
  if (lead.sendQuoteBy) fields["Send Quote By"] = lead.sendQuoteBy;
  if (lead.propertyOwner) fields["Property Owner"] = lead.propertyOwner;
  if (lead.structureType) fields["Structure Type"] = lead.structureType;
  if (lead.design) fields["Design"] = lead.design;
  if (lead.marketingSource) fields["Marketing Source"] = lead.marketingSource;
  if (lead.sheetsRoof) fields["Sheets Roof"] = lead.sheetsRoof;
  if (lead.sheetsWalls) fields["Sheets Walls"] = lead.sheetsWalls;

  // Date (YYYY-MM-DD)
  if (lead.date) fields["Date"] = lead.date;

  // Bridge key — always write so external Airtable edits can be reconciled.
  fields["ShedBoss ID"] = lead.id;

  // Text / long-text fields — always send (empty string clears).
  fields["Quote No"] = lead.quoteNo || "";
  fields["Quote Prepared By"] = lead.quotePreparedBy || "";
  fields["Phone"] = lead.phone || "";
  fields["Mobile"] = lead.mobile || "";
  fields["Email"] = lead.email || "";
  fields["Site Address"] = lead.siteAddress || "";
  fields["Postal Address"] = lead.postalAddress || "";
  fields["Length"] = lead.length || "";
  fields["Width"] = lead.width || "";
  fields["Height"] = lead.height || "";
  fields["Time Frame"] = lead.timeFrame || "";
  fields["Purpose"] = lead.purpose || "";
  fields["Marketing Other"] = lead.marketingOther || "";
  fields["Access"] = lead.access || "";
  fields["Level"] = lead.level || "";
  fields["Power"] = lead.power || "";
  fields["Water"] = lead.water || "";
  fields["Sewer Septic"] = lead.sewerSeptic || "";
  fields["Boundary Notes"] = lead.boundaryNotes || "";
  fields["Notes"] = lead.notes || "";

  // Checkboxes
  fields["Postal As Above"] = !!lead.postalAsAbove;
  fields["Overhead Power"] = !!lead.overheadPower;
  fields["Trees"] = !!lead.trees;
  fields["Stormwater"] = !!lead.stormwater;
  fields["Full Build Quote"] = !!lead.fullBuildQuote;
  fields["Kit Only Quote"] = !!lead.kitOnlyQuote;

  // Multi-select
  fields["Work Scope"] = Array.isArray(lead.workScope) ? lead.workScope : [];

  // Materials serialised as JSON blob.
  fields["Materials JSON"] = JSON.stringify(lead.materials || []);

  // Intentionally NOT sent: Created At, Updated At (auto).
  return fields;
}

function fromAirtable(record) {
  const f = record.fields || {};

  // Parse materials; fall back to defaults on malformed JSON.
  let materials = JSON.parse(JSON.stringify(DEFAULT_MATERIALS));
  if (f["Materials JSON"]) {
    try {
      const parsed = JSON.parse(f["Materials JSON"]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        materials = parsed.map((m, i) => ({
          id: m.id || `m_at_${record.id}_${i}`,
          description: m.description || "",
          size: m.size || "",
          qty: m.qty || "",
          material: m.material || "",
        }));
      }
    } catch (e) {
      console.warn("Materials JSON parse failed for record", record.id, e);
    }
  }

  // If a record was created directly in Airtable with no ShedBoss ID,
  // use a deterministic fallback so we don't spawn duplicates on reload.
  const localId = f["ShedBoss ID"] || `lead_at_${record.id}`;

  return {
    id: localId,
    airtableRecordId: record.id,
    status: f["Status"] || "New",
    date: f["Date"] || new Date().toISOString().slice(0, 10),
    quoteNo: f["Quote No"] || "",
    quotePreparedBy: f["Quote Prepared By"] || "",
    clientName: f["Name"] || "",
    phone: f["Phone"] || "",
    mobile: f["Mobile"] || "",
    email: f["Email"] || "",
    sendQuoteBy: f["Send Quote By"] || "",
    siteAddress: f["Site Address"] || "",
    postalAddress: f["Postal Address"] || "",
    postalAsAbove: !!f["Postal As Above"],
    propertyOwner: f["Property Owner"] || "",
    structureType: f["Structure Type"] || "Shed",
    length: f["Length"] || "",
    width: f["Width"] || "",
    height: f["Height"] || "",
    design: f["Design"] || "",
    timeFrame: f["Time Frame"] || "",
    purpose: f["Purpose"] || "",
    marketingSource: f["Marketing Source"] || "",
    marketingOther: f["Marketing Other"] || "",
    access: f["Access"] || "",
    level: f["Level"] || "",
    power: f["Power"] || "",
    water: f["Water"] || "",
    sewerSeptic: f["Sewer Septic"] || "",
    sheetsRoof: f["Sheets Roof"] || "",
    sheetsWalls: f["Sheets Walls"] || "",
    overheadPower: !!f["Overhead Power"],
    trees: !!f["Trees"],
    stormwater: !!f["Stormwater"],
    boundaryNotes: f["Boundary Notes"] || "",
    notes: f["Notes"] || "",
    fullBuildQuote: !!f["Full Build Quote"],
    kitOnlyQuote: !!f["Kit Only Quote"],
    workScope: Array.isArray(f["Work Scope"]) ? f["Work Scope"] : [],
    materials,
    createdAt: f["Created At"] || new Date().toISOString(),
    updatedAt: f["Updated At"] || new Date().toISOString(),
    syncStatus: "synced",
    syncError: null,
    lastSyncAt: new Date().toISOString(),
  };
}

function isConfigured(config) {
  return !!(config && config.baseId && config.pat && config.tableName);
}

/* ---------- UI PRIMITIVES ---------- */

const Label = ({ children, required, className = "" }) => (
  <label
    className={`block text-[11px] font-semibold tracking-[0.12em] uppercase mb-1.5 ${className}`}
    style={{ color: COLORS.charcoalLight, fontFamily: "'IBM Plex Sans', sans-serif" }}
  >
    {children}
    {required && <span style={{ color: COLORS.red }}> *</span>}
  </label>
);

const inputBase = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "14px",
  fontFamily: "'IBM Plex Sans', sans-serif",
  border: `1px solid ${COLORS.border}`,
  borderRadius: "2px",
  background: "#fff",
  color: COLORS.charcoal,
  transition: "border-color 0.15s, box-shadow 0.15s",
  outline: "none",
  boxSizing: "border-box",
};

const Input = ({ style, invalid, ...props }) => (
  <input
    style={{
      ...inputBase,
      ...(invalid ? { borderColor: COLORS.red, boxShadow: `0 0 0 3px ${COLORS.red}15` } : {}),
      ...style,
    }}
    onFocus={(e) => {
      e.target.style.borderColor = COLORS.red;
      e.target.style.boxShadow = `0 0 0 3px ${COLORS.red}15`;
    }}
    onBlur={(e) => {
      if (!invalid) {
        e.target.style.borderColor = COLORS.border;
        e.target.style.boxShadow = "none";
      }
    }}
    {...props}
  />
);

const Textarea = ({ style, ...props }) => (
  <textarea
    style={{ ...inputBase, minHeight: "80px", resize: "vertical", ...style }}
    onFocus={(e) => {
      e.target.style.borderColor = COLORS.red;
      e.target.style.boxShadow = `0 0 0 3px ${COLORS.red}15`;
    }}
    onBlur={(e) => {
      e.target.style.borderColor = COLORS.border;
      e.target.style.boxShadow = "none";
    }}
    {...props}
  />
);

const Select = ({ style, children, ...props }) => (
  <select
    style={{ ...inputBase, cursor: "pointer", ...style }}
    onFocus={(e) => {
      e.target.style.borderColor = COLORS.red;
      e.target.style.boxShadow = `0 0 0 3px ${COLORS.red}15`;
    }}
    onBlur={(e) => {
      e.target.style.borderColor = COLORS.border;
      e.target.style.boxShadow = "none";
    }}
    {...props}
  >
    {children}
  </select>
);

const Checkbox = ({ checked, onChange, label }) => (
  <label
    className="flex items-center gap-2.5 cursor-pointer select-none"
    style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", minWidth: 0 }}
  >
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: "18px",
        height: "18px",
        border: `1.5px solid ${checked ? COLORS.red : COLORS.steelLight}`,
        background: checked ? COLORS.red : "#fff",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="square" />
        </svg>
      )}
    </span>
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
    <span style={{ color: COLORS.charcoal }}>{label}</span>
  </label>
);

const Radio = ({ checked, onChange, label, name }) => (
  <label
    className="flex items-center gap-2.5 cursor-pointer select-none"
    style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", minWidth: 0 }}
  >
    <span
      style={{
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        border: `1.5px solid ${checked ? COLORS.red : COLORS.steelLight}`,
        background: "#fff",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {checked && (
        <span
          style={{
            position: "absolute",
            inset: "3px",
            borderRadius: "50%",
            background: COLORS.red,
          }}
        />
      )}
    </span>
    <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
    <span style={{ color: COLORS.charcoal }}>{label}</span>
  </label>
);

const Button = ({ variant = "primary", children, style, disabled, ...props }) => {
  const variants = {
    primary: { background: COLORS.red, color: "#fff", border: `1px solid ${COLORS.red}` },
    dark: { background: COLORS.charcoal, color: "#fff", border: `1px solid ${COLORS.charcoal}` },
    outline: { background: "#fff", color: COLORS.charcoal, border: `1px solid ${COLORS.border}` },
    ghost: { background: "transparent", color: COLORS.charcoal, border: "1px solid transparent" },
    danger: { background: "#fff", color: COLORS.red, border: `1px solid ${COLORS.red}` },
  };
  return (
    <button
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 16px",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        fontFamily: "'IBM Plex Sans', sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        borderRadius: "2px",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.55 : 1,
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};

const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div
    className="flex items-center gap-3 pb-3 mb-5"
    style={{ borderBottom: `2px solid ${COLORS.charcoal}` }}
  >
    <div
      style={{
        width: "36px",
        height: "36px",
        background: COLORS.charcoal,
        color: COLORS.red,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={18} />
    </div>
    <div style={{ minWidth: 0 }}>
      <h2
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: "20px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: COLORS.charcoal,
          lineHeight: 1,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "12px",
            color: COLORS.steel,
            marginTop: "4px",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

/* ---------- LOGO ---------- */

const ShedBossLogo = ({ size = 36 }) => (
  <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
      <path d="M20 4 L36 32 L4 32 Z" fill={COLORS.charcoal} />
      <path d="M20 14 L28 28 L12 28 Z" fill={COLORS.red} />
    </svg>
    <div className="flex flex-col leading-none" style={{ minWidth: 0 }}>
      <span
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontWeight: 700,
          fontSize: size * 0.55,
          letterSpacing: "0.02em",
          color: COLORS.charcoal,
          whiteSpace: "nowrap",
        }}
      >
        SHED<span style={{ color: COLORS.red }}>BOSS</span>
      </span>
      <span
        style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: size * 0.22,
          letterSpacing: "0.3em",
          color: COLORS.steel,
          marginTop: "2px",
          whiteSpace: "nowrap",
        }}
      >
        BUILT STRONG · BUILT RIGHT
      </span>
    </div>
  </div>
);

/* ---------- TOAST ---------- */

function Toast({ toast }) {
  if (!toast) return null;
  const bg =
    toast.type === "error"
      ? COLORS.red
      : toast.type === "warn"
      ? COLORS.amber
      : toast.type === "success"
      ? COLORS.green
      : COLORS.charcoal;
  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: bg,
        color: "#fff",
        padding: "12px 20px",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: "13px",
        fontWeight: 500,
        zIndex: 200,
        maxWidth: "90vw",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
      }}
    >
      {toast.type === "error" ? (
        <AlertCircle size={16} />
      ) : toast.type === "success" ? (
        <CheckCircle2 size={16} />
      ) : toast.type === "warn" ? (
        <AlertTriangle size={16} />
      ) : null}
      {toast.msg}
    </div>
  );
}

/* ---------- MODAL SHELL ---------- */

function Modal({ title, icon: Icon, onClose, children, maxWidth = "640px" }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26, 26, 26, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          overflow: "auto",
          borderTop: `4px solid ${COLORS.red}`,
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} style={{ color: COLORS.red }} />}
            <h3
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: "18px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
              }}
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: COLORS.steel,
              padding: "4px",
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- CONFIRM MODAL (branded replacement for window.confirm) ---------- */

function ConfirmModal({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive, onConfirm, onCancel }) {
  return (
    <Modal title={title} icon={AlertTriangle} onClose={onCancel} maxWidth="460px">
      <p
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "14px",
          color: COLORS.charcoalLight,
          lineHeight: 1.5,
          marginBottom: "20px",
        }}
      >
        {message}
      </p>
      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- IMPORT MODAL ---------- */

function ImportModal({ onClose, onImport, notify }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    try {
      const content = await file.text();
      setText(content);
      setError("");
    } catch (e) {
      setError("Could not read file.");
    }
  };

  const handleImport = () => {
    setError("");
    if (!text.trim()) {
      setError("Paste JSON data or choose a file first.");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError("Invalid JSON: " + e.message);
      return;
    }
    // Per-record isolation — don't let one bad record kill the batch.
    const leads = Array.isArray(parsed) ? parsed : [parsed];
    const successes = [];
    const failures = [];
    leads.forEach((raw, idx) => {
      try {
        successes.push(normaliseLead(raw));
      } catch (e) {
        failures.push({ idx, reason: e?.message || "unknown error" });
      }
    });

    if (successes.length === 0) {
      setError(`All ${leads.length} record(s) failed to import. First error: ${failures[0]?.reason}`);
      return;
    }

    onImport(successes);
    if (failures.length > 0) {
      notify(
        `Imported ${successes.length} of ${leads.length} — ${failures.length} failed`,
        "warn"
      );
    } else {
      notify(
        `Imported ${successes.length} lead${successes.length === 1 ? "" : "s"}`,
        "success"
      );
    }
  };

  return (
    <Modal title="Import Leads" icon={Upload} onClose={onClose}>
      <p
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "13px",
          color: COLORS.steel,
          marginBottom: "14px",
          lineHeight: 1.5,
        }}
      >
        Paste JSON below or upload a{" "}
        <code
          style={{
            background: COLORS.offWhite,
            padding: "1px 6px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "12px",
          }}
        >
          .json
        </code>{" "}
        file. Works with a single lead or an array of leads. Failed records are skipped; the rest are imported.
      </p>

      <div className="flex gap-2 mb-3 flex-wrap">
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Choose File
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,text/plain"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
        placeholder='{ "clientName": "Jody Rankine", "mobile": "0418 773 245", ... }'
        style={{
          minHeight: "220px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      />

      {error && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            background: `${COLORS.red}10`,
            border: `1px solid ${COLORS.red}40`,
            color: COLORS.red,
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "13px",
            borderRadius: "2px",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4 flex-wrap">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleImport}>
          <Sparkles size={14} /> Import
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- EXPORT MODAL ---------- */

function ExportModal({ title, content, filename, mimeType = "text/plain", onClose, notify }) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef(null);
  const desktop = isLikelyDesktop();

  const handleCopy = async () => {
    const r = await copyToClipboard(content);
    if (r.ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify("Copied to clipboard", "success");
    } else {
      if (taRef.current) {
        taRef.current.focus();
        taRef.current.select();
      }
      notify("Auto-copy blocked — long-press to select and copy", "warn");
    }
  };

  const handleShare = async () => {
    const r = await shareContent(content, filename, mimeType);
    if (r.method === "share-file") {
      notify("Shared as file", "success");
    } else if (r.method === "share-text") {
      notify("Shared as text (file attachment not supported)", "warn");
    } else if (r.method === "cancelled") {
      // no toast
    } else if (r.ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify("Copied to clipboard (share unavailable)", "success");
    } else {
      notify("Share and copy both failed — select text manually", "error");
    }
  };

  const handleDownload = () => {
    const r = downloadFile(content, filename, mimeType);
    if (r.ok) {
      notify("File downloaded", "success");
    } else {
      notify("Download failed — try Copy or Share", "error");
    }
  };

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <Modal title={title} icon={Share2} onClose={onClose}>
      <p
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "13px",
          color: COLORS.steel,
          marginBottom: "14px",
          lineHeight: 1.5,
        }}
      >
        {desktop
          ? "Download as a file, copy to clipboard, or select the text below manually."
          : "Copy to clipboard, share via the iOS share sheet, or select the text below manually."}
      </p>

      <div className="flex gap-2 mb-3 flex-wrap">
        {desktop && (
          <Button variant="primary" onClick={handleDownload}>
            <Download size={14} /> Download
          </Button>
        )}
        <Button variant={desktop ? "outline" : "primary"} onClick={handleCopy}>
          <Copy size={14} /> {copied ? "Copied!" : "Copy"}
        </Button>
        {canShare && (
          <Button variant="outline" onClick={handleShare}>
            <Share2 size={14} /> Share…
          </Button>
        )}
      </div>

      <textarea
        ref={taRef}
        readOnly
        value={content}
        onClick={(e) => e.target.select()}
        style={{
          ...inputBase,
          minHeight: "260px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "12px",
          lineHeight: 1.5,
          background: COLORS.paper,
        }}
      />

      <div
        style={{
          marginTop: "10px",
          fontSize: "11px",
          color: COLORS.steel,
          fontFamily: "'IBM Plex Sans', sans-serif",
          letterSpacing: "0.05em",
        }}
      >
        FILE NAME: {filename}
      </div>

      <div className="flex justify-end mt-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- EXPORT CONTENT BUILDERS ---------- */

function buildLeadJSON(lead) {
  return JSON.stringify(lead, null, 2);
}

function buildLeadCSV(lead) {
  const rows = [
    ["Field", "Value"],
    ["Date", lead.date],
    ["Quote No", lead.quoteNo],
    ["Quote Prepared By", lead.quotePreparedBy],
    ["Status", lead.status],
    ["Client Name", lead.clientName],
    ["Phone", lead.phone],
    ["Mobile", lead.mobile],
    ["Email", lead.email],
    ["Site Address", lead.siteAddress],
    ["Postal Address", lead.postalAsAbove ? "As site address" : lead.postalAddress],
    ["Property Owner", lead.propertyOwner],
    ["Send Quote By", lead.sendQuoteBy],
    ["Structure Type", lead.structureType],
    ["Length", lead.length],
    ["Width", lead.width],
    ["Height", lead.height],
    ["Design", lead.design],
    ["Purpose", lead.purpose],
    ["Time Frame", lead.timeFrame],
    [
      "Marketing Source",
      lead.marketingSource === "Other"
        ? `Other: ${lead.marketingOther}`
        : lead.marketingSource,
    ],
    ["Access", lead.access],
    ["Level", lead.level],
    ["Power", lead.power],
    ["Water", lead.water],
    ["Sewer / Septic", lead.sewerSeptic],
    ["Sheets Roof", lead.sheetsRoof],
    ["Sheets Walls", lead.sheetsWalls],
    ["Overhead Power", lead.overheadPower ? "Yes" : "No"],
    ["Trees", lead.trees ? "Yes" : "No"],
    ["Stormwater", lead.stormwater ? "Yes" : "No"],
    ["Boundary Notes", lead.boundaryNotes],
    ["Notes", lead.notes],
    ["Full Build Quote", lead.fullBuildQuote ? "Yes" : "No"],
    ["Kit Only Quote", lead.kitOnlyQuote ? "Yes" : "No"],
    ["Work Scope", (lead.workScope || []).join("; ")],
  ];
  rows.push([], ["Materials", ""]);
  rows.push(["Description", "Size", "Qty", "Colorbond / Zinc"]);
  (lead.materials || []).forEach((m) => {
    rows.push([m.description, m.size, m.qty, m.material]);
  });
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function buildLeadSummary(lead) {
  const lines = [];
  lines.push(`SHED BOSS — QUALIFICATION LEAD`);
  lines.push("=".repeat(40));
  lines.push(`Date: ${lead.date}    Quote #: ${lead.quoteNo || "—"}`);
  lines.push(`Prepared by: ${lead.quotePreparedBy || "—"}`);
  lines.push(`Status: ${lead.status}`);
  lines.push("");
  lines.push("CLIENT");
  lines.push("-".repeat(40));
  lines.push(`Name: ${lead.clientName || "—"}`);
  lines.push(`Phone: ${lead.phone || "—"}   Mobile: ${lead.mobile || "—"}`);
  lines.push(`Email: ${lead.email || "—"}`);
  lines.push(`Site: ${lead.siteAddress || "—"}`);
  lines.push(`Postal: ${lead.postalAsAbove ? "(same as site)" : lead.postalAddress || "—"}`);
  lines.push(`Property owner: ${lead.propertyOwner || "—"}    Send quote by: ${lead.sendQuoteBy || "—"}`);
  lines.push("");
  lines.push("SHED DETAILS");
  lines.push("-".repeat(40));
  lines.push(`Type: ${lead.structureType}   Size: ${lead.length || "—"} × ${lead.width || "—"} × ${lead.height || "—"}`);
  lines.push(`Design: ${lead.design || "—"}`);
  lines.push(`Purpose: ${lead.purpose || "—"}`);
  lines.push(`Time frame: ${lead.timeFrame || "—"}`);
  lines.push(
    `Heard about us: ${
      lead.marketingSource === "Other"
        ? `Other — ${lead.marketingOther}`
        : lead.marketingSource || "—"
    }`
  );
  lines.push("");
  lines.push("SITE");
  lines.push("-".repeat(40));
  lines.push(`Access: ${lead.access || "—"}`);
  lines.push(`Level: ${lead.level || "—"}`);
  lines.push(`Power: ${lead.power || "—"}    Water: ${lead.water || "—"}`);
  lines.push(`Sewer/Septic: ${lead.sewerSeptic || "—"}`);
  lines.push(`Sheets — Roof: ${lead.sheetsRoof || "—"}    Walls: ${lead.sheetsWalls || "—"}`);
  const hazards = [];
  if (lead.overheadPower) hazards.push("Overhead Power");
  if (lead.trees) hazards.push("Trees");
  if (lead.stormwater) hazards.push("Stormwater");
  lines.push(`Hazards: ${hazards.length ? hazards.join(", ") : "none"}`);
  if (lead.boundaryNotes) lines.push(`Boundary notes: ${lead.boundaryNotes}`);
  lines.push("");
  if (lead.notes) {
    lines.push("NOTES");
    lines.push("-".repeat(40));
    lines.push(lead.notes);
    lines.push("");
  }
  lines.push("QUOTE TYPE");
  lines.push("-".repeat(40));
  lines.push(
    `Full build: ${lead.fullBuildQuote ? "Yes" : "No"}    Kit only: ${lead.kitOnlyQuote ? "Yes" : "No"}`
  );
  lines.push(`Work scope: ${(lead.workScope || []).join(", ") || "—"}`);
  lines.push("");
  lines.push("MATERIALS");
  lines.push("-".repeat(40));
  (lead.materials || []).forEach((m) => {
    if (m.description || m.qty || m.size || m.material) {
      lines.push(
        `${m.description || "—"}  |  ${m.size || "—"}  |  Qty: ${m.qty || "—"}  |  ${
          m.material || "—"
        }`
      );
    }
  });
  return lines.join("\n");
}

/* ---------- SYNC UI ---------- */

/* Per-lead sync status pill */
function SyncBadge({ status, error, compact }) {
  const configs = {
    synced: { icon: Cloud, color: COLORS.green, label: "Synced" },
    syncing: { icon: RefreshCw, color: COLORS.steel, label: "Syncing", spinning: true },
    error: { icon: AlertTriangle, color: COLORS.red, label: "Sync error" },
    local: { icon: CloudOff, color: COLORS.steelLight, label: "Local only" },
  };
  const cfg = configs[status] || configs.local;
  const Icon = cfg.icon;
  const tooltip = error ? `${cfg.label}: ${error}` : cfg.label;
  return (
    <span
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: compact ? "10px" : "11px",
        color: cfg.color,
        fontFamily: "'Oswald', sans-serif",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <Icon
        size={compact ? 11 : 13}
        className={cfg.spinning ? "animate-spin" : ""}
      />
      {!compact && cfg.label}
    </span>
  );
}

/* Header-level connection + sync status chip with action button */
function SyncStatusChip({ config, syncSummary, onOpenSettings, onSyncAll }) {
  // syncSummary: { total, errors, syncing, synced, local }
  if (!isConfigured(config)) {
    return (
      <button
        onClick={onOpenSettings}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 12px",
          background: `${COLORS.amber}15`,
          border: `1px solid ${COLORS.amber}40`,
          color: COLORS.amber,
          fontFamily: "'Oswald', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
          cursor: "pointer",
          borderRadius: "2px",
        }}
        title="Connect to Airtable"
      >
        <WifiOff size={13} /> Local only
      </button>
    );
  }

  if (syncSummary.syncing > 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 12px",
          background: `${COLORS.steel}15`,
          border: `1px solid ${COLORS.steel}40`,
          color: COLORS.steel,
          fontFamily: "'Oswald', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        <RefreshCw size={13} className="animate-spin" /> Syncing {syncSummary.syncing}…
      </span>
    );
  }

  if (syncSummary.errors > 0) {
    return (
      <button
        onClick={onSyncAll}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 12px",
          background: `${COLORS.red}15`,
          border: `1px solid ${COLORS.red}40`,
          color: COLORS.red,
          fontFamily: "'Oswald', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 600,
          cursor: "pointer",
          borderRadius: "2px",
        }}
        title="Retry failed syncs"
      >
        <AlertTriangle size={13} /> {syncSummary.errors} error{syncSummary.errors === 1 ? "" : "s"} · Retry
      </button>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 12px",
        background: `${COLORS.green}12`,
        border: `1px solid ${COLORS.green}40`,
        color: COLORS.green,
        fontFamily: "'Oswald', sans-serif",
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontWeight: 500,
      }}
      title="All leads synced to Airtable"
    >
      <Wifi size={13} /> Synced
    </span>
  );
}

/* ---------- SETTINGS MODAL ---------- */

function SettingsModal({ initialConfig, onClose, onSave, onDisconnect, notify }) {
  const [baseId, setBaseId] = useState(initialConfig?.baseId || DEFAULT_BASE_ID);
  const [tableName, setTableName] = useState(initialConfig?.tableName || DEFAULT_TABLE_NAME);
  const [pat, setPat] = useState(initialConfig?.pat || "");
  const [showPat, setShowPat] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connected = isConfigured(initialConfig);
  const canTest = baseId.trim() && tableName.trim() && pat.trim();

  const runTest = async () => {
    if (!canTest) return;
    setTesting(true);
    setTestResult(null);
    try {
      await airtable.testConnection({
        baseId: baseId.trim(),
        tableName: tableName.trim(),
        pat: pat.trim(),
      });
      setTestResult({ ok: true, message: "Connected successfully." });
    } catch (e) {
      setTestResult({ ok: false, message: friendlyAirtableError(e) });
    } finally {
      setTesting(false);
    }
  };

  const runSave = () => {
    if (!canTest) {
      notify("Base ID, Table name and PAT are all required.", "error");
      return;
    }
    onSave({ baseId: baseId.trim(), tableName: tableName.trim(), pat: pat.trim() });
  };

  const runDisconnect = () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    onDisconnect();
  };

  return (
    <Modal title="Airtable Connection" icon={Settings} onClose={onClose}>
      <p
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "13px",
          color: COLORS.steel,
          marginBottom: "18px",
          lineHeight: 1.5,
        }}
      >
        Dual-write sync: every saved lead is written to both this device and the Airtable base.
        Your Personal Access Token is stored on this device only.
      </p>

      <div style={{ marginBottom: "14px" }}>
        <Label>Base ID</Label>
        <Input
          value={baseId}
          onChange={(e) => {
            setBaseId(e.target.value);
            setTestResult(null);
          }}
          placeholder="app..."
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}
        />
      </div>

      <div style={{ marginBottom: "14px" }}>
        <Label>Table Name</Label>
        <Input
          value={tableName}
          onChange={(e) => {
            setTableName(e.target.value);
            setTestResult(null);
          }}
          placeholder="Leads"
        />
      </div>

      <div style={{ marginBottom: "14px" }}>
        <Label required>Personal Access Token</Label>
        <div style={{ position: "relative" }}>
          <Input
            type={showPat ? "text" : "password"}
            value={pat}
            onChange={(e) => {
              setPat(e.target.value);
              setTestResult(null);
            }}
            placeholder="pat..."
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13px",
              paddingRight: "44px",
            }}
          />
          <button
            onClick={() => setShowPat((v) => !v)}
            aria-label={showPat ? "Hide token" : "Show token"}
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: COLORS.steel,
              padding: "4px",
            }}
          >
            {showPat ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "11px",
            color: COLORS.steel,
            marginTop: "6px",
            lineHeight: 1.4,
          }}
        >
          Generate at airtable.com → Builder hub → Personal access tokens. Required scopes:{" "}
          <code style={{ background: COLORS.offWhite, padding: "1px 4px", fontSize: "10px" }}>
            data.records:read
          </code>
          ,{" "}
          <code style={{ background: COLORS.offWhite, padding: "1px 4px", fontSize: "10px" }}>
            data.records:write
          </code>
          . Add access to the ShedBoss base.
        </p>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <Button variant="outline" onClick={runTest} disabled={!canTest || testing}>
          {testing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Wifi size={14} />
          )}
          {testing ? "Testing…" : "Test Connection"}
        </Button>
      </div>

      {testResult && (
        <div
          style={{
            padding: "10px 12px",
            background: testResult.ok ? `${COLORS.green}12` : `${COLORS.red}10`,
            border: `1px solid ${testResult.ok ? COLORS.green : COLORS.red}40`,
            color: testResult.ok ? COLORS.green : COLORS.red,
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "13px",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "14px",
          }}
        >
          {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {testResult.message}
        </div>
      )}

      <div className="flex justify-between items-center gap-2 flex-wrap mt-5">
        <div>
          {connected && (
            <Button variant={confirmDisconnect ? "danger" : "ghost"} onClick={runDisconnect}>
              {confirmDisconnect ? "Really disconnect?" : "Disconnect"}
            </Button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={runSave} disabled={!canTest}>
            <Save size={14} /> Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- DASHBOARD ---------- */

function Dashboard({
  leads,
  onNew,
  onOpen,
  onDelete,
  onExportAll,
  onImport,
  notify,
  requestConfirm,
  config,
  syncSummary,
  onOpenSettings,
  onSyncAll,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    let list = [...leads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (statusFilter !== "All") list = list.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          (l.clientName || "").toLowerCase().includes(q) ||
          (l.siteAddress || "").toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.mobile || "").toLowerCase().includes(q) ||
          (l.quoteNo || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: leads.length,
      newCount: leads.filter((l) => l.status === "New").length,
      quoted: leads.filter((l) => l.status === "Quoted").length,
      won: leads.filter((l) => l.status === "Won").length,
    }),
    [leads]
  );

  const confirmDelete = (lead) => {
    requestConfirm({
      title: "Delete Lead",
      message: `Delete the lead for ${lead.clientName || "this client"}? This can't be undone locally.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => onDelete(lead.id),
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.paper }}>
      <div
        style={{
          background: "#fff",
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "16px 20px",
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <ShedBossLogo />
          <div className="flex gap-2 flex-wrap items-center">
            <SyncStatusChip
              config={config}
              syncSummary={syncSummary}
              onOpenSettings={onOpenSettings}
              onSyncAll={onSyncAll}
            />
            <button
              onClick={onOpenSettings}
              aria-label="Airtable settings"
              title="Airtable settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "9px",
                background: "#fff",
                border: `1px solid ${COLORS.border}`,
                cursor: "pointer",
                color: COLORS.charcoal,
                borderRadius: "2px",
              }}
            >
              <Settings size={16} />
            </button>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload size={14} /> Import
            </Button>
            <Button variant="outline" onClick={onExportAll}>
              <Share2 size={14} /> Export
            </Button>
            <Button variant="primary" onClick={onNew}>
              <Plus size={16} /> New
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-8 sm:pt-10 pb-6">
        <div
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "12px",
            letterSpacing: "0.2em",
            color: COLORS.steel,
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          {APP_NAME}
        </div>
        <h1
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: "clamp(32px, 6vw, 44px)",
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: COLORS.charcoal,
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          Enquiry <span style={{ color: COLORS.red }}>Dashboard</span>
        </h1>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Leads", value: stats.total, accent: COLORS.charcoal },
            { label: "New", value: stats.newCount, accent: COLORS.red },
            { label: "Quoted", value: stats.quoted, accent: COLORS.steel },
            { label: "Won", value: stats.won, accent: COLORS.green },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                padding: "18px",
                border: `1px solid ${COLORS.border}`,
                borderLeft: `4px solid ${s.accent}`,
              }}
            >
              <div
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "11px",
                  letterSpacing: "0.15em",
                  color: COLORS.steel,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: "32px",
                  fontWeight: 600,
                  color: COLORS.charcoal,
                  marginTop: "4px",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-4">
        <div className="flex gap-2 flex-col sm:flex-row">
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: COLORS.steel,
              }}
            />
            <Input
              placeholder="Search name, address, email, phone, quote #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "38px" }}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "100%", maxWidth: "200px" }}
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="Quoted">Quoted</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </Select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}` }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: COLORS.steel,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              <FileText size={48} style={{ margin: "0 auto 16px", color: COLORS.steelLight }} />
              <div style={{ fontSize: "16px", fontWeight: 500, color: COLORS.charcoal }}>
                {leads.length === 0 ? "No leads yet" : "No matches"}
              </div>
              <div style={{ fontSize: "14px", marginTop: "6px" }}>
                {leads.length === 0
                  ? "Tap 'New' or 'Import' to get started."
                  : "Try a different search or filter."}
              </div>
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="block md:hidden">
                {filtered.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => onOpen(lead.id)}
                    style={{
                      padding: "14px 16px",
                      borderBottom: `1px solid ${COLORS.border}`,
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontFamily: "'IBM Plex Sans', sans-serif",
                            fontWeight: 600,
                            fontSize: "15px",
                            color: COLORS.charcoal,
                          }}
                        >
                          {lead.clientName || "Unnamed lead"}
                        </div>
                        {lead.siteAddress && (
                          <div
                            style={{
                              fontSize: "13px",
                              color: COLORS.steel,
                              marginTop: "2px",
                              fontFamily: "'IBM Plex Sans', sans-serif",
                            }}
                          >
                            {lead.siteAddress}
                          </div>
                        )}
                        <div
                          className="flex items-center gap-2 flex-wrap"
                          style={{
                            marginTop: "6px",
                            fontSize: "12px",
                            color: COLORS.steel,
                            fontFamily: "'IBM Plex Sans', sans-serif",
                          }}
                        >
                          <span>{lead.structureType}</span>
                          {(lead.length || lead.width) && (
                            <span>
                              · {lead.length}×{lead.width}
                              {lead.height ? `×${lead.height}` : ""}
                            </span>
                          )}
                          <span>· {lead.date}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2" style={{ flexShrink: 0 }}>
                        <StatusBadge status={lead.status} />
                        <SyncBadge
                          status={lead.syncStatus}
                          error={lead.syncError}
                          compact
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(lead);
                          }}
                          style={{
                            padding: "6px",
                            background: "transparent",
                            border: `1px solid ${COLORS.border}`,
                            cursor: "pointer",
                            color: COLORS.red,
                          }}
                          aria-label="Delete lead"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: COLORS.charcoal }}>
                      {["Client", "Site Address", "Structure", "Quote #", "Date", "Status", ""].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              padding: "14px 16px",
                              textAlign: "left",
                              fontFamily: "'Oswald', sans-serif",
                              fontSize: "12px",
                              fontWeight: 500,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: "#fff",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((lead, idx) => (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: `1px solid ${COLORS.border}`,
                          background: idx % 2 === 0 ? "#fff" : COLORS.paper,
                          cursor: "pointer",
                        }}
                        onClick={() => onOpen(lead.id)}
                      >
                        <td
                          style={{
                            padding: "14px 16px",
                            fontFamily: "'IBM Plex Sans', sans-serif",
                            fontWeight: 600,
                            color: COLORS.charcoal,
                          }}
                        >
                          {lead.clientName || "—"}
                          {lead.mobile && (
                            <div style={{ fontSize: "12px", color: COLORS.steel, fontWeight: 400 }}>
                              {lead.mobile}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "14px", color: COLORS.charcoalLight }}>
                          {lead.siteAddress || "—"}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "14px", color: COLORS.charcoalLight }}>
                          {lead.structureType}
                          {(lead.length || lead.width) && (
                            <div style={{ fontSize: "12px", color: COLORS.steel }}>
                              {lead.length}×{lead.width}
                              {lead.height && `×${lead.height}`}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: "13px",
                            color: COLORS.charcoalLight,
                          }}
                        >
                          {lead.quoteNo || "—"}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "13px", color: COLORS.steel }}>
                          {lead.date}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={lead.status} />
                            <SyncBadge
                              status={lead.syncStatus}
                              error={lead.syncError}
                              compact
                            />
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }} onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button
                              onClick={() => onOpen(lead.id)}
                              style={{
                                padding: "6px",
                                background: "transparent",
                                border: `1px solid ${COLORS.border}`,
                                cursor: "pointer",
                                color: COLORS.charcoal,
                              }}
                              aria-label="Edit lead"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => confirmDelete(lead)}
                              style={{
                                padding: "6px",
                                background: "transparent",
                                border: `1px solid ${COLORS.border}`,
                                cursor: "pointer",
                                color: COLORS.red,
                              }}
                              aria-label="Delete lead"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          padding: "20px",
          textAlign: "center",
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.15em",
          color: COLORS.steel,
          textTransform: "uppercase",
        }}
      >
        {APP_NAME} · Development Build
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={(leads) => {
            onImport(leads);
            setShowImport(false);
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

const StatusBadge = ({ status }) => {
  const map = {
    New: { bg: `${COLORS.red}15`, fg: COLORS.red },
    Quoted: { bg: `${COLORS.steel}20`, fg: COLORS.steel },
    Won: { bg: `${COLORS.green}15`, fg: COLORS.green },
    Lost: { bg: `${COLORS.charcoalLight}20`, fg: COLORS.charcoalLight },
  };
  const s = map[status] || map.New;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        background: s.bg,
        color: s.fg,
        fontFamily: "'Oswald', sans-serif",
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
};

/* ---------- MOBILE EXPORT MENU (consolidated) ---------- */

function MobileExportMenu({ open, onClose, onJSON, onCSV, onSummary }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "60px",
          right: "12px",
          background: "#fff",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          minWidth: "200px",
        }}
      >
        {[
          { label: "JSON", icon: FileJson, action: onJSON },
          { label: "CSV", icon: FileSpreadsheet, action: onCSV },
          { label: "Summary", icon: Printer, action: onSummary },
        ].map((it) => (
          <button
            key={it.label}
            onClick={() => {
              it.action();
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "12px 16px",
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${COLORS.border}`,
              cursor: "pointer",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "14px",
              color: COLORS.charcoal,
              textAlign: "left",
            }}
          >
            <it.icon size={16} style={{ color: COLORS.red }} />
            Export as {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- LEAD FORM ---------- */

function LeadForm({ initial, onSave, onCancel, onDelete, notify, requestConfirm, saving }) {
  const [lead, setLead] = useState(initial);
  const [exportView, setExportView] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState([]);
  const [dirty, setDirty] = useState(false);

  const up = (k, v) => {
    setLead((p) => ({ ...p, [k]: v }));
    setDirty(true);
    if (fieldErrors.length) setFieldErrors([]);
  };

  const toggleWorkScope = (item) => {
    setLead((p) => ({
      ...p,
      workScope: p.workScope.includes(item)
        ? p.workScope.filter((i) => i !== item)
        : [...p.workScope, item],
    }));
    setDirty(true);
  };

  const updateMaterial = (id, key, val) => {
    setLead((p) => ({
      ...p,
      materials: p.materials.map((m) => (m.id === id ? { ...m, [key]: val } : m)),
    }));
    setDirty(true);
  };

  const addMaterial = () => {
    setLead((p) => ({
      ...p,
      materials: [
        ...p.materials,
        { id: `m_${Date.now()}`, description: "", size: "", qty: "", material: "" },
      ],
    }));
    setDirty(true);
  };

  const removeMaterial = (id) => {
    setLead((p) => ({ ...p, materials: p.materials.filter((m) => m.id !== id) }));
    setDirty(true);
  };

  const handleSave = () => {
    const errors = validateLead(lead);
    if (errors.length) {
      setFieldErrors(errors);
      notify(errors[0], "error");
      // Scroll the client section into view
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const updated = { ...lead, updatedAt: new Date().toISOString() };
    setLead(updated);
    setDirty(false);
    onSave(updated);
  };

  const handleCancel = () => {
    if (!dirty) {
      onCancel();
      return;
    }
    requestConfirm({
      title: "Discard Changes?",
      message: "You have unsaved changes. Leave without saving?",
      confirmLabel: "Discard",
      destructive: true,
      onConfirm: onCancel,
    });
  };

  const handleDeleteClick = () => {
    requestConfirm({
      title: "Delete Lead",
      message: "Delete this lead permanently? This can't be undone locally.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: onDelete,
    });
  };

  const nameSafe = (lead.clientName || "lead").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  const openJSON = () =>
    setExportView({
      title: "Export JSON",
      content: buildLeadJSON(lead),
      filename: `shedboss-enquiry-lead-${nameSafe}.json`,
      mimeType: "application/json",
    });
  const openCSV = () =>
    setExportView({
      title: "Export CSV",
      content: buildLeadCSV(lead),
      filename: `shedboss-enquiry-lead-${nameSafe}.csv`,
      mimeType: "text/csv",
    });
  const openSummary = () =>
    setExportView({
      title: "Printable Summary",
      content: buildLeadSummary(lead),
      filename: `shedboss-enquiry-lead-${nameSafe}.txt`,
      mimeType: "text/plain",
    });

  const clientNameInvalid = fieldErrors.some((e) => e.toLowerCase().includes("client name"));
  const emailInvalid = fieldErrors.some((e) => e.toLowerCase().includes("email"));

  return (
    <div style={{ minHeight: "100vh", background: COLORS.paper }}>
      <div
        style={{
          background: "#fff",
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "12px 16px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                background: "transparent",
                border: `1px solid ${COLORS.border}`,
                cursor: "pointer",
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "13px",
                color: COLORS.charcoal,
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div className="hidden sm:block">
              <ShedBossLogo size={30} />
            </div>
            {dirty && (
              <span
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "11px",
                  color: COLORS.amber,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                • Unsaved
              </span>
            )}
            <SyncBadge status={lead.syncStatus} error={lead.syncError} />
          </div>

          {/* Desktop toolbar */}
          <div className="hidden md:flex gap-2 flex-wrap items-center">
            <Button variant="outline" onClick={openCSV} style={{ padding: "8px 12px" }}>
              <FileSpreadsheet size={14} /> CSV
            </Button>
            <Button variant="outline" onClick={openJSON} style={{ padding: "8px 12px" }}>
              <FileJson size={14} /> JSON
            </Button>
            <Button variant="outline" onClick={openSummary} style={{ padding: "8px 12px" }}>
              <Printer size={14} /> Summary
            </Button>
            {onDelete && (
              <Button
                variant="danger"
                style={{ padding: "8px 12px" }}
                onClick={handleDeleteClick}
              >
                <Trash2 size={14} />
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "8px 14px" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>

          {/* Mobile toolbar */}
          <div className="flex md:hidden gap-2 items-center">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              style={{
                padding: "8px 10px",
                background: "#fff",
                border: `1px solid ${COLORS.border}`,
                cursor: "pointer",
                color: COLORS.charcoal,
              }}
              aria-label="Export menu"
            >
              <MoreVertical size={16} />
            </button>
            {onDelete && (
              <Button
                variant="danger"
                style={{ padding: "8px 10px" }}
                onClick={handleDeleteClick}
              >
                <Trash2 size={14} />
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "8px 12px" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "…" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <MobileExportMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onJSON={openJSON}
        onCSV={openCSV}
        onSummary={openSummary}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* Banner */}
        <div
          style={{
            background: COLORS.charcoal,
            padding: "20px 24px",
            marginBottom: "24px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-40px",
              top: "-40px",
              width: "160px",
              height: "160px",
              background: COLORS.red,
              transform: "rotate(45deg)",
              opacity: 0.15,
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "11px",
                letterSpacing: "0.25em",
                color: COLORS.red,
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              {APP_NAME}
            </div>
            <h1
              style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: "clamp(22px, 5vw, 32px)",
                fontWeight: 600,
                color: "#fff",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1.1,
              }}
            >
              Qualification Lead Sheet
            </h1>
            <p
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "13px",
                color: COLORS.steelLight,
                marginTop: "8px",
                fontStyle: "italic",
                lineHeight: 1.4,
              }}
            >
              Thank you for your call, just so I can help you best would it be OK if I asked you a
              couple of questions?
            </p>
          </div>
        </div>

        {/* Validation errors banner */}
        {fieldErrors.length > 0 && (
          <div
            style={{
              background: `${COLORS.red}10`,
              border: `1px solid ${COLORS.red}40`,
              padding: "12px 14px",
              marginBottom: "20px",
              borderLeft: `4px solid ${COLORS.red}`,
            }}
          >
            <div
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                color: COLORS.red,
                marginBottom: "4px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <AlertCircle size={14} /> Please fix before saving:
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "22px",
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "13px",
                color: COLORS.charcoal,
              }}
            >
              {fieldErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div>
            <Label>Date</Label>
            <Input type="date" value={lead.date} onChange={(e) => up("date", e.target.value)} />
          </div>
          <div>
            <Label>Quote Prepared By</Label>
            <Input
              value={lead.quotePreparedBy}
              onChange={(e) => up("quotePreparedBy", e.target.value)}
              placeholder="Staff member"
            />
          </div>
          <div>
            <Label>Quote No</Label>
            <Input
              value={lead.quoteNo}
              onChange={(e) => up("quoteNo", e.target.value)}
              placeholder="e.g. Q-2026-0142"
            />
          </div>
        </div>

        <SectionHeader icon={User} title="Client Details" subtitle="Contact & property information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="sm:col-span-2">
            <Label required>Client Name/s</Label>
            <Input
              value={lead.clientName}
              onChange={(e) => up("clientName", e.target.value)}
              placeholder="Full name(s)"
              invalid={clientNameInvalid}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={lead.phone} onChange={(e) => up("phone", e.target.value)} />
          </div>
          <div>
            <Label>Mobile</Label>
            <Input value={lead.mobile} onChange={(e) => up("mobile", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={lead.email}
              onChange={(e) => up("email", e.target.value)}
              invalid={emailInvalid}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Site Address</Label>
            <Input
              value={lead.siteAddress}
              onChange={(e) => up("siteAddress", e.target.value)}
              placeholder="Where the shed is being built"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <Label className="mb-0">Postal Address</Label>
              <Checkbox
                checked={lead.postalAsAbove}
                onChange={(e) => up("postalAsAbove", e.target.checked)}
                label="Same as site address"
              />
            </div>
            <Input
              value={lead.postalAsAbove ? "" : lead.postalAddress}
              onChange={(e) => up("postalAddress", e.target.value)}
              disabled={lead.postalAsAbove}
              placeholder={lead.postalAsAbove ? "— same as site address —" : ""}
              style={lead.postalAsAbove ? { background: COLORS.offWhite } : {}}
            />
          </div>
          <div>
            <Label>Property Owner</Label>
            <div className="flex gap-4 pt-2">
              <Radio
                name="owner"
                checked={lead.propertyOwner === "Yes"}
                onChange={() => up("propertyOwner", "Yes")}
                label="Yes"
              />
              <Radio
                name="owner"
                checked={lead.propertyOwner === "No"}
                onChange={() => up("propertyOwner", "No")}
                label="No"
              />
            </div>
          </div>
          <div>
            <Label>Send Quote By</Label>
            <div className="flex gap-4 pt-2">
              <Radio
                name="send"
                checked={lead.sendQuoteBy === "Email"}
                onChange={() => up("sendQuoteBy", "Email")}
                label="Email"
              />
              <Radio
                name="send"
                checked={lead.sendQuoteBy === "Post"}
                onChange={() => up("sendQuoteBy", "Post")}
                label="Post"
              />
            </div>
          </div>
        </div>

        <div className="mt-10">
          <SectionHeader icon={Ruler} title="Shed Details" subtitle="Size, design, and purpose" />

          <div className="mb-4">
            <Label>Structure Type</Label>
            <Select value={lead.structureType} onChange={(e) => up("structureType", e.target.value)}>
              <option>Shed</option>
              <option>Carport</option>
              <option>Awning</option>
              <option>Shed & Awning</option>
              <option>Garage</option>
              <option>Workshop</option>
              <option>Barn</option>
              <option>Patio</option>
              <option>Commercial</option>
              <option>Other</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <Label>Length</Label>
              <Input value={lead.length} onChange={(e) => up("length", e.target.value)} placeholder="12m" />
            </div>
            <div>
              <Label>Width</Label>
              <Input value={lead.width} onChange={(e) => up("width", e.target.value)} placeholder="7m" />
            </div>
            <div>
              <Label>Height</Label>
              <Input value={lead.height} onChange={(e) => up("height", e.target.value)} placeholder="3m" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <Label>Design (Roof Type)</Label>
              <div className="flex gap-4 pt-2 flex-wrap">
                <Radio
                  name="design"
                  checked={lead.design === "Gable Roof"}
                  onChange={() => up("design", "Gable Roof")}
                  label="Gable Roof"
                />
                <Radio
                  name="design"
                  checked={lead.design === "Skillion Roof"}
                  onChange={() => up("design", "Skillion Roof")}
                  label="Skillion Roof"
                />
              </div>
            </div>
            <div>
              <Label>Time Frame</Label>
              <Input
                value={lead.timeFrame}
                onChange={(e) => up("timeFrame", e.target.value)}
                placeholder="When do they want it completed?"
              />
            </div>
          </div>

          <div className="mb-4">
            <Label>Purpose</Label>
            <Textarea
              value={lead.purpose}
              onChange={(e) => up("purpose", e.target.value)}
              placeholder="What will they be using the shed/carport/awning for?"
            />
          </div>

          <div className="mb-4">
            <Label>How Did They Hear About Us?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {MARKETING_SOURCES.map((src) => (
                <Radio
                  key={src}
                  name="marketing"
                  checked={lead.marketingSource === src}
                  onChange={() => up("marketingSource", src)}
                  label={src}
                />
              ))}
            </div>
            {lead.marketingSource === "Other" && (
              <Input
                value={lead.marketingOther}
                onChange={(e) => up("marketingOther", e.target.value)}
                placeholder="Please specify..."
                style={{ marginTop: "10px" }}
              />
            )}
          </div>
        </div>

        <div className="mt-10">
          <SectionHeader icon={MapPin} title="Site Details" subtitle="Access, utilities, constraints" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <Label>Access</Label>
              <Input value={lead.access} onChange={(e) => up("access", e.target.value)} />
            </div>
            <div>
              <Label>Level</Label>
              <Input value={lead.level} onChange={(e) => up("level", e.target.value)} />
            </div>
            <div>
              <Label>Power</Label>
              <Input value={lead.power} onChange={(e) => up("power", e.target.value)} />
            </div>
            <div>
              <Label>Water</Label>
              <Input value={lead.water} onChange={(e) => up("water", e.target.value)} />
            </div>
            <div>
              <Label>Sewer / Septic</Label>
              <Input value={lead.sewerSeptic} onChange={(e) => up("sewerSeptic", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <Label>Sheets — Roof</Label>
              <div className="flex gap-4 pt-2 flex-wrap">
                <Radio
                  name="sheetsRoof"
                  checked={lead.sheetsRoof === "Monoclad"}
                  onChange={() => up("sheetsRoof", "Monoclad")}
                  label="Monoclad"
                />
                <Radio
                  name="sheetsRoof"
                  checked={lead.sheetsRoof === "Corrugated"}
                  onChange={() => up("sheetsRoof", "Corrugated")}
                  label="Corrugated"
                />
              </div>
            </div>
            <div>
              <Label>Sheets — Walls</Label>
              <div className="flex gap-4 pt-2 flex-wrap">
                <Radio
                  name="sheetsWalls"
                  checked={lead.sheetsWalls === "Monoclad"}
                  onChange={() => up("sheetsWalls", "Monoclad")}
                  label="Monoclad"
                />
                <Radio
                  name="sheetsWalls"
                  checked={lead.sheetsWalls === "Corrugated"}
                  onChange={() => up("sheetsWalls", "Corrugated")}
                  label="Corrugated"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <Label>Site Hazards / Features</Label>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              <Checkbox
                checked={lead.overheadPower}
                onChange={(e) => up("overheadPower", e.target.checked)}
                label="Overhead Power"
              />
              <Checkbox
                checked={lead.trees}
                onChange={(e) => up("trees", e.target.checked)}
                label="Trees"
              />
              <Checkbox
                checked={lead.stormwater}
                onChange={(e) => up("stormwater", e.target.checked)}
                label="Stormwater"
              />
            </div>
          </div>

          <div>
            <Label>Boundary Issues / Notes</Label>
            <Textarea
              value={lead.boundaryNotes}
              onChange={(e) => up("boundaryNotes", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-10">
          <SectionHeader icon={FileText} title="Notes" />
          <Textarea
            value={lead.notes}
            onChange={(e) => up("notes", e.target.value)}
            placeholder="Additional info, appointment details, client requests..."
            style={{ minHeight: "120px" }}
          />
        </div>

        <div className="mt-10">
          <SectionHeader icon={Hammer} title="Quote Type & Scope" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label>Quote Type</Label>
              <div className="flex flex-col gap-2 pt-2">
                <Checkbox
                  checked={lead.fullBuildQuote}
                  onChange={(e) => up("fullBuildQuote", e.target.checked)}
                  label="Full Build Quote"
                />
                <Checkbox
                  checked={lead.kitOnlyQuote}
                  onChange={(e) => up("kitOnlyQuote", e.target.checked)}
                  label="Kit Only Quote"
                />
              </div>
            </div>
            <div>
              <Label>Work Scope (select all that apply)</Label>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {WORK_SCOPE.map((item) => (
                  <Checkbox
                    key={item}
                    checked={lead.workScope.includes(item)}
                    onChange={() => toggleWorkScope(item)}
                    label={item}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <SectionHeader
            icon={Ruler}
            title="Materials & Specifications"
            subtitle="Add or remove items as required"
          />
          <div
            style={{
              background: "#fff",
              border: `1px solid ${COLORS.border}`,
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", minWidth: "520px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.charcoal }}>
                  {["Description", "Size", "Qty", "Colorbond / Zinc", ""].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: "11px",
                        fontWeight: 500,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#fff",
                        width: i === 4 ? "40px" : i === 2 ? "70px" : i === 1 ? "140px" : "auto",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lead.materials.map((m, idx) => (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: `1px solid ${COLORS.border}`,
                      background: idx % 2 === 0 ? "#fff" : COLORS.paper,
                    }}
                  >
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        value={m.description}
                        onChange={(e) => updateMaterial(m.id, "description", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          padding: "6px 4px",
                          fontSize: "14px",
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          color: COLORS.charcoal,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        value={m.size}
                        onChange={(e) => updateMaterial(m.id, "size", e.target.value)}
                        placeholder="—"
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          padding: "6px 4px",
                          fontSize: "13px",
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: COLORS.charcoalLight,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        value={m.qty}
                        onChange={(e) => updateMaterial(m.id, "qty", e.target.value)}
                        placeholder="—"
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          padding: "6px 4px",
                          fontSize: "14px",
                          textAlign: "center",
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          color: COLORS.charcoal,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <select
                        value={m.material}
                        onChange={(e) => updateMaterial(m.id, "material", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          padding: "6px 4px",
                          fontSize: "14px",
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          color: COLORS.charcoal,
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">—</option>
                        <option>Colorbond</option>
                        <option>Zinc</option>
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <button
                        onClick={() => removeMaterial(m.id)}
                        title="Remove row"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: COLORS.steelLight,
                          padding: "4px",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              style={{
                padding: "10px 12px",
                background: "#fff",
                borderTop: `1px solid ${COLORS.border}`,
              }}
            >
              <button
                onClick={addMaterial}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "transparent",
                  border: `1px dashed ${COLORS.steelLight}`,
                  padding: "8px 14px",
                  fontSize: "12px",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.steel,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} /> Add Material Row
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <SectionHeader icon={CheckCircle2} title="Lead Status" />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {["New", "Quoted", "Won", "Lost"].map((s) => (
              <Radio
                key={s}
                name="status"
                checked={lead.status === s}
                onChange={() => up("status", s)}
                label={s}
              />
            ))}
          </div>
        </div>

        <div className="mt-12 flex justify-end gap-2 flex-wrap">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save Lead"}
          </Button>
        </div>
      </div>

      {exportView && (
        <ExportModal
          title={exportView.title}
          content={exportView.content}
          filename={exportView.filename}
          mimeType={exportView.mimeType}
          onClose={() => setExportView(null)}
          notify={notify}
        />
      )}
    </div>
  );
}

/* ---------- ROOT ---------- */

export default function ShedBossEnquiryLead() {
  const [view, setView] = useState("dashboard");
  const [leads, setLeads] = useState([]);
  const [activeLead, setActiveLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [exportAllView, setExportAllView] = useState(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [confirmState, setConfirmState] = useState(null);
  const [saving, setSaving] = useState(false);

  /* Airtable state */
  const [config, setConfig] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const toastTimeoutRef = useRef(null);
  // Refs keep dual-write handlers referencing latest state without re-binding.
  const leadsRef = useRef(leads);
  const configRef = useRef(config);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const notify = (msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToast({ msg, type, id });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 2800);
  };

  const requestConfirm = (cfg) => setConfirmState(cfg);
  const handleConfirm = () => {
    if (confirmState?.onConfirm) confirmState.onConfirm();
    setConfirmState(null);
  };
  const handleCancelConfirm = () => {
    if (confirmState?.onCancel) confirmState.onCancel();
    setConfirmState(null);
  };

  /* -------- Derived sync summary -------- */
  const syncSummary = useMemo(() => {
    const sum = { total: leads.length, synced: 0, syncing: 0, error: 0, local: 0, errors: 0 };
    for (const l of leads) {
      const s = l.syncStatus || "local";
      sum[s] = (sum[s] || 0) + 1;
    }
    sum.errors = sum.error || 0;
    return sum;
  }, [leads]);

  /* -------- Persist helpers -------- */

  const persistIndex = async (newLeads) => {
    const r = await safeStorageSet(INDEX_KEY, JSON.stringify(newLeads.map((l) => l.id)));
    if (!r.ok) setStorageAvailable(false);
  };

  // Updates one lead in state + storage without side-effects.
  const persistLead = async (lead) => {
    const r = await safeStorageSet(STORAGE_KEY_PREFIX + lead.id, JSON.stringify(lead));
    if (!r.ok) setStorageAvailable(false);
    return r.ok;
  };

  /* -------- Merge local + remote on initial load -------- */

  const mergeLocalAndRemote = (localLeads, remoteLeads) => {
    const remoteByAtId = new Map();
    const remoteByShedId = new Map();
    for (const r of remoteLeads) {
      if (r.airtableRecordId) remoteByAtId.set(r.airtableRecordId, r);
      if (r.id) remoteByShedId.set(r.id, r);
    }

    const usedRemoteIds = new Set();
    const merged = [];

    for (const local of localLeads) {
      let remote = null;
      if (local.airtableRecordId && remoteByAtId.has(local.airtableRecordId)) {
        remote = remoteByAtId.get(local.airtableRecordId);
      } else if (remoteByShedId.has(local.id)) {
        remote = remoteByShedId.get(local.id);
      }

      if (remote) {
        usedRemoteIds.add(remote.airtableRecordId);
        if (local.syncStatus === "synced") {
          // Remote is authoritative for synced records (last-write-wins still favours Airtable here).
          merged.push({ ...remote, id: local.id });
        } else {
          // Unsynced local changes — keep local, attach the Airtable record id we now know.
          merged.push({ ...local, airtableRecordId: remote.airtableRecordId });
        }
      } else {
        if (local.syncStatus === "synced" && local.airtableRecordId) {
          // Was synced but remote is gone → deleted externally. Surface as error.
          merged.push({
            ...local,
            airtableRecordId: null,
            syncStatus: "error",
            syncError: "Remote record no longer exists in Airtable",
          });
        } else {
          merged.push(local);
        }
      }
    }

    for (const remote of remoteLeads) {
      if (usedRemoteIds.has(remote.airtableRecordId)) continue;
      merged.push(remote);
    }

    return merged;
  };

  /* -------- Mount: migrate → load local → load config → pull Airtable -------- */

  useEffect(() => {
    (async () => {
      // Legacy key migration (unchanged)
      const newIdx = await safeStorageGet(INDEX_KEY);
      const hasNewData = newIdx.ok && newIdx.value;
      if (!hasNewData) {
        for (const legacy of LEGACY_KEYS) {
          const legacyIdx = await safeStorageGet(legacy.index);
          if (!legacyIdx.ok || !legacyIdx.value) continue;
          try {
            const legacyIds = JSON.parse(legacyIdx.value);
            const migratedIds = [];
            for (const id of legacyIds) {
              const r = await safeStorageGet(legacy.prefix + id);
              if (r.ok && r.value) {
                await safeStorageSet(STORAGE_KEY_PREFIX + id, r.value);
                await safeStorageDelete(legacy.prefix + id);
                migratedIds.push(id);
              }
            }
            if (migratedIds.length > 0) {
              await safeStorageSet(INDEX_KEY, JSON.stringify(migratedIds));
              await safeStorageDelete(legacy.index);
              break;
            }
          } catch (e) {
            console.warn("Legacy migration skipped", e);
          }
        }
      }

      // Load config
      let loadedConfig = null;
      const cfgResult = await safeStorageGet(CONFIG_KEY);
      if (cfgResult.ok && cfgResult.value) {
        try {
          loadedConfig = JSON.parse(cfgResult.value);
        } catch (e) {
          console.warn("Corrupt config — ignoring");
        }
      }
      setConfig(loadedConfig);

      // Load local leads
      const idxResult = await safeStorageGet(INDEX_KEY);
      if (!idxResult.ok) {
        setStorageAvailable(false);
        setLoading(false);
        return;
      }
      const ids = idxResult.value ? JSON.parse(idxResult.value) : [];
      const localLeads = [];
      for (const id of ids) {
        const r = await safeStorageGet(STORAGE_KEY_PREFIX + id);
        if (r.ok && r.value) {
          try {
            localLeads.push(normaliseLead(JSON.parse(r.value)));
          } catch {}
        }
      }

      // If configured, pull remote and merge
      if (isConfigured(loadedConfig)) {
        try {
          const records = await airtable.listRecords(loadedConfig);
          const remoteLeads = records.map(fromAirtable);
          const merged = mergeLocalAndRemote(localLeads, remoteLeads);
          setLeads(merged);
          // Persist the merged state so next boot starts consistent.
          await persistIndex(merged);
          for (const m of merged) {
            await persistLead(m);
          }
        } catch (e) {
          console.error("Initial Airtable load failed", e);
          setLeads(localLeads);
          notify(`Couldn't fetch from Airtable: ${friendlyAirtableError(e)}`, "error");
        }
      } else {
        setLeads(localLeads);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- Settings save/disconnect -------- */

  const handleConfigSave = async (newConfig) => {
    const r = await safeStorageSet(CONFIG_KEY, JSON.stringify(newConfig));
    if (!r.ok) {
      notify("Could not persist config to device storage", "error");
      return;
    }
    setConfig(newConfig);
    setShowSettings(false);
    notify("Connected to Airtable", "success");

    // Pull fresh remote records and merge.
    try {
      const records = await airtable.listRecords(newConfig);
      const remoteLeads = records.map(fromAirtable);
      const merged = mergeLocalAndRemote(leadsRef.current, remoteLeads);
      setLeads(merged);
      await persistIndex(merged);
      for (const m of merged) {
        await persistLead(m);
      }
      notify(`Merged ${remoteLeads.length} record${remoteLeads.length === 1 ? "" : "s"} from Airtable`, "success");
    } catch (e) {
      notify(`Initial fetch failed: ${friendlyAirtableError(e)}`, "error");
    }
  };

  const handleDisconnect = async () => {
    await safeStorageDelete(CONFIG_KEY);
    setConfig(null);
    setShowSettings(false);
    // Mark all synced leads as local — they're no longer tracked remotely from this device.
    const newLeads = leadsRef.current.map((l) =>
      l.syncStatus === "synced"
        ? { ...l, syncStatus: "local", syncError: null, lastSyncAt: null }
        : l
    );
    setLeads(newLeads);
    for (const l of newLeads) {
      await persistLead(l);
    }
    notify("Disconnected from Airtable. Leads remain on this device.", "info");
  };

  /* -------- Dual-write save -------- */

  // Returns { ok, lead (final version persisted) }
  const writeToAirtable = async (lead, cfg) => {
    const fields = toAirtable(lead);
    let result;
    if (lead.airtableRecordId) {
      result = await airtable.updateRecord(cfg, lead.airtableRecordId, fields);
    } else {
      result = await airtable.createRecord(cfg, fields);
    }
    return {
      ...lead,
      airtableRecordId: result.id || lead.airtableRecordId,
      syncStatus: "synced",
      syncError: null,
      lastSyncAt: new Date().toISOString(),
    };
  };

  const handleNew = () => {
    setActiveLead(emptyLead());
    setView("form");
  };

  const handleOpen = (id) => {
    const l = leadsRef.current.find((x) => x.id === id);
    if (l) {
      setActiveLead(l);
      setView("form");
    }
  };

  // Core save — writes locally first (always succeeds if storage works),
  // then attempts Airtable if configured. Airtable failure → syncStatus='error' but lead is safe.
  const handleSaveLead = async (updated) => {
    setSaving(true);
    const existing = leadsRef.current.find((l) => l.id === updated.id);
    const cfg = configRef.current;
    const willSync = isConfigured(cfg);

    // Optimistic: mark syncing (or local if no config) before the write attempt.
    const optimistic = {
      ...updated,
      syncStatus: willSync ? "syncing" : "local",
      syncError: null,
    };

    const stateAfterOptimistic = existing
      ? leadsRef.current.map((l) => (l.id === optimistic.id ? optimistic : l))
      : [...leadsRef.current, optimistic];
    setLeads(stateAfterOptimistic);
    setActiveLead(optimistic);

    const localSave = await persistLead(optimistic);
    if (!existing) await persistIndex(stateAfterOptimistic);

    if (!localSave) {
      setSaving(false);
      notify("Saved in session only (device storage unavailable)", "warn");
      // Continue to Airtable anyway — cloud save still valuable.
    }

    // Attempt Airtable
    let finalLead = optimistic;
    if (willSync) {
      try {
        finalLead = await writeToAirtable(optimistic, cfg);
      } catch (e) {
        finalLead = {
          ...optimistic,
          syncStatus: "error",
          syncError: friendlyAirtableError(e),
        };
        notify(`Airtable sync failed: ${finalLead.syncError}`, "error");
      }
    }

    const finalState = leadsRef.current.map((l) => (l.id === finalLead.id ? finalLead : l));
    setLeads(finalState);
    setActiveLead(finalLead);
    await persistLead(finalLead);

    setSaving(false);

    if (finalLead.syncStatus === "synced") {
      notify(existing ? "Saved & synced" : "Created & synced", "success");
    } else if (finalLead.syncStatus === "local") {
      notify(existing ? "Saved locally" : "Created locally", "success");
    }
    // 'error' case already toasted above
  };

  /* -------- Delete -------- */

  const handleDeleteLead = async (id) => {
    const lead = leadsRef.current.find((l) => l.id === id);
    const cfg = configRef.current;

    // Airtable delete first if applicable — if it fails, surface and let user retry.
    if (lead?.airtableRecordId && isConfigured(cfg)) {
      try {
        await airtable.deleteRecord(cfg, lead.airtableRecordId);
      } catch (e) {
        const msg = friendlyAirtableError(e);
        // Mark as error and stop — don't delete local so user can retry.
        const newLeads = leadsRef.current.map((l) =>
          l.id === id ? { ...l, syncStatus: "error", syncError: `Delete failed: ${msg}` } : l
        );
        setLeads(newLeads);
        const updatedLead = newLeads.find((l) => l.id === id);
        if (updatedLead) await persistLead(updatedLead);
        notify(`Airtable delete failed: ${msg}. Lead kept locally — retry later.`, "error");
        return;
      }
    }

    const newLeads = leadsRef.current.filter((l) => l.id !== id);
    setLeads(newLeads);
    if (activeLead?.id === id) {
      setActiveLead(null);
      setView("dashboard");
    }
    await safeStorageDelete(STORAGE_KEY_PREFIX + id);
    await persistIndex(newLeads);
    notify("Lead deleted", "info");
  };

  /* -------- Sync all errored/local leads -------- */

  const handleSyncAll = async () => {
    const cfg = configRef.current;
    if (!isConfigured(cfg)) {
      notify("Connect to Airtable first", "warn");
      return;
    }
    const needsSync = leadsRef.current.filter(
      (l) => l.syncStatus === "error" || l.syncStatus === "local"
    );
    if (needsSync.length === 0) {
      notify("Nothing to sync", "info");
      return;
    }

    setSyncingAll(true);
    notify(`Syncing ${needsSync.length} lead${needsSync.length === 1 ? "" : "s"}…`, "info");

    let okCount = 0;
    let failCount = 0;

    for (const lead of needsSync) {
      // Mark syncing
      const working = { ...lead, syncStatus: "syncing", syncError: null };
      setLeads((prev) => prev.map((l) => (l.id === working.id ? working : l)));
      await persistLead(working);

      try {
        const synced = await writeToAirtable(working, cfg);
        setLeads((prev) => prev.map((l) => (l.id === synced.id ? synced : l)));
        await persistLead(synced);
        okCount += 1;
      } catch (e) {
        const errored = {
          ...working,
          syncStatus: "error",
          syncError: friendlyAirtableError(e),
        };
        setLeads((prev) => prev.map((l) => (l.id === errored.id ? errored : l)));
        await persistLead(errored);
        failCount += 1;
      }
    }

    setSyncingAll(false);
    if (failCount === 0) {
      notify(`Synced ${okCount} lead${okCount === 1 ? "" : "s"}`, "success");
    } else {
      notify(`Synced ${okCount}, ${failCount} failed`, "warn");
    }
  };

  /* -------- Import -------- */

  const handleImport = async (imported) => {
    const newLeads = [...leadsRef.current];
    for (const lead of imported) {
      if (newLeads.some((l) => l.id === lead.id)) {
        lead.id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      // Imports start as 'local' — let user sync them explicitly via save or sync-all.
      // (Preserving airtableRecordId from a JSON backup could create cross-base confusion.)
      lead.airtableRecordId = null;
      lead.syncStatus = "local";
      lead.syncError = null;
      lead.lastSyncAt = null;
      newLeads.push(lead);
      await persistLead(lead);
    }
    setLeads(newLeads);
    await persistIndex(newLeads);

    if (imported.length === 1) {
      setActiveLead(imported[0]);
      setView("form");
    }
  };

  const handleExportAll = () => {
    if (leads.length === 0) {
      notify("No leads to export", "warn");
      return;
    }
    setExportAllView({
      title: `Export All Leads (${leads.length})`,
      content: JSON.stringify(leads, null, 2),
      filename: `shedboss-enquiry-lead-all-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: "application/json",
    });
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.paper,
          fontFamily: "'Oswald', sans-serif",
          color: COLORS.steel,
          letterSpacing: "0.2em",
          fontSize: "14px",
          textTransform: "uppercase",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <Loader2 size={28} className="animate-spin" style={{ color: COLORS.red }} />
        Loading…
      </div>
    );
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
      />
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
        {!storageAvailable && (
          <div
            style={{
              background: COLORS.amberBg,
              color: COLORS.amber,
              padding: "8px 16px",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "12px",
              textAlign: "center",
              borderBottom: "1px solid #FCD34D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <AlertTriangle size={14} /> Device storage unavailable — leads kept in this session only. Export regularly to back up.
          </div>
        )}

        {view === "dashboard" && (
          <Dashboard
            leads={leads}
            onNew={handleNew}
            onOpen={handleOpen}
            onDelete={handleDeleteLead}
            onExportAll={handleExportAll}
            onImport={handleImport}
            notify={notify}
            requestConfirm={requestConfirm}
            config={config}
            syncSummary={syncSummary}
            onOpenSettings={() => setShowSettings(true)}
            onSyncAll={handleSyncAll}
          />
        )}
        {view === "form" && activeLead && (
          <LeadForm
            initial={activeLead}
            onSave={handleSaveLead}
            onCancel={() => setView("dashboard")}
            onDelete={
              leads.some((l) => l.id === activeLead.id)
                ? () => handleDeleteLead(activeLead.id)
                : null
            }
            notify={notify}
            requestConfirm={requestConfirm}
            saving={saving || syncingAll}
          />
        )}

        {showSettings && (
          <SettingsModal
            initialConfig={config}
            onClose={() => setShowSettings(false)}
            onSave={handleConfigSave}
            onDisconnect={handleDisconnect}
            notify={notify}
          />
        )}

        {exportAllView && (
          <ExportModal
            title={exportAllView.title}
            content={exportAllView.content}
            filename={exportAllView.filename}
            mimeType={exportAllView.mimeType}
            onClose={() => setExportAllView(null)}
            notify={notify}
          />
        )}

        {confirmState && (
          <ConfirmModal
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.confirmLabel}
            cancelLabel={confirmState.cancelLabel}
            destructive={confirmState.destructive}
            onConfirm={handleConfirm}
            onCancel={handleCancelConfirm}
          />
        )}

        <Toast toast={toast} />
      </div>
    </>
  );
}
