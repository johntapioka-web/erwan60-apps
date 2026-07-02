/* ══════════════════════════════════════════════════════════════
   App 1 — Missions « Coup de main » · Erwan Sixty 60 Tour
   Données : Netlify Functions (/tasks, /claim-task) → Airtable.
   Repli : fixtures locales (mode démo) si les functions sont
   injoignables (préview locale sans `netlify dev`).
   ══════════════════════════════════════════════════════════════ */
"use strict";

const CATEGORIES = [
  { name: "Cuisine",         emoji: "🍽" },
  { name: "Sport & Jeux",    emoji: "🎯" },
  { name: "Technique",       emoji: "🔊" },
  { name: "Animation",       emoji: "🎭" },
  { name: "Logistique",      emoji: "🚐" },
  { name: "Ambiance & Déco", emoji: "🌸" },
];

/* Snapshot réel de la base au 02/07/2026 — utilisé UNIQUEMENT en mode démo. */
const FIXTURES = {
  guests: [
    "François Bue", "Sandrine Berrehouc", "Erwan Micheau", "Nono Hoffelinck",
    "Christine Ropers", "Frédéric Burban", "Xavier Marabout", "John Dimosi",
    "Nolwenn", "Gwendal", "Chrystelle", "Fabienne", "Titi", "Hervé", "Bruno",
    "Magalie", "Laurence", "Emmanuelle", "Delphine", "Patrick", "Valérie",
    "Philippe", "Cyril", "Linda", "Sophie", "Xavier", "Anne Laure", "JC",
    "Marc", "Françoise",
  ].map((n, i) => {
    const [prenom, ...rest] = n.split(" ");
    return { id: "demo" + i, prenom, nom: rest.join(" ") };
  }),
  tasks: [
    ["Apéro", "Cuisine", "En binôme", 1],
    ["Préparer cocktail un soir", "Cuisine", "En binôme", 0],
    ["Préparer un repas", "Cuisine", "En équipe", 3],
    ["Préparer une salade végé", "Cuisine", "En binôme", 2],
    ["Préparer Mocktail", "Cuisine", "En binôme", 0],
    ["Atelier jeux (échecs, dames, belote, palets bretons)", "Sport & Jeux", "En binôme", 1],
    ["Gérer le ballon du match de foot et dossards", "Sport & Jeux", "En binôme", 2],
    ["Gérer la pétanque", "Sport & Jeux", "En binôme", 0],
    ["Projection photos et film", "Technique", "En binôme", 1],
    ["Lumière", "Technique", "En binôme", 1],
    ["Préparer vidéo des meilleurs moments du sport français", "Technique", "En binôme", 1],
    ["Son", "Technique", "En binôme", 0],
    ["Le stop culturel du jour", "Animation", "Seul ou binôme", 0],
    ["Un spectacle (danse, magie, autre)", "Animation", "En binôme", 0],
    ["Assistance vélo / crevaison", "Logistique", "En binôme", 1],
    ["Aller chercher le pain du matin", "Logistique", "Seul ou binôme", 1],
    ["Gérer les tables et chaises / Camionnette", "Logistique", "En équipe", 0],
    ["Chauffeur camionnette", "Logistique", "Seul", 0],
    ["Nettoyer les gamelles", "Logistique", "En binôme", 1],
    ["Gérer 3 glacières, glaçons, café/thé", "Logistique", "En binôme", 0],
    ["S'occuper des torches le soir pour l'After", "Ambiance & Déco", "En binôme", 1],
    ["Décoration", "Ambiance & Déco", "En binôme", 2],
  ].map(([nom, categorie, format, taken], i) => {
    const capacity = format === "En équipe" ? null : format === "Seul" ? 1 : 2;
    return {
      id: "demotask" + i, nom, categorie, format, capacity, taken,
      remaining: capacity === null ? null : Math.max(0, capacity - taken),
      full: capacity !== null && taken >= capacity,
      volontaires: [],
    };
  }),
};

const state = {
  demo: false,
  tasks: [],
  guests: [],
  currentCat: null,
  currentTask: null,
  selectedGuest: null,   // {id, prenom, nom} ou null
  selectedPair: null,
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── Navigation entre écrans ─────────────────────────────────── */
function show(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $("#view-" + view).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.addEventListener("click", (e) => {
  const back = e.target.closest("[data-back]");
  if (back) {
    const dest = back.dataset.back;
    if (dest === "tasks" && state.currentCat) renderTasks(state.currentCat);
    show(dest === "tasks" ? "tasks" : "home");
    if (dest === "home") loadData(true);
  }
});

/* ── Chargement des données ──────────────────────────────────── */
async function loadData(silent) {
  if (!silent) $("#homeLoading").style.display = "block";
  try {
    const resp = await fetch("/.netlify/functions/tasks", { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    state.tasks = data.tasks;
    state.guests = data.guests;
    state.demo = false;
  } catch {
    state.tasks = FIXTURES.tasks;
    state.guests = FIXTURES.guests;
    state.demo = true;
    $("#demoBanner").classList.add("show");
  }
  $("#homeLoading").style.display = "none";
  renderCategories();
}

/* ── Écran 2 · catégories ────────────────────────────────────── */
function renderCategories() {
  const grid = $("#catGrid");
  grid.innerHTML = CATEGORIES.map((cat) => {
    const tasks = state.tasks.filter((t) => t.categorie === cat.name);
    const open = tasks.filter((t) => !t.full).length;
    return `
      <button class="cat-card fade-up" role="listitem" data-cat="${esc(cat.name)}">
        <span class="emoji" aria-hidden="true">${cat.emoji}</span>
        <span class="label">${esc(cat.name)}</span>
        <span class="count">${open > 0 ? open + " mission" + (open > 1 ? "s" : "") + " dispo" : "complet 🎉"}</span>
      </button>`;
  }).join("");
  grid.querySelectorAll(".cat-card").forEach((btn) =>
    btn.addEventListener("click", () => { renderTasks(btn.dataset.cat); show("tasks"); }));
}

/* ── Écran 3 · missions d'une catégorie ──────────────────────── */
function renderTasks(catName) {
  state.currentCat = catName;
  const cat = CATEGORIES.find((c) => c.name === catName);
  $("#taskListTitle").textContent = `${cat ? cat.emoji + " " : ""}${catName}`;
  const tasks = state.tasks.filter((t) => t.categorie === catName);

  $("#taskList").innerHTML = tasks.length === 0
    ? `<p class="muted" style="text-align:center;padding:30px 10px">Aucune mission dans cette catégorie.</p>`
    : tasks.map((t) => {
      const places = t.capacity === null
        ? `équipe · ${t.taken} inscrit${t.taken > 1 ? "s" : ""}`
        : t.full ? "complet" : `${t.remaining} place${t.remaining > 1 ? "s" : ""} restante${t.remaining > 1 ? "s" : ""}`;
      const vols = t.volontaires.length
        ? `<div class="task-vols">Déjà partant${t.volontaires.length > 1 ? "s" : ""} : ${t.volontaires.map(esc).join(", ")}</div>` : "";
      return `
        <article class="task-card ${t.full ? "full" : ""} fade-up">
          <div class="task-top">
            <div>
              <div class="task-name">${esc(t.nom)}</div>
              <div class="task-meta">
                <span class="chip">${esc(t.format)}</span>
                <span class="chip ${t.full ? "complet" : "places"}">${places}</span>
              </div>
              ${vols}
            </div>
            ${t.full ? "" : `<button class="take-btn" data-task="${t.id}">Je prends</button>`}
          </div>
        </article>`;
    }).join("");

  document.querySelectorAll(".take-btn").forEach((btn) =>
    btn.addEventListener("click", () => openForm(btn.dataset.task)));
}

/* ── Écran 4 · formulaire ────────────────────────────────────── */
function openForm(taskId) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t) return;
  state.currentTask = t;
  state.selectedGuest = null;
  state.selectedPair = null;

  $("#formTaskName").textContent = t.nom;
  $("#formTaskMeta").textContent = `${t.categorie} · ${t.format}`;
  $("#claimForm").reset();
  $("#newGuestFields").hidden = true;
  $("#pairField").hidden = true;
  $("#whoHint").textContent = "";
  hideError();

  // Le binôme n'a de sens que s'il reste ≥ 2 places (ou équipe)
  const pairPossible = t.capacity === null || (t.remaining ?? 2) >= 2;
  $("#pairRow").style.display = pairPossible ? "flex" : "none";

  show("form");
  setTimeout(() => $("#whoInput").focus(), 250);
}

function showError(msg) { const b = $("#formError"); b.textContent = msg; b.classList.add("show"); }
function hideError() { $("#formError").classList.remove("show"); }

/* Autocomplete générique sur la liste des invités */
function bindAutocomplete(inputSel, listSel, onPick, allowNew) {
  const input = $(inputSel), list = $(listSel);
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    onPick(null);
    if (q.length < 1) { list.hidden = true; return; }
    const matches = state.guests
      .filter((g) => (g.prenom + " " + g.nom).toLowerCase().includes(q))
      .slice(0, 8);
    let html = matches.map((g) =>
      `<div class="ac-item" data-id="${esc(g.id)}">${esc(g.prenom)} ${esc(g.nom && g.nom !== g.prenom ? g.nom : "")}</div>`).join("");
    if (allowNew) html += `<div class="ac-item" data-id="__new__">✍️ Je ne suis pas dans la liste</div>`;
    list.innerHTML = html;
    list.hidden = html === "";
    list.querySelectorAll(".ac-item").forEach((item) =>
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (item.dataset.id === "__new__") {
          onPick("__new__");
          input.value = input.value.trim();
        } else {
          const g = state.guests.find((x) => x.id === item.dataset.id);
          onPick(g);
          input.value = `${g.prenom} ${g.nom && g.nom !== g.prenom ? g.nom : ""}`.trim();
        }
        list.hidden = true;
      }));
  });
  input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 150));
}

bindAutocomplete("#whoInput", "#acList", (pick) => {
  if (pick === "__new__") {
    state.selectedGuest = null;
    $("#newGuestFields").hidden = false;
    $("#whoHint").textContent = "Pas de souci — indique ton prénom et ton nom ci-dessous.";
    $("#ngPrenom").focus();
  } else {
    state.selectedGuest = pick;
    if (pick) { $("#newGuestFields").hidden = true; $("#whoHint").textContent = "✔ Trouvé dans la liste des invités"; }
    else $("#whoHint").textContent = "";
  }
}, true);

bindAutocomplete("#pairInput", "#acPairList", (pick) => {
  state.selectedPair = pick && pick !== "__new__" ? pick : null;
}, false);

$("#wantPair").addEventListener("change", (e) => {
  $("#pairField").hidden = !e.target.checked;
  if (!e.target.checked) { state.selectedPair = null; $("#pairInput").value = ""; }
});

/* Soumission */
$("#claimForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  const t = state.currentTask;
  if (!t) return;

  const useNew = !$("#newGuestFields").hidden;
  if (!state.selectedGuest && !useNew) {
    showError("Dis-nous qui tu es : choisis ton nom dans la liste, ou « Je ne suis pas dans la liste ».");
    return;
  }
  if (useNew && $("#ngPrenom").value.trim().length < 2) {
    showError("Ton prénom est trop court.");
    return;
  }

  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.textContent = "Enregistrement…";

  const payload = {
    taskId: t.id,
    wantPair: $("#wantPair").checked,
  };
  if (state.selectedGuest) payload.guestId = state.selectedGuest.id;
  else payload.newGuest = { prenom: $("#ngPrenom").value, nom: $("#ngNom").value };
  if (state.selectedPair) payload.pairGuestId = state.selectedPair.id;

  try {
    let result;
    if (state.demo) {
      await new Promise((r) => setTimeout(r, 600)); // simule le réseau
      t.taken += 1 + (state.selectedPair ? 1 : 0);
      t.remaining = t.capacity === null ? null : Math.max(0, t.capacity - t.taken);
      t.full = t.capacity !== null && t.remaining === 0;
      result = { ok: true, pairEnrolled: Boolean(state.selectedPair) };
    } else {
      const resp = await fetch("/.netlify/functions/claim-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Erreur inconnue");
    }

    // Confirmation
    const who = state.selectedGuest
      ? `${state.selectedGuest.prenom} ${state.selectedGuest.nom !== state.selectedGuest.prenom ? state.selectedGuest.nom : ""}`.trim()
      : `${$("#ngPrenom").value.trim()} ${$("#ngNom").value.trim()}`.trim();
    $("#cfTask").textContent = t.nom;
    $("#cfCat").textContent = t.categorie;
    $("#cfWho").textContent = who;
    const pr = $("#cfPairRow");
    if (result.pairEnrolled && state.selectedPair) {
      pr.hidden = false;
      $("#cfPair").textContent = `${state.selectedPair.prenom} ${state.selectedPair.nom}`.trim();
    } else pr.hidden = true;
    show("confirm");
  } catch (err) {
    showError(err.message || "L'inscription a échoué. Réessaie dans un instant.");
    if (!state.demo) loadData(true); // re-synchronise les places (double-booking)
  } finally {
    btn.disabled = false;
    btn.textContent = "👉 Je confirme ma mission";
  }
});

loadData(false);
