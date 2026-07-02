/* App relance RSVP — Erwan Sixty 60 Tour.
   Externalisé (pas d'inline) : la CSP du site n'autorise que script-src 'self'. */
"use strict";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = { reponse: null, guests: [], selectedGuest: null, demo: false };
const LABELS = { oui: "🎉 Oui, je viens !", peutetre: "🤔 Je ne sais pas encore", non: "😢 Non, je ne peux pas" };

function show(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $("#view-" + id).classList.add("active");
  window.scrollTo(0, 0);
}

fetch("/.netlify/functions/rsvp")
  .then((r) => { if (!r.ok) throw 0; return r.json(); })
  .then((d) => { state.guests = d.guests; })
  .catch(() => { state.demo = true; });

document.querySelectorAll(".answer").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.reponse = btn.dataset.reponse;
    $("#chosenLabel").textContent = LABELS[state.reponse];
    show("form");
    setTimeout(() => $("#whoInput").focus(), 200);
  }));
document.querySelector("[data-back]").addEventListener("click", () => show("answer"));

const input = $("#whoInput"), list = $("#acList");
input.addEventListener("input", () => {
  state.selectedGuest = null;
  $("#newGuestFields").hidden = true;
  $("#whoHint").textContent = "";
  const q = input.value.trim().toLowerCase();
  if (q.length < 1) { list.hidden = true; return; }
  const matches = state.guests
    .filter((g) => (g.prenom + " " + g.nom).toLowerCase().includes(q)).slice(0, 8);
  let html = matches.map((g) =>
    `<div class="ac-item" data-id="${esc(g.id)}">${esc(g.prenom)} ${esc(g.nom !== g.prenom ? g.nom : "")}</div>`).join("");
  html += `<div class="ac-item" data-id="__new__">✍️ Je ne suis pas dans la liste</div>`;
  list.innerHTML = html;
  list.hidden = false;
  list.querySelectorAll(".ac-item").forEach((item) =>
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (item.dataset.id === "__new__") {
        $("#newGuestFields").hidden = false;
        $("#whoHint").textContent = "Pas de souci — ajoute ton nom ci-dessous.";
      } else {
        const g = state.guests.find((x) => x.id === item.dataset.id);
        state.selectedGuest = g;
        input.value = `${g.prenom} ${g.nom !== g.prenom ? g.nom : ""}`.trim();
        $("#whoHint").textContent = "✔ Trouvé dans la liste des invités";
      }
      list.hidden = true;
    }));
});
input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 150));

function showError(m) { const b = $("#formError"); b.textContent = m; b.classList.add("show"); }

$("#rsvpForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#formError").classList.remove("show");

  const phone = $("#phoneInput").value.trim();
  if (phone.replace(/\D/g, "").length < 8) { showError("Ton numéro de téléphone semble incomplet."); return; }
  if (!state.selectedGuest && input.value.trim().length < 2) { showError("Dis-nous qui tu es 😉"); return; }

  const payload = { reponse: state.reponse, phone };
  if (state.selectedGuest) payload.guestId = state.selectedGuest.id;
  else payload.newGuest = { prenom: input.value.trim(), nom: $("#ngNom").value.trim() };

  const btn = $("#submitBtn");
  btn.disabled = true; btn.textContent = "Envoi…";
  try {
    if (!state.demo) {
      const resp = await fetch("/.netlify/functions/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Erreur inconnue");
    }
    const done = {
      oui: ["🎉", "C'est noté, à très vite !", "Erwan est ravi — rendez-vous le 28 juillet à Sarzeau. Pense à choisir ta mission coup de main !"],
      peutetre: ["🤞", "C'est noté !", "Erwan croise les doigts — tiens-le au courant dès que tu sais."],
      non: ["💙", "Merci d'avoir répondu", "Tu vas manquer au 60 Tour… mais Erwan pense bien à toi."],
    }[state.reponse];
    $("#doneEmoji").textContent = done[0];
    $("#doneTitle").textContent = done[1];
    $("#doneNote").textContent = done[2];
    show("done");
  } catch (err) {
    showError(err.message || "L'envoi a échoué. Réessaie dans un instant.");
  } finally {
    btn.disabled = false; btn.textContent = "J'envoie ma réponse →";
  }
});
