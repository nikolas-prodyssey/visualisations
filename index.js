// Use the global dscc object provided by Looker Studio at runtime.
const dscc = window.dscc;

// Basic currency formatter (you can localize later via style controls)
function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "";
  // default to EUR; change to "USD" if you prefer, or read from style later
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

// If due_date comes as Date object / epoch / string, normalize to "MMM dd, yyyy"
function fmtDate(v) {
  try {
    if (v == null || v === "") return "";
    const d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v); // keep original if not parseable
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return String(v);
  }
}

function draw(data) {
  const root = document.getElementById("root");
  root.innerHTML = "";

  // Field descriptors
  // We assume: DIM0 = contact_name, DIM1 = due_date, DIM2 = link
  // Optional extra dims can exist after that.
  const dims = data.fields.DIMENSION || [];
  const mets = data.fields.METRIC || [];

  if (dims.length < 3 || mets.length < 1) {
    root.textContent = "Please bind 3 dimensions (contact_name, due_date, link) and 1 metric (amount_due).";
    return;
  }

  const CONTACT_ID = dims[0].id;
  const DUEDATE_ID  = dims[1].id;
  const LINK_ID     = dims[2].id;

  // Optional bank fields if provided
  const BANK_NAME_ID   = dims[3] ? dims[3].id : null;
  const BANK_NUMBER_ID = dims[4] ? dims[4].id : null;

  const AMOUNT_ID  = mets[0].id;

  // Extract rows
  let rows = data.tables.DEFAULT || [];

  // Sort rows by contact_name then due_date asc (string/date tolerant)
  rows.sort((a, b) => {
    const cA = (a[CONTACT_ID] ?? "").toString().localeCompare((b[CONTACT_ID] ?? "").toString(), undefined, { sensitivity: "base" });
    if (cA !== 0) return cA;

    const dA = new Date(a[DUEDATE_ID]);
    const dB = new Date(b[DUEDATE_ID]);
    const nA = isNaN(dA) ? 0 : dA.getTime();
    const nB = isNaN(dB) ? 0 : dB.getTime();
    return nA - nB;
  });

  // Group by contact_name
  const groups = new Map();
  for (const r of rows) {
    const contact = r[CONTACT_ID] ?? "";
    if (!groups.has(contact)) groups.set(contact, []);
    groups.get(contact).push(r);
  }

  // Build DOM
  groups.forEach((groupRows, contact) => {
    const total = groupRows.reduce((acc, r) => acc + (parseFloat(r[AMOUNT_ID]) || 0), 0);

    const block = document.createElement("div");
    block.className = "vendor-block";

    const header = document.createElement("div");
    header.className = "vendor-header";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "vendor-name";
    name.textContent = contact;
    left.appendChild(name);

    if (BANK_NAME_ID || BANK_NUMBER_ID) {
      // Show optional bank info under the header if available (from the first row)
      const r0 = groupRows[0];
      const bankName = BANK_NAME_ID ? (r0[BANK_NAME_ID] ?? "") : "";
      const bankNo   = BANK_NUMBER_ID ? (r0[BANK_NUMBER_ID] ?? "") : "";
      if (bankName || bankNo) {
        const sub = document.createElement("div");
        sub.className = "subtle";
        sub.textContent = [bankName, bankNo].filter(Boolean).join(" • ");
        left.appendChild(sub);
      }
    }

    const right = document.createElement("div");
    right.className = "vendor-total";
    right.textContent = fmtCurrency(total);

    header.appendChild(left);
    header.appendChild(right);
    block.appendChild(header);

    // Rows
    for (const r of groupRows) {
      const row = document.createElement("div");
      row.className = "row";

      const date = document.createElement("div");
      date.className = "date";
      date.textContent = fmtDate(r[DUEDATE_ID]);

      const link = document.createElement("div");
      link.className = "link";
      const a = document.createElement("a");
      a.href = String(r[LINK_ID] ?? "#");
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = String(r[LINK_ID] ?? "");
      link.appendChild(a);

      const amount = document.createElement("div");
      amount.className = "amount";
      amount.textContent = fmtCurrency(parseFloat(r[AMOUNT_ID]));

      row.appendChild(date);
      row.appendChild(link);
      row.appendChild(amount);
      block.appendChild(row);
    }

    root.appendChild(block);
  });

  if (groups.size === 0) {
    root.textContent = "No rows to display.";
  }
}

// Subscribe using the objectTransform so rows look like plain objects
dscc.subscribeToData(draw, { transform: dscc.objectTransform });
