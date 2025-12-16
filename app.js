/*
  Einfache Ticket-Demo ohne Backend.
  Persistenz: localStorage.
*/

const STORAGE_KEY = "ticket_ui_demo_v1";

const Status = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  waiting: "Wartet",
  resolved: "Gelöst",
  closed: "Geschlossen",
};

const PriorityRank = { p1: 4, p2: 3, p3: 2, p4: 1 };

function isoNow() {
  return new Date().toISOString();
}

function formatDateTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadgeClass(status) {
  if (status === "resolved") return "badge badge--success";
  if (status === "in_progress" || status === "waiting") return "badge badge--warning";
  if (status === "open") return "badge badge--error";
  return "badge badge--inactive";
}

function defaultTickets() {
  const now = Date.now();
  const minutesAgo = (m) => new Date(now - m * 60_000).toISOString();
  const hoursAgo = (h) => new Date(now - h * 3_600_000).toISOString();
  const daysAgo = (d) => new Date(now - d * 86_400_000).toISOString();

  return [
    {
      id: "TCK-1042",
      title: "Login fehlgeschlagen nach Passwort-Reset",
      customer: "Meyer GmbH",
      priority: "p1",
      status: "open",
      owner: "Support L1",
      createdAt: daysAgo(1),
      updatedAt: minutesAgo(18),
      sla: "4h Erstreaktion",
      tags: ["auth", "prod"],
      description: "Mehrere Benutzer erhalten nach Passwort-Reset weiterhin \"Ungültige Anmeldedaten\". Bitte Logs prüfen.",
    },
    {
      id: "TCK-1041",
      title: "Rechnungs-PDF wird leer erzeugt",
      customer: "Nordlicht AG",
      priority: "p2",
      status: "in_progress",
      owner: "Backoffice",
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(2),
      sla: "8h Erstreaktion",
      tags: ["billing"],
      description: "Beim Export von Rechnungen (Format PDF) kommt eine Datei ohne Inhalt. Betrifft mehrere IDs.",
    },
    {
      id: "TCK-1039",
      title: "Feature-Anfrage: CSV-Export mit zusätzlicher Spalte",
      customer: "Kaufmann KG",
      priority: "p4",
      status: "waiting",
      owner: "Produkt",
      createdAt: daysAgo(6),
      updatedAt: daysAgo(1),
      sla: "—",
      tags: ["feature", "export"],
      description: "Kunde wünscht im CSV-Export eine zusätzliche Spalte \"Kostenstelle\".",
    },
    {
      id: "TCK-1035",
      title: "Antwortzeiten in der UI sporadisch hoch",
      customer: "Stadtwerke Süd",
      priority: "p2",
      status: "resolved",
      owner: "SRE",
      createdAt: daysAgo(9),
      updatedAt: daysAgo(2),
      sla: "8h Erstreaktion",
      tags: ["performance"],
      description: "Monitoring zeigt Peaks bei API-Latenz. Nach Cache-Tuning aktuell stabil.",
    },
    {
      id: "TCK-1028",
      title: "Account schließen",
      customer: "Beispielkunde",
      priority: "p3",
      status: "closed",
      owner: "Support L1",
      createdAt: daysAgo(21),
      updatedAt: daysAgo(14),
      sla: "—",
      tags: ["account"],
      description: "Kunde bittet um Schließung des Accounts inkl. Datenexport.",
    },
  ];
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tickets: defaultTickets(), selectedId: null };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tickets)) throw new Error("bad state");
    return {
      tickets: parsed.tickets,
      selectedId: parsed.selectedId ?? null,
    };
  } catch {
    return { tickets: defaultTickets(), selectedId: null };
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ tickets: state.tickets, selectedId: state.selectedId })
  );
}

const state = loadState();

const el = {
  ticketCount: document.getElementById("ticketCount"),
  rows: document.getElementById("ticketRows"),

  q: document.getElementById("q"),
  statusFilter: document.getElementById("statusFilter"),
  priorityFilter: document.getElementById("priorityFilter"),
  sortBy: document.getElementById("sortBy"),
  reset: document.getElementById("resetFilters"),

  detailTitle: document.getElementById("detailTitle"),
  detailSub: document.getElementById("detailSub"),
  detailEmpty: document.getElementById("detailEmpty"),
  detailBody: document.getElementById("detailBody"),

  detailStatus: document.getElementById("detailStatus"),
  detailPriority: document.getElementById("detailPriority"),
  detailOwner: document.getElementById("detailOwner"),
  detailCustomer: document.getElementById("detailCustomer"),
  detailCreated: document.getElementById("detailCreated"),
  detailUpdated: document.getElementById("detailUpdated"),
  detailSla: document.getElementById("detailSla"),
  detailTags: document.getElementById("detailTags"),
  detailDescription: document.getElementById("detailDescription"),

  detailStatusSelect: document.getElementById("detailStatusSelect"),
  detailOwnerInput: document.getElementById("detailOwnerInput"),
  saveDetail: document.getElementById("saveDetail"),
  copyLink: document.getElementById("copyLink"),

  openCreate: document.getElementById("openCreate"),
  createOverlay: document.getElementById("createOverlay"),
  closeCreate: document.getElementById("closeCreate"),
  cancelCreate: document.getElementById("cancelCreate"),
  createForm: document.getElementById("createForm"),
  newTitle: document.getElementById("newTitle"),
  newCustomer: document.getElementById("newCustomer"),
  newPriority: document.getElementById("newPriority"),
  newStatus: document.getElementById("newStatus"),
  newDescription: document.getElementById("newDescription"),
};

function normalize(s) {
  return String(s ?? "").toLowerCase();
}

function getFilters() {
  return {
    q: el.q.value.trim(),
    status: el.statusFilter.value,
    priority: el.priorityFilter.value,
    sortBy: el.sortBy.value,
  };
}

function applySort(list, sortBy) {
  const byUpdated = (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt);
  const byPriority = (a, b) => (PriorityRank[a.priority] ?? 0) - (PriorityRank[b.priority] ?? 0);

  const copy = [...list];
  switch (sortBy) {
    case "updated_asc":
      copy.sort(byUpdated);
      break;
    case "updated_desc":
      copy.sort((a, b) => byUpdated(b, a));
      break;
    case "priority_asc":
      copy.sort(byPriority);
      break;
    case "priority_desc":
      copy.sort((a, b) => byPriority(b, a));
      break;
    default:
      copy.sort((a, b) => byUpdated(b, a));
  }
  return copy;
}

function filteredTickets() {
  const { q, status, priority, sortBy } = getFilters();
  const qn = normalize(q);

  const filtered = state.tickets.filter((t) => {
    const matchQ =
      !qn ||
      normalize(t.id).includes(qn) ||
      normalize(t.title).includes(qn) ||
      normalize(t.customer).includes(qn) ||
      normalize(t.owner).includes(qn);

    const matchStatus = !status || t.status === status;
    const matchPriority = !priority || t.priority === priority;

    return matchQ && matchStatus && matchPriority;
  });

  return applySort(filtered, sortBy);
}

function renderTable() {
  const list = filteredTickets();
  el.ticketCount.textContent = `${list.length} Treffer`;

  el.rows.innerHTML = "";

  for (const t of list) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.setAttribute("aria-label", `Ticket ${t.id} öffnen`);

    tr.addEventListener("click", () => selectTicket(t.id));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectTicket(t.id);
      }
    });

    const cells = [
      t.id,
      t.title,
      t.customer,
      t.priority.toUpperCase(),
      null,
      t.owner,
      formatDateTime(t.updatedAt),
    ];

    for (let i = 0; i < cells.length; i += 1) {
      const td = document.createElement("td");
      if (i === 4) {
        const badge = document.createElement("span");
        badge.className = statusBadgeClass(t.status);
        badge.textContent = Status[t.status] ?? t.status;
        td.appendChild(badge);
      } else {
        td.textContent = String(cells[i]);
      }
      tr.appendChild(td);
    }

    el.rows.appendChild(tr);
  }
}

function findTicket(id) {
  return state.tickets.find((t) => t.id === id) ?? null;
}

function setDetailVisible(visible) {
  el.detailBody.hidden = !visible;
  el.detailEmpty.hidden = visible;
}

function renderDetail() {
  const t = state.selectedId ? findTicket(state.selectedId) : null;
  if (!t) {
    el.detailTitle.textContent = "Details";
    el.detailSub.textContent = "Wähle ein Ticket aus der Liste.";
    setDetailVisible(false);
    return;
  }

  el.detailTitle.textContent = `${t.id}: ${t.title}`;
  el.detailSub.textContent = "Ticket-Übersicht";

  el.detailStatus.className = statusBadgeClass(t.status);
  el.detailStatus.textContent = Status[t.status] ?? t.status;

  el.detailPriority.textContent = t.priority.toUpperCase();
  el.detailOwner.textContent = t.owner;
  el.detailCustomer.textContent = t.customer;
  el.detailCreated.textContent = formatDateTime(t.createdAt);
  el.detailUpdated.textContent = formatDateTime(t.updatedAt);
  el.detailSla.textContent = t.sla || "—";
  el.detailTags.textContent = (t.tags && t.tags.length ? t.tags.join(", ") : "—");
  el.detailDescription.textContent = t.description || "—";

  el.detailStatusSelect.value = t.status;
  el.detailOwnerInput.value = t.owner;

  setDetailVisible(true);
}

function selectTicket(id) {
  state.selectedId = id;
  saveState();
  renderDetail();
}

function nextId() {
  const prefix = "TCK-";
  const nums = state.tickets
    .map((t) => (t.id.startsWith(prefix) ? Number(t.id.slice(prefix.length)) : NaN))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return `${prefix}${max + 1}`;
}

function openCreate() {
  el.createOverlay.hidden = false;
  el.newTitle.value = "";
  el.newCustomer.value = "";
  el.newPriority.value = "p2";
  el.newStatus.value = "open";
  el.newDescription.value = "";
  el.newTitle.focus();
}

function closeCreate() {
  el.createOverlay.hidden = true;
}

function upsertTicket(updated) {
  const idx = state.tickets.findIndex((t) => t.id === updated.id);
  if (idx >= 0) state.tickets[idx] = updated;
  else state.tickets.unshift(updated);
  saveState();
}

function handleCreateSubmit(e) {
  e.preventDefault();
  const id = nextId();
  const now = isoNow();

  const ticket = {
    id,
    title: el.newTitle.value.trim(),
    customer: el.newCustomer.value.trim(),
    priority: el.newPriority.value,
    status: el.newStatus.value,
    owner: "Unassigned",
    createdAt: now,
    updatedAt: now,
    sla: el.newPriority.value === "p1" ? "4h Erstreaktion" : "8h Erstreaktion",
    tags: [],
    description: el.newDescription.value.trim(),
  };

  upsertTicket(ticket);
  closeCreate();
  renderTable();
  selectTicket(ticket.id);
}

function handleSaveDetail() {
  const t = state.selectedId ? findTicket(state.selectedId) : null;
  if (!t) return;

  const next = {
    ...t,
    status: el.detailStatusSelect.value,
    owner: el.detailOwnerInput.value.trim() || "Unassigned",
    updatedAt: isoNow(),
  };

  upsertTicket(next);
  renderTable();
  renderDetail();
}

async function handleCopyLink() {
  const t = state.selectedId ? findTicket(state.selectedId) : null;
  if (!t) return;

  const url = new URL(window.location.href);
  url.hash = `ticket=${encodeURIComponent(t.id)}`;

  try {
    await navigator.clipboard.writeText(url.toString());
    el.copyLink.textContent = "Kopiert";
    window.setTimeout(() => {
      el.copyLink.textContent = "Link kopieren";
    }, 900);
  } catch {
    // Fallback: keine zusätzliche UI-Farbe/Toast (Design-Regel: zurückhaltend)
    prompt("Link kopieren:", url.toString());
  }
}

function syncFromHash() {
  const hash = window.location.hash || "";
  const m = hash.match(/ticket=([^&]+)/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  if (findTicket(id)) selectTicket(id);
}

function wireEvents() {
  const rerender = () => {
    renderTable();
    renderDetail();
  };

  el.q.addEventListener("input", () => renderTable());
  el.statusFilter.addEventListener("change", () => renderTable());
  el.priorityFilter.addEventListener("change", () => renderTable());
  el.sortBy.addEventListener("change", () => renderTable());

  el.reset.addEventListener("click", () => {
    el.q.value = "";
    el.statusFilter.value = "";
    el.priorityFilter.value = "";
    el.sortBy.value = "updated_desc";
    renderTable();
  });

  el.openCreate.addEventListener("click", openCreate);
  el.closeCreate.addEventListener("click", closeCreate);
  el.cancelCreate.addEventListener("click", closeCreate);
  el.createOverlay.addEventListener("click", (e) => {
    if (e.target === el.createOverlay) closeCreate();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.createOverlay.hidden) closeCreate();
  });

  el.createForm.addEventListener("submit", handleCreateSubmit);

  el.saveDetail.addEventListener("click", handleSaveDetail);
  el.copyLink.addEventListener("click", handleCopyLink);

  window.addEventListener("hashchange", syncFromHash);

  rerender();
  syncFromHash();
}

wireEvents();
