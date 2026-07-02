/**
 * RSVP relance — Erwan Sixty 60 Tour
 * GET  : liste des invités (prénom/nom uniquement) pour l'autocomplete.
 * POST : enregistre la réponse + le numéro de téléphone dans Airtable.
 *
 * Corps POST :
 * {
 *   reponse:  "oui" | "non" | "peutetre",     // obligatoire
 *   phone:    "06 12 34 56 78",               // obligatoire
 *   guestId:  "rec…"                          // OU newGuest: { prenom, nom }
 *   newGuest: { prenom, nom }
 * }
 */
const { airtable, listAll, json, T, F } = require("./airtable-client");

const F_TELEPHONE = "fldPUZNuwXR7uzjG9";
const F_REPONSE = "fld9rWDb4PJ1MIMgj";

const REPONSES = {
  oui: "Oui, je viens 🎉",
  non: "Non, je ne peux pas",
  peutetre: "Je ne sais pas encore",
};

const REC = /^rec[A-Za-z0-9]{14}$/;
const cleanName = (s) => String(s || "").trim().replace(/\s+/g, " ").slice(0, 60);

function cleanPhone(raw) {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  // Formats acceptés : 06/07 françaises, +33, +590 (Guadeloupe), international 8-15 chiffres
  if (!/^(\+?\d{8,15})$/.test(digits)) return null;
  return digits.startsWith("+") ? digits : digits.replace(/^0/, "0"); // conservé tel quel
}

let guestCache = { at: 0, payload: null };

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      if (guestCache.payload && Date.now() - guestCache.at < 20_000) return json(200, guestCache.payload);
      const recs = await listAll(T.INVITES);
      const guests = recs
        .map((r) => ({
          id: r.id,
          prenom: (r.fields[F.INV_PRENOM] || "").trim(),
          nom: (r.fields[F.INV_NOM] || "").trim(),
        }))
        .filter((g) => g.prenom || g.nom)
        .sort((a, b) => (a.prenom || a.nom).localeCompare(b.prenom || b.nom, "fr"));
      guestCache = { at: Date.now(), payload: { guests } };
      return json(200, guestCache.payload);
    }

    if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée" });

    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return json(400, { error: "Corps JSON invalide" }); }

    const { reponse, guestId, newGuest } = body;
    const reponseLabel = REPONSES[reponse];
    if (!reponseLabel) return json(400, { error: "Réponse invalide" });

    const phone = cleanPhone(body.phone);
    if (!phone) return json(400, { error: "Numéro de téléphone invalide — vérifie le format (ex. 06 12 34 56 78)" });

    if (guestId && !REC.test(guestId)) return json(400, { error: "guestId invalide" });
    if (!guestId && !newGuest) return json(400, { error: "Indique qui tu es" });

    let inviteId = guestId;
    if (!inviteId) {
      const prenom = cleanName(newGuest.prenom);
      const nom = cleanName(newGuest.nom);
      if (prenom.length < 2) return json(400, { error: "Prénom trop court" });
      const created = await airtable(`/${T.INVITES}`, {
        method: "POST",
        body: JSON.stringify({
          fields: { [F.INV_PRENOM]: prenom, [F.INV_NOM]: nom || prenom },
          typecast: true,
        }),
      });
      inviteId = created.id;
    }

    await airtable(`/${T.INVITES}/${inviteId}`, {
      method: "PATCH",
      body: JSON.stringify({
        fields: {
          [F_TELEPHONE]: phone,
          [F_REPONSE]: reponseLabel,
        },
        typecast: true,
      }),
    });

    return json(200, { ok: true, inviteId, reponse: reponseLabel });
  } catch (e) {
    console.error("rsvp error:", e.message);
    return json(e.statusCode || 500, { error: "L'envoi a échoué. Réessaie dans un instant." });
  }
};
