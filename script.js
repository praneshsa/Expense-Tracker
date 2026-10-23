/* ==========================================================
   Expense Tracker — script.js
   Features: add / edit / delete, income & expense, filters,
   doughnut chart (plain canvas), saved in localStorage.
   ========================================================== */

const STORAGE_KEY = "expense-tracker-transactions";

const CATEGORIES = [
  { name: "Food",          icon: "🍔", color: "#12b886" },
  { name: "Transport",     icon: "🚗", color: "#5b5bd6" },
  { name: "Shopping",      icon: "🛍️", color: "#f59f00" },
  { name: "Entertainment", icon: "🎬", color: "#e03131" },
  { name: "Bills",         icon: "💡", color: "#1c7ed6" },
  { name: "Health",        icon: "💊", color: "#d6336c" },
  { name: "Education",     icon: "📚", color: "#7048e8" },
  { name: "Salary",        icon: "💼", color: "#2f9e44" },
  { name: "Other",         icon: "📦", color: "#868e96" }
];

/* ---------- State ---------- */
let transactions = loadTransactions();
let editingId = null;

/* ---------- DOM ---------- */
const form            = document.getElementById("transactionForm");
const descriptionEl   = document.getElementById("description");
const amountEl        = document.getElementById("amount");
const categoryEl      = document.getElementById("category");
const dateEl          = document.getElementById("date");
const submitBtn       = document.getElementById("submitBtn");
const cancelEditBtn   = document.getElementById("cancelEditBtn");
const formTitle       = document.getElementById("formTitle");
const formError       = document.getElementById("formError");
const filterCategory  = document.getElementById("filterCategory");
const filterType      = document.getElementById("filterType");
const listEl          = document.getElementById("transactionList");
const listEmpty       = document.getElementById("listEmpty");
const clearAllBtn     = document.getElementById("clearAllBtn");
const chartCanvas     = document.getElementById("categoryChart");
const chartEmpty      = document.getElementById("chartEmpty");
const legendEl        = document.getElementById("chartLegend");

/* ---------- Storage ---------- */
function loadTransactions() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    console.error("Could not save transactions:", err);
  }
}

/* ---------- Helpers ---------- */
function getCategory(name) {
  return CATEGORIES.find(c => c.name === name) || CATEGORIES[CATEGORIES.length - 1];
}

function formatMoney(value) {
  return "$" + Number(value).toFixed(2);
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function selectedType() {
  return form.querySelector('input[name="type"]:checked').value;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}

/* ---------- Setup ---------- */
function populateCategories() {
  categoryEl.innerHTML = CATEGORIES
    .map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`)
    .join("");

  filterCategory.innerHTML =
    `<option value="all">All Categories</option>` +
    CATEGORIES.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
}

/* ---------- Add / edit / delete ---------- */
function handleSubmit(event) {
  event.preventDefault();

  const description = descriptionEl.value.trim();
  const amount = parseFloat(amountEl.value);
  const category = categoryEl.value;
  const date = dateEl.value || todayISO();
  const type = selectedType();

  if (!description) {
    showError("Enter a description.");
    descriptionEl.focus();
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    showError("Enter an amount greater than 0.");
    amountEl.focus();
    return;
  }
  showError("");

  if (editingId) {
    const tx = transactions.find(t => t.id === editingId);
    if (tx) Object.assign(tx, { description, amount, category, date, type });
  } else {
    transactions.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      description, amount, category, date, type
    });
  }

  saveTransactions();
  resetForm();
  render();
}

function startEdit(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  editingId = id;
  descriptionEl.value = tx.description;
  amountEl.value = tx.amount;
  categoryEl.value = tx.category;
  dateEl.value = tx.date;
  form.querySelector(`input[name="type"][value="${tx.type}"]`).checked = true;

  formTitle.textContent = "✏️ Edit transaction";
  submitBtn.textContent = "Update";
  cancelEditBtn.hidden = false;
  showError("");
  descriptionEl.focus();
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  renderList();
}

function resetForm() {
  editingId = null;
  form.reset();
  dateEl.value = todayISO();
  formTitle.textContent = "➕ Add transaction";
  submitBtn.textContent = "+ Add";
  cancelEditBtn.hidden = true;
  showError("");
}

function deleteTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  if (!confirm(`Delete "${tx.description}"?`)) return;

  transactions = transactions.filter(t => t.id !== id);
  if (editingId === id) resetForm();
  saveTransactions();
  render();
}

function clearAll() {
  if (transactions.length === 0) return;
  if (!confirm("Delete all transactions? This can't be undone.")) return;

  transactions = [];
  resetForm();
  saveTransactions();
  render();
}

/* ---------- Rendering ---------- */
function render() {
  renderSummary();
  renderList();
  renderChart();
}

function renderSummary() {
  const income = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  document.getElementById("totalIncome").textContent = formatMoney(income);
  document.getElementById("totalExpenses").textContent = formatMoney(expenses);
  document.getElementById("totalBalance").textContent = formatMoney(income - expenses);
  document.getElementById("transactionCount").textContent = transactions.length;
}

function renderList() {
  const catFilter = filterCategory.value;
  const typeFilter = filterType.value;

  const visible = transactions.filter(t =>
    (catFilter === "all" || t.category === catFilter) &&
    (typeFilter === "all" || t.type === typeFilter)
  );

  listEl.innerHTML = visible.map(t => {
    const sign = t.type === "expense" ? "-" : "+";
    const typeLabel = t.type === "expense" ? "Expense" : "Income";
    return `
      <li class="tx-item${t.id === editingId ? " editing" : ""}">
        <div>
          <div class="tx-title">${escapeHTML(t.description)}</div>
          <div class="tx-meta">
            <span class="tx-cat">${getCategory(t.category).icon} ${escapeHTML(t.category)}</span>
            <span>${formatDate(t.date)}</span>
            <span>${typeLabel}</span>
          </div>
        </div>
        <span class="tx-amount ${t.type}">${sign}${formatMoney(t.amount)}</span>
        <div class="tx-actions">
          <button class="icon-btn" data-action="edit" data-id="${t.id}" aria-label="Edit ${escapeHTML(t.description)}">✏️</button>
          <button class="icon-btn" data-action="delete" data-id="${t.id}" aria-label="Delete ${escapeHTML(t.description)}">✕</button>
        </div>
      </li>`;
  }).join("");

  if (visible.length === 0) {
    listEmpty.hidden = false;
    listEmpty.textContent = transactions.length === 0
      ? "No transactions yet. Add your first one."
      : "No transactions match these filters.";
  } else {
    listEmpty.hidden = true;
  }
}

/* ---------- Chart (plain canvas doughnut) ---------- */
function renderChart() {
  const totals = {};
  transactions
    .filter(t => t.type === "expense")
    .forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const grandTotal = entries.reduce((sum, [, v]) => sum + v, 0);

  const size = 260;
  const dpr = window.devicePixelRatio || 1;
  chartCanvas.width = size * dpr;
  chartCanvas.height = size * dpr;
  chartCanvas.style.width = size + "px";
  chartCanvas.style.height = size + "px";

  const ctx = chartCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  if (entries.length === 0) {
    chartCanvas.hidden = true;
    chartEmpty.hidden = false;
    legendEl.innerHTML = "";
    return;
  }

  chartCanvas.hidden = false;
  chartEmpty.hidden = true;

  const cx = size / 2;
  const cy = size / 2;
  const outer = 110;
  const inner = 70;
  const mid = (outer + inner) / 2;
  let start = -Math.PI / 2;

  ctx.lineWidth = outer - inner;
  entries.forEach(([name, value]) => {
    const slice = (value / grandTotal) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = getCategory(name).color;
    ctx.arc(cx, cy, mid, start, start + slice);
    ctx.stroke();
    start += slice;
  });

  // Centre label
  ctx.fillStyle = getComputedStyle(document.body).color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 12px 'Segoe UI', sans-serif";
  ctx.fillText("Total spent", cx, cy - 12);
  ctx.font = "700 18px 'Segoe UI', sans-serif";
  ctx.fillText(formatMoney(grandTotal), cx, cy + 10);

  legendEl.innerHTML = entries.map(([name, value]) => `
    <li>
      <span class="swatch" style="background:${getCategory(name).color}"></span>
      ${escapeHTML(name)}
      <span class="amt">${formatMoney(value)} (${Math.round((value / grandTotal) * 100)}%)</span>
    </li>`).join("");
}

/* ---------- Events ---------- */
form.addEventListener("submit", handleSubmit);
cancelEditBtn.addEventListener("click", () => { resetForm(); renderList(); });
clearAllBtn.addEventListener("click", clearAll);
filterCategory.addEventListener("change", renderList);
filterType.addEventListener("change", renderList);

// One listener for every edit/delete button (event delegation)
listEl.addEventListener("click", event => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === "edit") startEdit(id);
  if (action === "delete") deleteTransaction(id);
});

/* ---------- Init ---------- */
populateCategories();
dateEl.value = todayISO();
render();