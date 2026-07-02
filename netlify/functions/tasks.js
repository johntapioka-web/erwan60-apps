/**
 * GET /.netlify/functions/tasks
 * Renvoie les 22 missions (avec places restantes calculées depuis les liens
 * Invité 1/2 + Volontaires — le rollup "Nb volontaires" n'est pas fiable)
 * + la liste des invités (prénom/nom uniquement — pas d'email ni téléphone, RGPD).
 * Cache mémoire 20 s pour ménager le quota Airtable.
 */
const { listAll, capacityOf, takenIds, json, T, F } = require("./airtable-client");

let cache = { at: 0, payload: null };
const TTL_MS = 20_000;

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Méthode non autorisée" });

  try {
    if (cache.payload && Date.now() - cache.at < TTL_MS) return json(200, cache.payload);

    const [taskRecs, guestRecs] = await Promise.all([
      listAll(T.TACHES),
      listAll(T.INVITES),
    ]);

    const guests = guestRecs
      .map((r) => ({
        id: r.id,
        prenom: (r.fields[F.INV_PRENOM] || "").trim(),
        nom: (r.fields[F.INV_NOM] || "").trim(),
      }))
      .filter((g) => g.prenom || g.nom)
      .sort((a, b) => (a.prenom || a.nom).localeCompare(b.prenom || b.nom, "fr"));

    const nameById = Object.fromEntries(
      guests.map((g) => [g.id, [g.prenom, g.nom].filter(Boolean).join(" ").trim()])
    );

    const tasks = taskRecs.map((r) => {
      const f = r.fields;
      const format = f[F.TA_FORMAT]?.name || f[F.TA_FORMAT] || "En binôme";
      const capacity = capacityOf(format);
      const taken = takenIds(f);
      return {
        id: r.id,
        nom: f[F.TA_NOM] || "Mission",
        categorie: f[F.TA_CATEGORIE]?.name || f[F.TA_CATEGORIE] || "Autre",
        format,
        capacity,               // null = équipe (illimité)
        taken: taken.length,
        remaining: capacity === null ? null : Math.max(0, capacity - taken.length),
        full: capacity !== null && taken.length >= capacity,
        volontaires: taken.map((id) => nameById[id] || "Un invité").filter(Boolean),
      };
    });

    const payload = { tasks, guests, fetchedAt: new Date().toISOString() };
    cache = { at: Date.now(), payload };
    return json(200, payload);
  } catch (e) {
    console.error("tasks error:", e.message);
    return json(e.statusCode || 500, { error: "Impossible de charger les missions. Réessaie dans un instant." });
  }
};
