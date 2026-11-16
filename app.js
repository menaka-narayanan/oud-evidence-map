/*
  OUD Policy Evidence Map — page logic.
  Reads the sheet (as CSV), cleans it with the vocabulary in config.js, and draws the map, figures and study list.
  No build step: edit this file and reload.
*/
(function () {
"use strict";
const SITE = window.SITE || {}, V = window.VOCAB || {};

/* ---------- vocabulary from config.js ---------- */
const POLICY_ALIAS = V.policyAlias || {}, OUTCOME_ALIAS = V.outcomeAlias || {}, POP_ALIAS = V.populationAlias || {}, DRUG_ALIAS = V.drugAlias || {};
const DRUG_SKIP = new Set(V.drugSkip || []);
const POLICY_GROUPS = V.policyGroups || [], OUTCOMES = V.outcomeGroups || [];
const GROUP_OF = {}; POLICY_GROUPS.forEach(([g, ps]) => ps.forEach(p => GROUP_OF[p] = g));
const KNOWN_OUTCOMES = new Set(OUTCOMES.flatMap(([, os]) => os));
const TIERS = ["Experimental", "Quasi-experimental", "Observational", "Qualitative & mixed", "Review", "Not reported"];
const TIER_VAR = {"Experimental":"--t-exp","Quasi-experimental":"--t-quasi","Observational":"--t-obs","Qualitative & mixed":"--t-qual","Review":"--t-rev","Not reported":"--t-na"};
const TIER_RANK = Object.fromEntries(TIERS.map((t, i) => [t, i]));
const SIZE_ORDER = ["≤100", "101–500", "501–1,000", "1,001–10,000", ">10,000", "Not reported"];
const DUR_ORDER = ["Under 6 months", "6–12 months", "1–3 years", "3–5 years", "5–10 years", "Over 10 years", "Not reported"];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const NA = new Set(["", "n/a", "na", "none", "nan", "null", "-", "—", "none or unspecified", "unspecified"]);
const clean = v => { if (v == null) return null; const s = String(v).replace(/\s+/g, " ").trim(); return NA.has(s.toLowerCase()) ? null : s; };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const fmt = n => n.toLocaleString("en-US");
const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/* ---------- cleaning the sheet ---------- */
function normalize(text) {
  const parsed = Papa.parse(text, {header: true, skipEmptyLines: "greedy"});
  const H = (parsed.meta.fields || []).map(h => ({h, k: String(h).replace(/\s+/g, " ").trim().toLowerCase()}));
  const cache = {};
  const col = name => { if (name in cache) return cache[name]; const n = name.toLowerCase();
    const e = H.find(x => x.k === n) || H.find(x => x.k.startsWith(n)); return cache[name] = e ? e.h : null; };
  const get = (r, name) => { const c = col(name); return c ? clean(r[c]) : null; };
  const drugCols = H.filter(x => x.k.startsWith("clinical intervention") || /^intervention \d/.test(x.k)).map(x => x.h);
  const notes = [], studies = [], seen = new Map();
  const statusCol = SITE.onlyStatus ? col("Status") : null;

  parsed.data.forEach((r, i) => {
    const title = get(r, "Title"); if (!title) return;
    const rowNo = i + 2;
    if (statusCol && String(r[statusCol] || "").trim().toLowerCase() !== SITE.onlyStatus.toLowerCase()) return;
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) { notes.push({row: rowNo, note: "Duplicate of row " + seen.get(key) + "; counted once", title}); return; }
    seen.set(key, rowNo);
    const articleId = get(r, "Article ID");
    const id = articleId ? slug(articleId) : hash(key);

    const polText = get(r, "Policy Intervention Text") || "";
    let parts = (get(r, "Policy Intervention") || "").split(/[,;]/).map(clean).filter(Boolean);
    if (!parts.length && polText) parts = polText.split(/&/).map(clean).filter(Boolean);
    const policies = [];
    parts.forEach(p => { let c = POLICY_ALIAS[p.toLowerCase()] || p;
      if (c === "Medicaid Coverage" && /medicare/i.test(polText) && !/medicaid/i.test(polText)) c = "Medicare Coverage";
      if (!policies.includes(c)) policies.push(c); });
    if (!policies.length) notes.push({row: rowNo, note: "No policy intervention", title});

    const outcomes = [];
    ["Outcome 1", "Outcome 2", "Outcome 3", "Outcome 4"].forEach(n => { const v = get(r, n); if (!v) return;
      const c = OUTCOME_ALIAS[v.toLowerCase()] || cap(v); if (!outcomes.includes(c)) outcomes.push(c); });
    if (!outcomes.length) notes.push({row: rowNo, note: "No outcome", title});

    const designRaw = get(r, "Study Design"); const [design, tier] = designOf(designRaw);
    const yRaw = get(r, "Year"); const year = yRaw ? parseInt(yRaw, 10) || null : null;

    const pops = [];
    ["Population 1", "Population 2", "Population 3"].forEach(n => { const v = get(r, n); if (!v) return;
      v.split(/&|,/).map(clean).filter(Boolean).forEach(p => { const c = POP_ALIAS[p.toLowerCase()] || cap(p); if (!pops.includes(c)) pops.push(c); }); });

    const drugs = [];
    drugCols.forEach(c => { const v = clean(r[c]); if (!v) return; const lk = v.toLowerCase(); if (DRUG_SKIP.has(lk)) return;
      const d = DRUG_ALIAS[lk] || cap(v); if (!drugs.includes(d)) drugs.push(d); });

    const fundText = get(r, "Funding"), fundGroup = get(r, "Funding - Group");
    let link = get(r, "Link"); if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
    const findings = get(r, "Detailed Article Outcomes"), exposure = get(r, "Detailed Article Exposure");
    const groups = [...new Set(policies.map(p => GROUP_OF[p] || "Other policy"))];
    studies.push({
      id, rowNo, title, policies, groups, outcomes, design, designRaw, tier, year,
      gov: govOf(get(r, "Government Level")), scope: scopeOf(get(r, "Scope")), pops,
      size: sizeOf(get(r, "# Participants - Categorized"), get(r, "# Participants")), sizeRaw: get(r, "# Participants"),
      dur: durOf(get(r, "Study Duration - Categorized")), durRaw: get(r, "Study Duration"),
      fund: fundOf(fundGroup, fundText), fundText,
      nih: /\bNIDA\b|\bNIH\b|National Institutes? (of|on) (Health|Drug Abuse)/i.test(fundText || "") ? "Yes" : "No",
      drugs, cats: [...new Set((get(r, "Policy Category") || "").split(",").map(clean).filter(Boolean))],
      link, findings, exposure, journal: get(r, "Journal"), polText, specific: get(r, "Specific policy"), soe: get(r, "Strength of Evidence"),
      search: [title, findings, exposure, polText, get(r, "Specific policy"), get(r, "Journal"), policies.join(" ")].join(" ").toLowerCase()
    });
  });
  const missing = ["Title", "Policy Intervention", "Outcome 1", "Study Design", "Year"].filter(n => !col(n));
  return {studies, notes, missing};
}
function designOf(raw) {
  if (!raw) return ["Not reported", "Not reported"]; const s = raw.toLowerCase();
  if (/legal review|systematic legal|systemic legal/.test(s)) return ["Systematic legal review", "Review"];
  if (/systematic|scoping|review/.test(s)) return ["Systematic review", "Review"];
  if (/non-random/.test(s)) return ["Non-randomized controlled", "Quasi-experimental"];
  if (/random/.test(s)) return ["Randomized controlled trial", "Experimental"];
  if (/difference/.test(s)) return ["Difference-in-differences", "Quasi-experimental"];
  if (/interrupted|time.?series/.test(s)) return ["Interrupted time series", "Quasi-experimental"];
  if (/qualitative/.test(s)) return /cross|pre|&|,|mixed/.test(s.replace("qualitative", "")) ? ["Mixed methods", "Qualitative & mixed"] : ["Qualitative", "Qualitative & mixed"];
  if (/pre.?\/?.?post/.test(s)) return ["Pre-post", "Quasi-experimental"];
  if (/prospective/.test(s)) return ["Prospective cohort", "Observational"];
  if (/cross/.test(s)) return ["Cross-sectional", "Observational"];
  if (/cohort|retrospective/.test(s)) return ["Retrospective cohort", "Observational"];
  if (/longitudinal/.test(s)) return ["Longitudinal", "Observational"];
  if (/observational/.test(s)) return ["Observational (other)", "Observational"];
  return [cap(raw), "Not reported"];
}
function govOf(raw) { if (!raw) return "Not reported"; const s = raw.toLowerCase();
  if (/federal|national/.test(s)) return "Federal"; if (/state/.test(s)) return "State"; if (/local/.test(s)) return "Local"; return cap(raw); }
function scopeOf(raw) { if (!raw) return "Not reported"; const s = raw.toLowerCase().replace(/[\s-]/g, "");
  if (s.includes("national")) return "National"; if (s.includes("multistate")) return "Multi-state"; if (s.includes("statewide")) return "Statewide";
  if (s.includes("instate")) return "Within one state"; if (s.includes("local")) return "Local"; return cap(raw); }
function sizeOf(cat, raw) {
  const pick = s => { if (!s) return null; const t = s.toLowerCase().replace(/[,\s]/g, "");
    if (/>10000|10000\+|million/.test(t)) return ">10,000"; const nums = (t.match(/\d+(\.\d+)?/g) || []).map(Number); if (!nums.length) return null;
    const m = Math.max(...nums); if (m <= 100) return "≤100"; if (m <= 500) return "101–500"; if (m <= 1000) return "501–1,000"; if (m <= 10000) return "1,001–10,000"; return ">10,000"; };
  return pick(cat) || pick(raw) || "Not reported"; }
function durOf(raw) { if (!raw) return "Not reported"; const s = raw.toLowerCase().replace(/\s+/g, " ");
  if (/> ?10/.test(s)) return "Over 10 years"; if (/7\.5|>5 years|>5-/.test(s)) return "5–10 years"; if (/>3 years|>3-5|>3 to 5/.test(s)) return "3–5 years";
  if (/>2 years|>2-3|12 months to 2|>12/.test(s)) return "1–3 years"; if (/6 months to/.test(s)) return "6–12 months"; if (/month|week|day/.test(s)) return "Under 6 months"; return "Not reported"; }
function fundOf(g, text) { const s = ((g && g.length <= 45) ? g : (text || "")).toLowerCase();
  if (!s || /^none/.test(s)) return "None reported";
  const gov = /govern|national institute|centers for disease|nih|nida|cdc|ahrq|samhsa|department of/.test(s), ind = /industry|pharma|university|hospital/.test(s), fdn = /foundation|fund\b|arnold/.test(s);
  if (gov && (ind || fdn)) return "Mixed"; if (gov) return "Government"; if (fdn) return "Foundation"; if (ind) return "Industry & institutional"; return "Other"; }

/* ---------- filter state ---------- */
let STUDIES = [], ALL_POLICIES = [], YEARS = [];
const FACETS = [
  {key: "tier", label: "Study design", get: s => [s.tier], order: TIERS, swatch: true},
  {key: "design", label: "Design", get: s => [s.design], rail: false},
  {key: "grp", label: "Policy area", get: s => s.groups, rail: false},
  {key: "gov", label: "Government level", get: s => [s.gov], order: ["Federal", "State", "Local", "Not reported"]},
  {key: "scope", label: "Scope", get: s => [s.scope], order: ["National", "Multi-state", "Statewide", "Within one state", "Local", "Not reported"]},
  {key: "pop", label: "Population", get: s => s.pops, top: 8},
  {key: "size", label: "Participants", get: s => [s.size], order: SIZE_ORDER},
  {key: "dur", label: "Study duration", get: s => [s.dur], order: DUR_ORDER},
  {key: "fund", label: "Funding", get: s => [s.fund], order: ["Government", "Mixed", "Foundation", "Industry & institutional", "Other", "None reported"]},
  {key: "nih", label: "NIH / NIDA funded", get: s => [s.nih], order: ["Yes", "No"]},
  {key: "drug", label: "Drug or medication", get: s => s.drugs, top: 6}
];
const FBY = Object.fromEntries(FACETS.map(f => [f.key, f]));
const F = {sel: {}, q: "", y0: null, y1: null, mode: "count", sort: "new", shown: 30, expanded: new Set(), view: "map"};
FACETS.forEach(f => F[f.key] = new Set());

const fullYears = () => F.y0 === YEARS[0] && F.y1 === YEARS.at(-1);
function passes(s, except) {
  for (const f of FACETS) { if (f.key === except) continue; const set = F[f.key]; if (set.size && !f.get(s).some(v => set.has(v))) return false; }
  if (except !== "year" && !fullYears() && (!s.year || s.year < F.y0 || s.year > F.y1)) return false;
  if (F.q) { const terms = F.q.toLowerCase().split(/\s+/).filter(Boolean); if (!terms.every(t => s.search.includes(t))) return false; }
  return true;
}
const inSel = s => (!F.sel.policy || s.policies.includes(F.sel.policy)) && (!F.sel.outcome || s.outcomes.includes(F.sel.outcome));
const current = () => STUDIES.filter(s => passes(s) && inSel(s));
const tierCounts = list => { const t = {}; list.forEach(s => t[s.tier] = (t[s.tier] || 0) + 1); return t; };

/* ---------- load ---------- */
function ingest(text) {
  const d = normalize(text); if (!d.studies.length) throw new Error("No rows with a Title");
  STUDIES = d.studies;
  if (d.notes.length || d.missing.length) {
    console.groupCollapsed("Evidence map: " + d.notes.length + " data notes" + (d.missing.length ? ", missing columns: " + d.missing.join(", ") : ""));
    console.table(d.notes); console.groupEnd();
  }
  const present = new Set(STUDIES.flatMap(s => s.policies));
  ALL_POLICIES = [];
  POLICY_GROUPS.forEach(([g, ps]) => ps.forEach(p => { if (present.has(p)) ALL_POLICIES.push({p, g}); }));
  [...present].filter(p => !GROUP_OF[p]).sort().forEach(p => ALL_POLICIES.push({p, g: "Other policy"}));
  const ys = STUDIES.map(s => s.year).filter(Boolean); const lo = Math.min(...ys), hi = Math.max(...ys);
  YEARS = []; for (let y = lo; y <= hi; y++) YEARS.push(y);
  F.y0 = lo; F.y1 = hi; syncYearSelects();
  render();
}
function syncYearSelects() {
  ["yFrom", "yTo"].forEach((id, k) => { $("#" + id).innerHTML = YEARS.map(y => `<option${y === (k ? F.y1 : F.y0) ? " selected" : ""}>${y}</option>`).join(""); });
}
function setSource(kind, detail) {
  const when = new Date().toLocaleString("en-US", {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"});
  const snapDate = SITE.snapshotDate ? new Date(SITE.snapshotDate + "T12:00:00").toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}) : "";
  const sheet = SITE.sheetViewUrl ? `<a href="${esc(SITE.sheetViewUrl)}" target="_blank" rel="noopener">review sheet</a>` : "review sheet";
  $("#srcDot").className = "dot" + (kind === "live" ? " live" : "");
  $("#srcLabel").innerHTML = kind === "live" ? `Live from the ${sheet} · loaded ${esc(when)}` :
    kind === "error" ? esc(detail) : `Saved copy of the ${sheet}${snapDate ? " · " + esc(snapDate) : ""}${detail ? " · " + esc(detail) : ""}`;
}
async function load() {
  let liveFailed = false;
  if (SITE.sheetCsvUrl) {
    try {
      const r = await fetch(SITE.sheetCsvUrl, {cache: "no-store"});
      if (!r.ok) throw new Error(r.status);
      ingest(await r.text()); setSource("live"); return;
    } catch (e) { liveFailed = true; console.warn("Live sheet unavailable, using saved copy:", e); }
  }
  try {
    const r = await fetch(SITE.snapshotPath || "data/snapshot.csv");
    if (!r.ok) throw new Error(r.status);
    ingest(await r.text()); setSource("snapshot", liveFailed ? "live sheet unreachable" : "");
  } catch (e) {
    setSource("error", "Couldn't load the data. If you opened index.html straight from your computer, run a local server instead (see README).");
    $("#list").innerHTML = `<li class="none">The data didn't load, so there is nothing to show yet.</li>`;
  }
}

/* ---------- render ---------- */
function render() { renderFacets(); renderActive(); if (F.view === "map") renderMap(); else renderFigures(); renderList(); }

function facetCounts(f) { const m = new Map(); STUDIES.forEach(s => { if (!passes(s, f.key) || !inSel(s)) return; f.get(s).forEach(v => m.set(v, (m.get(v) || 0) + 1)); }); return m; }
function orderedValues(f, c) {
  const universe = new Set(STUDIES.flatMap(f.get));
  return f.order ? f.order.filter(v => universe.has(v)).concat([...universe].filter(v => !f.order.includes(v)).sort())
    : [...universe].sort((a, b) => (c.get(b) || 0) - (c.get(a) || 0) || a.localeCompare(b));
}
function renderFacets() {
  const html = [];
  FACETS.filter(f => f.rail !== false).forEach(f => {
    const c = facetCounts(f), vals = orderedValues(f, c);
    if (vals.length < 2 && !F[f.key].size) return;
    const limit = f.top && !F.expanded.has(f.key) ? f.top : Infinity;
    const shown = vals.filter((v, i) => i < limit || F[f.key].has(v));
    html.push(`<div class="facet"><h3>${esc(f.label)}</h3><ul>` + shown.map(v => { const n = c.get(v) || 0, on = F[f.key].has(v);
      const sw = f.swatch ? `<i class="sw" style="background:var(${TIER_VAR[v]})"></i>` : "";
      return `<li><label class="${n || on ? "" : "zero"}"><input type="checkbox" data-f="${f.key}" value="${esc(v)}"${on ? " checked" : ""}><span>${sw}${esc(v)}</span><span class="n">${n}</span></label></li>`; }).join("") + `</ul>` +
      (f.top && vals.length > f.top ? `<button class="btn link more" data-more="${f.key}">${F.expanded.has(f.key) ? "Show fewer" : "Show all " + vals.length}</button>` : "") + `</div>`);
  });
  $("#facets").innerHTML = html.join("");
}
function renderActive() {
  const pills = [];
  if (F.sel.policy || F.sel.outcome) pills.push(["sel", "", [F.sel.policy, F.sel.outcome].filter(Boolean).join(" × ")]);
  FACETS.forEach(f => F[f.key].forEach(v => pills.push([f.key, v, `${f.label}: ${v}`])));
  if (YEARS.length && !fullYears()) pills.push(["year", "", F.y0 === F.y1 ? `Year: ${F.y0}` : `Years: ${F.y0}–${F.y1}`]);
  if (F.q) pills.push(["q", "", `“${F.q}”`]);
  $("#active").innerHTML = pills.map(([k, v, l]) => `<span class="pill">${esc(l)}<button data-rm="${k}" data-v="${esc(v)}" aria-label="Remove ${esc(l)}">×</button></span>`).join("") +
    (pills.length > 1 ? `<button class="btn link" data-rm="all">Clear all</button>` : "");
  $("#railCount").textContent = pills.length ? pills.length + " active" : "";
}

function renderMap() {
  const base = STUDIES.filter(s => passes(s));
  const cols = []; OUTCOMES.forEach(([k, os]) => os.forEach(o => cols.push({o, k})));
  [...new Set(STUDIES.flatMap(s => s.outcomes))].filter(o => !KNOWN_OUTCOMES.has(o)).sort().forEach(o => cols.push({o, k: "Other"}));
  const used = new Set(STUDIES.flatMap(s => s.outcomes)); const C = cols.filter(c => used.has(c.o));
  const cell = new Map(); let max = 1;
  ALL_POLICIES.forEach(({p}) => C.forEach(({o}) => { const list = base.filter(s => s.policies.includes(p) && s.outcomes.includes(o)); cell.set(p + "|" + o, list); max = Math.max(max, list.length); }));
  const kinds = []; C.forEach((c, i) => { if (!kinds.length || kinds.at(-1).k !== c.k) kinds.push({k: c.k, n: 1, first: i}); else kinds.at(-1).n++; });
  const sepAt = new Set(kinds.slice(1).map(k => k.first));
  let h = `<thead><tr class="kind"><th class="corner" rowspan="2">Policy intervention</th>${kinds.map((k, i) => `<th colspan="${k.n}" class="${i ? "sep" : ""}">${esc(k.k)}</th>`).join("")}<th class="tot" rowspan="2">Studies</th></tr><tr>` +
    C.map((c, i) => `<th class="colh${F.sel.outcome === c.o && !F.sel.policy ? " on" : ""}${sepAt.has(i) ? " sep" : ""}"><button data-col="${esc(c.o)}" title="Show all studies with this outcome">${esc(c.o)}</button></th>`).join("") + `</tr></thead><tbody>`;
  let empty = 0, total = 0, lastG = null;
  ALL_POLICIES.forEach(({p, g}) => {
    if (g !== lastG) { h += `<tr class="grp"><td>${esc(g)}</td><td class="fill" colspan="${C.length + 1}"></td></tr>`; lastG = g; }
    const rowN = base.filter(s => s.policies.includes(p)).length;
    h += `<tr><th class="rowh${F.sel.policy === p && !F.sel.outcome ? " on" : ""}" scope="row"><button data-row="${esc(p)}" title="Show all studies of this policy">${esc(p)}</button></th>`;
    C.forEach(({o}, i) => { const list = cell.get(p + "|" + o), n = list.length; total++; if (!n) empty++;
      const sel = F.sel.policy === p && F.sel.outcome === o; let inner;
      if (!n) inner = `<span class="empty-ring"></span>`;
      else if (F.mode === "count") { const d = Math.round(22 + 24 * Math.sqrt(n / max)); inner = `<span class="bub" style="width:${d}px;height:${d}px">${n}</span>`; }
      else { const w = Math.round(14 + 58 * n / max), t = tierCounts(list);
        inner = `<span class="mix"><span class="lbl">${n}</span><span class="bar" style="width:${w}px">${TIERS.filter(x => t[x]).map(x => `<i style="flex:${t[x]};background:var(${TIER_VAR[x]})"></i>`).join("")}</span></span>`; }
      h += `<td class="cell${sepAt.has(i) ? " sep" : ""}"><button class="cellbtn${sel ? " sel" : ""}" data-p="${esc(p)}" data-o="${esc(o)}" aria-label="${esc(p)} and ${esc(o)}: ${n ? n + " studies" : "no studies"}" aria-pressed="${sel}">${inner}</button></td>`; });
    h += `<td class="rowtot">${rowN}</td></tr>`;
  });
  h += `</tbody><tfoot><tr><td class="rowh">Studies per outcome</td>${C.map((c, i) => `<td class="${sepAt.has(i) ? "sep" : ""}">${base.filter(s => s.outcomes.includes(c.o)).length}</td>`).join("")}<td class="rowtot">${base.length}</td></tr></tfoot>`;
  $("#gm").innerHTML = h;
  $("#mapTitle").textContent = base.length < STUDIES.length ? `${fmt(base.length)} of ${fmt(STUDIES.length)} studies match your filters` : `${fmt(STUDIES.length)} studies across ${ALL_POLICIES.length} policies`;
  const top = ALL_POLICIES.map(({p}) => [p, base.filter(s => s.policies.includes(p)).length]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(x => x[1]);
  $("#mapSub").textContent = `${empty} of ${total} policy–outcome pairs have no studies` + (top.length ? `. Most studied: ${top.map(x => x[0] + " (" + x[1] + ")").join(", ")}.` : ".");
  $("#legend").innerHTML = F.mode === "count"
    ? `<span><i class="bub" style="width:10px;height:10px"></i>Circle area = studies in the cell (largest: ${max})</span><span><i class="ring"></i>No studies</span><span>A study with several policies or outcomes counts in each cell it covers</span>`
    : TIERS.map(t => `<span><i style="background:var(${TIER_VAR[t]})"></i>${t}</span>`).join("") + `<span><i class="ring"></i>No studies</span>`;
}

/* ---------- summary figures ---------- */
function renderFigures() {
  const list = current();
  const where = [F.sel.policy, F.sel.outcome].filter(Boolean).join(" × ");
  $("#figTitle").textContent = list.length < STUDIES.length ? `${fmt(list.length)} of ${fmt(STUDIES.length)} studies` + (where ? ` · ${where}` : "") : `All ${fmt(STUDIES.length)} studies at a glance`;
  $("#figSub").textContent = "Each figure follows the filters. Click a bar to filter by it; click again to remove it.";
  const out = [yearFigure()];
  const designs = barData(FBY.design);
  out.push(barFigure(FBY.design, "Study design", designs, {color: v => `var(${TIER_VAR[designTier(v)]})`, legend: true, limit: 10}));
  out.push(barFigure(FBY.grp, "Policy area", barData(FBY.grp), {note: "A study that covers policies in more than one area counts in each."}));
  out.push(barFigure(FBY.fund, "Funding source", barData(FBY.fund)));
  out.push(barFigure(FBY.pop, "Population studied", barData(FBY.pop), {limit: 8, note: "A study can name up to three populations."}));
  out.push(barFigure(FBY.gov, "Level of government", barData(FBY.gov)));
  $("#figs").innerHTML = out.join("");
}
const DESIGN_TIER = {}; // filled lazily from data
function designTier(v) { if (!(v in DESIGN_TIER)) { const s = STUDIES.find(x => x.design === v); DESIGN_TIER[v] = s ? s.tier : "Not reported"; } return DESIGN_TIER[v]; }
function barData(f) {
  const total = STUDIES.filter(s => passes(s, f.key) && inSel(s)).length;
  const c = facetCounts(f);
  let vals = (f.order ? orderedValues(f, c) : [...c.keys()].sort((a, b) => c.get(b) - c.get(a) || a.localeCompare(b)));
  vals = vals.filter(v => c.get(v) || F[f.key].has(v));
  return {total, rows: vals.map(v => ({v, n: c.get(v) || 0}))};
}
function barFigure(f, title, d, opt = {}) {
  const rows = opt.limit ? d.rows.filter((r, i) => i < opt.limit || F[f.key].has(r.v)) : d.rows;
  const max = Math.max(1, ...rows.map(r => r.n)), picked = F[f.key].size > 0;
  const top = d.rows.slice().sort((a, b) => b.n - a.n)[0];
  const sub = !d.total ? "No studies match the current filters." :
    top ? `Most common: ${top.v}, ${fmt(top.n)} of ${fmt(d.total)} studies (${pct(top.n, d.total)}%)` : "";
  let legend = "";
  if (opt.legend) { const tiers = new Set(rows.map(r => designTier(r.v)));
    legend = `<div class="flegend">${TIERS.filter(t => tiers.has(t)).map(t => `<span><i style="background:var(${TIER_VAR[t]})"></i>${t}</span>`).join("")}</div>`; }
  const more = opt.limit && d.rows.length > rows.length ? `<p class="fig-note">Showing the top ${rows.length} of ${d.rows.length}. Use the filters on the left to see the rest.</p>` : "";
  return `<div class="fig"><h3>${esc(title)}</h3><p class="fig-sub">${esc(sub)}</p>${legend}
    <ul class="hbars${picked ? " picked" : ""}">${rows.map(r => { const on = F[f.key].has(r.v);
      const tip = `${r.v}: ${fmt(r.n)} ${r.n === 1 ? "study" : "studies"} (${pct(r.n, d.total)}% of ${fmt(d.total)})`;
      return `<li><button class="hbar${on ? " on" : ""}" data-ff="${f.key}" data-fv="${esc(r.v)}" aria-pressed="${on}" data-tip="${esc(tip)}">
        <span class="hb-label">${esc(r.v)}</span><span class="hb-track"><span class="hb-fill" style="width:calc((100% - 44px) * ${(r.n / max).toFixed(4)});${opt.color ? "background:" + opt.color(r.v) : ""}"></span><span class="hb-val">${fmt(r.n)}</span></span></button></li>`; }).join("")}</ul>
    ${opt.note ? `<p class="fig-note">${esc(opt.note)}</p>` : ""}${more}</div>`;
}
function yearFigure() {
  const m = new Map(); let total = 0;
  STUDIES.forEach(s => { if (s.year && passes(s, "year") && inSel(s)) { m.set(s.year, (m.get(s.year) || 0) + 1); total++; } });
  const W = Math.max(300, Math.min(1200, (($("#figs") && $("#figs").clientWidth) || 756) - 36)), Hh = W < 500 ? 170 : 200, L = 34, R = 8, T = 22, B = 26, iw = W - L - R, ih = Hh - T - B;
  const max = Math.max(1, ...m.values()), step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : 10, yMax = Math.ceil(max / step) * step;
  const band = iw / YEARS.length, bw = Math.min(24, band * 0.72), y = v => T + ih - ih * v / yMax;
  let peak = null; m.forEach((n, yr) => { if (!peak || n > peak[1]) peak = [yr, n]; });
  const every = band >= 40 ? 1 : band >= 20 ? 2 : 5;
  let g = "";
  for (let v = 0; v <= yMax; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--f-mono)">${v}</text>`;
  YEARS.forEach((yr, i) => {
    const n = m.get(yr) || 0, x = L + i * band + (band - bw) / 2, top = y(n), base = y(0), on = yr >= F.y0 && yr <= F.y1, r = Math.min(4, (base - top) / 2);
    const path = n ? `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z` : "";
    g += `<g class="col" data-year="${yr}" data-tip="${yr}: ${n} ${n === 1 ? "study" : "studies"}"><rect x="${L + i * band}" y="${T}" width="${band}" height="${ih}" fill="transparent"/>` +
      (n ? `<path class="m" d="${path}" fill="${on ? "var(--bar)" : "var(--rule-strong)"}"/>` : "") +
      ((yr - YEARS[0]) % every === 0 || i === YEARS.length - 1 ? `<text x="${x + bw / 2}" y="${Hh - 8}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="var(--f-mono)">${yr}</text>` : "") +
      (peak && yr === peak[0] ? `<text x="${x + bw / 2}" y="${top - 6}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--ink)" font-family="var(--f-mono)">${n}</text>` : "") + `</g>`;
  });
  const sub = !total ? "No studies match the current filters." : `${fmt(total)} studies from ${YEARS[0]} to ${YEARS.at(-1)}; the most, ${peak[1]}, were published in ${peak[0]}.`;
  return `<div class="fig wide"><h3>Studies per publication year</h3><p class="fig-sub">${esc(sub)} Click a year to show only that year.</p>
    <svg class="years-svg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Studies per publication year">${g}</svg></div>`;
}

/* ---------- study list ---------- */
const sizeRank = s => s.size === "Not reported" ? -1 : SIZE_ORDER.indexOf(s.size);
function sorted(list) { const by = {
  new: (a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title),
  old: (a, b) => (a.year || 9999) - (b.year || 9999) || a.title.localeCompare(b.title),
  size: (a, b) => sizeRank(b) - sizeRank(a) || (b.year || 0) - (a.year || 0),
  rigor: (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || (b.year || 0) - (a.year || 0),
  title: (a, b) => a.title.localeCompare(b.title)}[F.sort];
  return list.slice().sort(by); }
function renderList() {
  const list = sorted(current());
  const where = [F.sel.policy, F.sel.outcome].filter(Boolean).join(" × ");
  $("#resTitle").textContent = `${fmt(list.length)} ${list.length === 1 ? "study" : "studies"}${where ? " · " + where : ""}`;
  const t = tierCounts(list);
  $("#resMix").innerHTML = TIERS.filter(x => t[x]).map(x => `<i style="flex:${t[x]};background:var(${TIER_VAR[x]})" title="${x}: ${t[x]}"></i>`).join("");
  if (!list.length) {
    $("#list").innerHTML = `<li class="none">${F.sel.policy && F.sel.outcome ? "No studies look at this policy and outcome together under the current filters. This is a gap in the evidence." : "No studies match these filters. Remove a filter to widen the search."}</li>`;
    $("#resFoot").innerHTML = ""; return; }
  $("#list").innerHTML = list.slice(0, F.shown).map(s => `<li>
    <h3 class="st-title">${s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</h3>
    <div class="st-meta"><span class="tier"><i style="background:var(${TIER_VAR[s.tier]})"></i>${esc(s.design)}</span><span>${esc(s.journal || "Journal not recorded")}${s.year ? ", " + s.year : ""}</span><span>${esc(s.scope)}</span><span>${s.size === "Not reported" ? "Sample not reported" : "n " + esc(s.size)}</span></div>
    <div class="tags">${s.policies.map(p => `<span class="tag pol">${esc(p)}</span>`).join("")}${s.outcomes.map(o => `<span class="tag">${esc(o)}</span>`).join("")}</div>
    ${s.findings ? `<p class="st-find">${esc(s.findings)}</p>` : ""}
    <div><button class="btn link" data-open="${s.id}">Full record</button></div></li>`).join("");
  $("#resFoot").innerHTML = list.length > F.shown ? `<button class="btn" id="moreBtn">Show ${Math.min(30, list.length - F.shown)} more of ${list.length - F.shown}</button>` : "";
}

/* ---------- study record ---------- */
function openStudy(id, fromHash) {
  const s = STUDIES.find(x => x.id === id); if (!s) return;
  const rel = STUDIES.filter(x => x !== s && x.policies.some(p => s.policies.includes(p)) && x.outcomes.some(o => s.outcomes.includes(o)))
    .sort((a, b) => b.policies.filter(p => s.policies.includes(p)).length - a.policies.filter(p => s.policies.includes(p)).length || (b.year || 0) - (a.year || 0)).slice(0, 6);
  const row = (k, v, raw) => v ? `<dt>${k}</dt><dd>${esc(v)}${raw && raw !== v ? ` <span class="raw">(sheet: ${esc(raw)})</span>` : ""}</dd>` : "";
  $("#drawer").innerHTML = `<div class="dtools"><button class="btn" id="dClose">Close</button><button class="btn" id="dCopy">Copy link to this study</button></div>
    <h2 id="dTitle">${esc(s.title)}</h2>
    <dl>${row("Journal", [s.journal, s.year].filter(Boolean).join(", "))}${row("Policy", s.policies.join(", "))}${row("Policy detail", s.polText)}${row("Specific policy", s.specific)}
    ${row("Policy category", s.cats.join(", "))}${row("Outcomes", s.outcomes.join(", "))}${row("Study design", s.design + " · " + s.tier, s.designRaw)}${row("Strength of evidence", s.soe)}
    ${row("Government level", s.gov)}${row("Scope", s.scope)}${row("Population", s.pops.join(", "))}${row("Participants", s.size, s.sizeRaw)}${row("Duration", s.dur, s.durRaw)}
    ${row("Drugs", s.drugs.join(", "))}${row("Funding", s.fund)}${row("Funding detail", s.fundText)}
    ${s.link ? `<dt>Link</dt><dd><a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.link.replace(/^https?:\/\//, "").slice(0, 60))}</a></dd>` : ""}</dl>
    ${s.exposure ? `<h3>What was studied</h3><p>${esc(s.exposure)}</p>` : ""}
    ${s.findings ? `<h3>Findings</h3><p>${esc(s.findings)}</p>` : ""}
    ${rel.length ? `<h3>Related studies (same policy and outcome)</h3><ul class="rel">${rel.map(r => `<li><button data-open="${r.id}">${esc(r.title)}</button> <span class="raw">${r.year || ""}</span></li>`).join("")}</ul>` : ""}`;
  $("#drawer").hidden = false; $("#scrim").hidden = false; $("#drawer").scrollTop = 0; $("#dClose").focus();
  if (!fromHash) setHash("s-" + s.id);
}
function closeDrawer() { $("#drawer").hidden = true; $("#scrim").hidden = true; setHash(F.view === "figures" ? "figures" : ""); }
function setHash(h) { try { if (h) history.replaceState(null, "", "#" + h); else history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = h; } }

/* ---------- export ---------- */
async function exportCSV() {
  const list = sorted(current());
  const csv = Papa.unparse(list.map(s => ({Title: s.title, Year: s.year || "", Journal: s.journal || "", Design: s.design, "Design tier": s.tier, Policies: s.policies.join("; "),
    Outcomes: s.outcomes.join("; "), "Government level": s.gov, Scope: s.scope, Populations: s.pops.join("; "), Participants: s.size, Duration: s.dur, Funding: s.fund, Link: s.link || "", Findings: s.findings || ""})));
  const name = "oud-policy-evidence-" + new Date().toISOString().slice(0, 10) + ".csv";
  // Inside claude.ai previews, downloads go through the viewer; on a normal website, a plain download link works.
  try { const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; if (dl) { await dl.save({filename: name, data: csv}); return; } } catch (e) { if (e && e.code === "declined") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type: "text/csv"})); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- views ---------- */
function showView(v, fromHash) {
  F.view = v; const map = v === "map";
  $("#tabMap").setAttribute("aria-selected", map); $("#tabFig").setAttribute("aria-selected", !map);
  $("#viewMap").hidden = !map; $("#viewFig").hidden = map; $("#modeSeg").hidden = !map;
  if (STUDIES.length) { if (map) renderMap(); else renderFigures(); }
  if (!fromHash) setHash(map ? "" : "figures");
}
function route() {
  const h = location.hash.replace(/^#/, "");
  if (h.startsWith("s-")) { if (STUDIES.length) openStudy(h.slice(2), true); }
  else showView(h === "figures" ? "figures" : "map", true);
}

/* ---------- events ---------- */
function rerender() { F.shown = 30; render(); }
function toggle(key, v) { const set = F[key]; set.has(v) ? set.delete(v) : set.add(v); rerender(); }
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.f) { const set = F[t.dataset.f]; t.checked ? set.add(t.value) : set.delete(t.value); rerender(); }
  else if (t.id === "yFrom" || t.id === "yTo") { let a = +$("#yFrom").value, b = +$("#yTo").value; if (a > b) [a, b] = [b, a]; F.y0 = a; F.y1 = b; rerender(); }
  else if (t.id === "sort") { F.sort = t.value; renderList(); }
});
let qT; $("#q").addEventListener("input", e => { clearTimeout(qT); qT = setTimeout(() => { F.q = e.target.value.trim(); rerender(); }, 160); });
document.addEventListener("click", e => {
  const col = e.target.closest(".col[data-year]");
  if (col) { const yr = +col.dataset.year; if (F.y0 === yr && F.y1 === yr) { F.y0 = YEARS[0]; F.y1 = YEARS.at(-1); } else { F.y0 = F.y1 = yr; } $("#yFrom").value = F.y0; $("#yTo").value = F.y1; rerender(); return; }
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.p) { const same = F.sel.policy === t.dataset.p && F.sel.outcome === t.dataset.o; F.sel = same ? {} : {policy: t.dataset.p, outcome: t.dataset.o}; rerender();
    if (!same && matchMedia("(max-width: 920px)").matches) $("#results").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); }
  else if (t.dataset.row) { F.sel = F.sel.policy === t.dataset.row && !F.sel.outcome ? {} : {policy: t.dataset.row}; rerender(); }
  else if (t.dataset.col) { F.sel = F.sel.outcome === t.dataset.col && !F.sel.policy ? {} : {outcome: t.dataset.col}; rerender(); }
  else if (t.dataset.ff) toggle(t.dataset.ff, t.dataset.fv);
  else if (t.dataset.rm) { const k = t.dataset.rm;
    if (k === "all") { FACETS.forEach(f => F[f.key].clear()); F.sel = {}; F.q = ""; $("#q").value = ""; F.y0 = YEARS[0]; F.y1 = YEARS.at(-1); syncYearSelects(); }
    else if (k === "sel") F.sel = {}; else if (k === "q") { F.q = ""; $("#q").value = ""; }
    else if (k === "year") { F.y0 = YEARS[0]; F.y1 = YEARS.at(-1); syncYearSelects(); }
    else F[k].delete(t.dataset.v); rerender(); }
  else if (t.dataset.more) { const k = t.dataset.more; F.expanded.has(k) ? F.expanded.delete(k) : F.expanded.add(k); renderFacets(); }
  else if (t.dataset.open) openStudy(t.dataset.open);
  else if (t.id === "dClose") closeDrawer();
  else if (t.id === "dCopy") { const url = location.href; const done = () => { t.textContent = "Link copied"; setTimeout(() => t.textContent = "Copy link to this study", 1800); };
    try { navigator.clipboard.writeText(url).then(done, () => { t.textContent = url; }); } catch (err) { t.textContent = url; } }
  else if (t.id === "moreBtn") { F.shown += 30; renderList(); }
  else if (t.id === "mCount" || t.id === "mMix") { F.mode = t.id === "mCount" ? "count" : "mix"; $("#mCount").setAttribute("aria-pressed", F.mode === "count"); $("#mMix").setAttribute("aria-pressed", F.mode === "mix"); renderMap(); }
  else if (t.id === "tabMap") showView("map"); else if (t.id === "tabFig") showView("figures");
  else if (t.id === "exportBtn") exportCSV();
});
$("#scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer(); });
window.addEventListener("hashchange", route);
let rT; window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { if (F.view === "figures" && STUDIES.length) renderFigures(); }, 150); });

/* tooltips: map cells get a design breakdown; anything with data-tip shows its text */
const tip = $("#tip");
function placeTip(e) { tip.hidden = false; const r = tip.getBoundingClientRect(); let x = e.clientX + 14, y = e.clientY + 14;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
  tip.style.left = x + "px"; tip.style.top = y + "px"; }
document.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  const b = e.target.closest && e.target.closest(".cellbtn");
  if (b) { const list = STUDIES.filter(s => passes(s) && s.policies.includes(b.dataset.p) && s.outcomes.includes(b.dataset.o)), t = tierCounts(list);
    tip.innerHTML = `<b>${esc(b.dataset.p)} × ${esc(b.dataset.o)}</b>` + (list.length ? `${list.length} ${list.length === 1 ? "study" : "studies"}` + TIERS.filter(x => t[x]).map(x => `<div class="row"><span>${x}</span><span>${t[x]}</span></div>`).join("") + `<div style="opacity:.7;margin-top:4px">Click to list them</div>` : "No studies: an evidence gap");
    placeTip(e); return; }
  const d = e.target.closest && e.target.closest("[data-tip]");
  if (d) { tip.textContent = d.dataset.tip; placeTip(e); return; }
  tip.hidden = true;
});
document.addEventListener("pointerleave", () => tip.hidden = true);

/* ---------- start ---------- */
document.title = SITE.title || document.title;
$("#siteTitle").textContent = SITE.title || "Evidence Map";
$("#siteIntro").textContent = SITE.intro || "";
$("#foot").innerHTML = `<span>${esc(SITE.credit || "")}</span><span>Study details link to the original publications.</span>`;
if (matchMedia("(max-width: 920px)").matches) $("#railWrap").open = false;
load().then(route);
})();
