/**
 * Erwan Sixty — client Airtable côté serveur (Netlify Functions).
 * Le PAT ne vit QUE dans les variables d'environnement Netlify.
 */

const BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.airtable_base_id || "appEkfketa401qQr7";
// Tolère la casse de la clé : la variable a pu être saisie en minuscules dans Netlify
const TOKEN = process.env.AIRTABLE_TOKEN || process.env.airtable_token || process.env.Airtable_Token;

const API = `https://api.airtable.com/v0/${BASE_ID}`;

// Tables & champs (IDs stables, robustes au renommage)
const T = {
  INVITES: "tblwxiZAANK3v93CL",
  TACHES: "tbl4NjpwNA2HwR3M6",
};

const F = {
  // Invités
  INV_NOM: "fldA0voPMECTHu2lL",
  INV_PRENOM: "fldo5xqMs22MIEiHQ",
  INV_GROUPE: "fldoro8XKXuEcNS5U",
  INV_AIDER: "fldlJ7CEmP6YrZlIP",        // Souhaites-tu aider ? (singleSelect Oui/Non/Peut-être)
  INV_BINOME: "fld23uOUzbLDtnOe5",       // Veux-tu être en binôme ? (checkbox)
  INV_MISSIONS: "fldxgqWENS1czURhZ",     // Missions choisies (link → Taches help)
  // Taches help
  TA_NOM: "fld2jASSiMDZJ2W9w",
  TA_CATEGORIE: "fldJrcXOgz7m5Nt54",
  TA_FORMAT: "fldiDfLzLozxGGzYP",
  TA_STATUT: "fldy2932Th5hfEItR",
  TA_INVITE1: "fldFnuilAmxWJ4jIP",
  TA_INVITE2: "fldkVsGFlX0AX5YKo",
  TA_VOLONTAIRES: "fldea8Hv9It8YYmap",
};

async function airtable(path, options = {}) {
  if (!TOKEN) {
    const err = new Error("AIRTABLE_TOKEN manquant dans les variables d'environnement Netlify.");
    err.statusCode = 500;
    throw err;
  }
  const resp = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    const err = new Error(`Airtable ${resp.status}: ${body.slice(0, 300)}`);
    err.statusCode = resp.status === 429 ? 429 : 502;
    throw err;
  }
  return resp.json();
}

/** Liste toutes les pages d'une table (returnFieldsByFieldId). */
async function listAll(tableId, params = {}) {
  const records = [];
  let offset;
  do {
    const qs = new URLSearchParams({ returnFieldsByFieldId: "true", pageSize: "100", ...params });
    if (offset) qs.set("offset", offset);
    const page = await airtable(`/${tableId}?${qs}`);
    records.push(...page.records);
    offset = page.offset;
  } while (offset);
  return records;
}

/** Capacité selon le Format Airtable ; null = illimité (équipe). */
function capacityOf(formatName) {
  switch (formatName) {
    case "Seul": return 1;
    case "En binôme": return 2;
    case "Seul ou binôme": return 2;
    case "En équipe": return null;
    default: return 2;
  }
}

/** IDs invités déjà positionnés sur une tâche (union dédupliquée des 3 liens). */
function takenIds(fields) {
  const ids = new Set();
  for (const fld of [F.TA_INVITE1, F.TA_INVITE2, F.TA_VOLONTAIRES]) {
    for (const rec of fields[fld] || []) ids.add(typeof rec === "string" ? rec : rec.id);
  }
  return [...ids];
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

module.exports = { airtable, listAll, capacityOf, takenIds, json, T, F };
