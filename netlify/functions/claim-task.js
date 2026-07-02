/**
 * POST /.netlify/functions/claim-task
 * Inscrit un invité sur une mission, avec anti double-booking :
 * on relit la tâche juste avant d'écrire, et on refuse si elle est complète.
 *
 * Corps JSON attendu :
 * {
 *   taskId:   "rec…",              // obligatoire
 *   guestId:  "rec…",              // OU newGuest: { prenom, nom }
 *   newGuest: { prenom, nom },
 *   wantPair: true|false,          // "veux-tu être en binôme ?"
 *   pairGuestId: "rec…"            // optionnel : le binôme choisi (invité existant)
 * }
 */
const { airtable, capacityOf, takenIds, json, T, F } = require("./airtable-client");

const REC = /^rec[A-Za-z0-9]{14}$/;

const cleanName = (s) =>
  String(s || "").trim().replace(/\s+/g, " ").slice(0, 60);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { taskId, guestId, newGuest, wantPair, pairGuestId } = body;

  // ── Validation stricte des entrées ────────────────────────────
  if (!REC.test(taskId || "")) return json(400, { error: "taskId invalide" });
  if (guestId && !REC.test(guestId)) return json(400, { error: "guestId invalide" });
  if (pairGuestId && !REC.test(pairGuestId)) return json(400, { error: "pairGuestId invalide" });
  if (!guestId && !newGuest) return json(400, { error: "Indique qui tu es (guestId ou newGuest)" });
  if (newGuest) {
    newGuest.prenom = cleanName(newGuest.prenom);
    newGuest.nom = cleanName(newGuest.nom);
    if (newGuest.prenom.length < 2) return json(400, { error: "Prénom trop court" });
  }

  try {
    // ── 1. Relire la tâche (état frais → anti double-booking) ───
    const task = await airtable(`/${T.TACHES}/${taskId}?returnFieldsByFieldId=true`);
    const f = task.fields;
    const format = f[F.TA_FORMAT]?.name || "En binôme";
    const capacity = capacityOf(format);
    let taken = takenIds(f);

    if (capacity !== null && taken.length >= capacity) {
      return json(409, { error: "Trop tard, cette mission vient d'être complétée ! Choisis-en une autre." });
    }

    // ── 2. Résoudre l'invité (créer si nouveau) ─────────────────
    let inviteId = guestId;
    if (!inviteId) {
      const created = await airtable(`/${T.INVITES}`, {
        method: "POST",
        body: JSON.stringify({
          fields: {
            [F.INV_PRENOM]: newGuest.prenom,
            [F.INV_NOM]: newGuest.nom || newGuest.prenom,
          },
          typecast: true,
        }),
      });
      inviteId = created.id;
    }

    if (taken.includes(inviteId)) {
      return json(409, { error: "Tu es déjà inscrit·e sur cette mission 😉" });
    }

    // ── 3. Construire la mise à jour des liens ──────────────────
    const ids1 = (f[F.TA_INVITE1] || []).map((r) => r.id || r);
    const ids2 = (f[F.TA_INVITE2] || []).map((r) => r.id || r);
    const vols = (f[F.TA_VOLONTAIRES] || []).map((r) => r.id || r);
    const patch = {};

    const enrol = (id) => {
      if (taken.includes(id)) return false;
      if (format === "En équipe") {
        vols.push(id); patch[F.TA_VOLONTAIRES] = vols;
      } else if (ids1.length === 0 && !(patch[F.TA_INVITE1])) {
        patch[F.TA_INVITE1] = [id]; ids1.push(id);
      } else if (capacity === 2 && ids2.length === 0 && !(patch[F.TA_INVITE2])) {
        patch[F.TA_INVITE2] = [id]; ids2.push(id);
      } else {
        vols.push(id); patch[F.TA_VOLONTAIRES] = vols; // filet de sécurité
      }
      taken = [...new Set([...taken, id])];
      return true;
    };

    enrol(inviteId);

    // Binôme désigné : on le place aussi s'il reste une place
    let pairEnrolled = false;
    if (pairGuestId && (capacity === null || taken.length < capacity)) {
      pairEnrolled = enrol(pairGuestId);
    }

    // Statut → "Assignée" quand la mission est complète
    if (capacity !== null && taken.length >= capacity) {
      patch[F.TA_STATUT] = "Assignée";
    }

    await airtable(`/${T.TACHES}/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: patch, typecast: true }),
    });

    // ── 4. Mettre à jour la fiche invité (meilleure trace côté Erwan) ──
    try {
      const guest = await airtable(`/${T.INVITES}/${inviteId}?returnFieldsByFieldId=true`);
      const missions = (guest.fields[F.INV_MISSIONS] || []).map((r) => r.id || r);
      if (!missions.includes(taskId)) missions.push(taskId);
      await airtable(`/${T.INVITES}/${inviteId}`, {
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            [F.INV_MISSIONS]: missions,
            [F.INV_AIDER]: "Oui",
            [F.INV_BINOME]: Boolean(wantPair),
          },
          typecast: true,
        }),
      });
    } catch (e) {
      console.warn("maj fiche invité non bloquante:", e.message); // la mission est prise, c'est l'essentiel
    }

    const remaining = capacity === null ? null : Math.max(0, capacity - taken.length);
    return json(200, {
      ok: true,
      taskId,
      inviteId,
      pairEnrolled,
      remaining,
      full: capacity !== null && remaining === 0,
    });
  } catch (e) {
    console.error("claim-task error:", e.message);
    return json(e.statusCode || 500, { error: "L'inscription a échoué. Réessaie dans un instant." });
  }
};
