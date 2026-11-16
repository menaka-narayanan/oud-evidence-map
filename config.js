/*
  SITE SETTINGS — the only file most upkeep needs to touch.
  Plain JavaScript objects: keep the quotes and commas as they are.
*/
window.SITE = {
  title: "OUD Policy Evidence Map",
  intro: "Peer-reviewed studies of opioid policy, coded by policy type, outcome, design and population. Click any cell or bar to see the studies behind it; dashed rings mark policy–outcome pairs with no studies.",

  // The Google Sheet, published to the web as CSV:
  // In the sheet: File → Share → Publish to web → choose the tab → "Comma-separated values (.csv)" → Publish → copy the link here.
  // Leave "" to use only the saved copy below.
  sheetCsvUrl: "",

  // Link shown to visitors as the data source (the normal sheet link, or "" to hide it).
  sheetViewUrl: "",

  // Saved copy of the data, used when sheetCsvUrl is empty or Google can't be reached.
  // To refresh it: in the sheet, File → Download → Comma-separated values, then replace data/snapshot.csv.
  snapshotPath: "data/snapshot.csv",
  snapshotDate: "2026-10-18",

  // If the sheet has a "Status" column, show only rows with this value (e.g. "Final"). Leave "" to show every row.
  onlyStatus: "",

  // Footer credit line. Plain text.
  credit: "Evidence map maintained by the review team. Data coded by trained reviewers from the full text of each study."
};

/*
  VOCABULARY — how the sheet's values are grouped and labelled on the site.
  Left side: a value as typed in the sheet, in lower case. Right side: the label shown on the site.
  Values not listed here are shown as typed (first letter capitalised).
*/
window.VOCAB = {
  policyAlias: {
    "pmdps": "PDMPs", "pdmps": "PDMPs", "pdmp": "PDMPs",
    "initital prescribing limits": "Initial Prescribing Limits",
    "medicaid lips": "Medicaid Lock-in Programs",
    "mat": "Medications for OUD (MAT)",
    "risk evaluation and mitigation strategy": "REMS",
    "pain management clinics": "Pain Clinic Laws",
    "anti-doctor shopping laws": "Anti-Doctor-Shopping Laws",
    "neonatal/maternal substance use policy": "Maternal & Neonatal Policy",
    "the civil addict program": "Civil Addict Program",
    "aca coverage": "ACA Coverage Expansion"
  },

  // Rows of the evidence map, in order, grouped under headings. A policy not listed appears under "Other policy".
  policyGroups: [
    ["Payment & insurance", ["Medicaid Coverage", "Medicare Coverage", "ACA Coverage Expansion", "Medicaid Lock-in Programs", "Prior Authorization Policy"]],
    ["Prescribing & dispensing", ["Opioid Prescribing Guidelines", "Initial Prescribing Limits", "PDMPs", "Pain Clinic Laws", "Anti-Doctor-Shopping Laws", "REMS"]],
    ["Overdose response & harm reduction", ["Naloxone Access Laws", "Good Samaritan Laws", "Syringe Access Laws", "Law Enforcement Overdose Training"]],
    ["Treatment & justice", ["Medications for OUD (MAT)", "Drug Courts", "Civil Addict Program"]],
    ["Other policy", ["Marijuana Laws", "Maternal & Neonatal Policy"]]
  ],

  outcomeAlias: {
    "utilization": "Utilization", "access": "Access", "coverage": "Coverage", "cost": "Cost", "quality of care": "Quality of care",
    "patient outcomes": "Patient outcomes", "patient retention in care": "Retention & engagement", "patient engagement": "Retention & engagement",
    "provider perspectives": "Provider", "patient perspectives": "Patient", "police perspectives": "Police", "police perpectives": "Police",
    "stakeholder perspectives": "Stakeholder"
  },

  // Columns of the evidence map, in order, grouped under headings.
  outcomeGroups: [
    ["Outcomes", ["Access", "Coverage", "Cost", "Utilization", "Quality of care", "Patient outcomes", "Retention & engagement"]],
    ["Perspectives", ["Provider", "Patient", "Police", "Stakeholder"]]
  ],

  populationAlias: {
    "people who use opioids": "People who use opioids", "people who use opiods": "People who use opioids", "people who use opiods and heroin": "People who use opioids",
    "oud patients": "People with OUD", "sud patients": "People with SUD", "adolescents with sud": "Youth & young adults",
    "medicaid recipients": "Medicaid enrollees", "medicaid enrollees": "Medicaid enrollees", "medicaid enrolless": "Medicaid enrollees",
    "medicare recipients": "Medicare enrollees", "medicare enrollees": "Medicare enrollees", "medicare recpients": "Medicare enrollees",
    "clinicians": "Clinicians", "clinicans": "Clinicians", "buprenorphine prescribers": "Clinicians",
    "pas/ nps who prescribe opioids": "Clinicians", "pas/nps who prescribe opioids": "Clinicians",
    "pharmacists": "Pharmacists", "police officers": "Police officers", "police officer attitudes towards intranasal naloxone training": "Police officers",
    "emergency responders": "Emergency responders", "emergency departments": "Emergency departments",
    "cjs involved people": "Justice-involved people", "cjs-involved people": "Justice-involved people",
    "drug court participants": "Justice-involved people", "drug treatment court participants": "Justice-involved people",
    "pwid": "People who inject drugs", "maternal/neonatal": "Maternal & neonatal", "mothers who use opioids": "Maternal & neonatal", "women": "Women",
    "young adults": "Youth & young adults", "teens/young adults": "Youth & young adults",
    "stakeholders": "Policymakers & program staff", "treatment program administrators": "Policymakers & program staff",
    "general": "General population", "patients admitted to the hospital": "Hospital patients", "people admitted to the hospital": "Hospital patients",
    "elderly": "Older adults", "medical marijuana population": "Medical cannabis users", "medical marijuana users": "Medical cannabis users", "hiv+": "People with HIV"
  },

  drugAlias: {
    "marijuana": "Cannabis", "medical marijuana": "Cannabis", "suboxone": "Buprenorphine", "extended release naltrexone": "Naltrexone",
    "benzodiazapines": "Benzodiazepines", "benzodiazepine": "Benzodiazepines", "opioids": "Opioids (general)", "prescribed opioids": "Opioids (general)"
  },
  // Values in the Intervention columns that are not drugs and should be ignored.
  drugSkip: ["pain clinics", "opiod addicition therapies", "na"]
};
