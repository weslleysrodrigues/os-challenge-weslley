async function loadDashboardData() {
  try {
    const salesResponse = await fetch("./data/sales.json");
    const inquiriesResponse = await fetch("./data/inquiries.json");

    const sales = await salesResponse.json();
    const inquiries = await inquiriesResponse.json();

    renderDashboard(sales, inquiries);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    document.body.innerHTML = `
      <main class="page">
        <div class="panel">
          <h1>Dashboard could not load</h1>
          <p>Please check if sales.json and inquiries.json exist inside the data folder.</p>
        </div>
      </main>
    `;
  }
}

function getRevenue(sale) {
  return Number(
    sale.revenue ||
    sale.totalRevenue ||
    sale.total ||
    sale.amount ||
    sale.value ||
    0
  );
}

function getRegion(item) {
  return (
    item.region ||
    item.market ||
    item.state ||
    item.location ||
    "Unknown"
  );
}

function getStatus(inquiry) {
  return inquiry.status || inquiry.stage || "Unknown";
}

function getCompany(inquiry) {
  return (
    inquiry.company ||
    inquiry.customer ||
    inquiry.account ||
    inquiry.name ||
    "Unknown"
  );
}

function getPriority(inquiry) {
  return inquiry.priority || inquiry.urgency || "Normal";
}

function renderDashboard(sales, inquiries) {
  const totalRevenue = sales.reduce((sum, sale) => sum + getRevenue(sale), 0);
  const totalSales = sales.length;

  const newInquiries = inquiries.filter((inquiry) => {
    const status = String(getStatus(inquiry)).toLowerCase();
    return status === "new";
  }).length;

  const revenueByRegion = groupRevenueByRegion(sales);
  const inquiriesByStatus = groupInquiriesByStatus(inquiries);

  const topRegion =
    Object.entries(revenueByRegion).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "No data";

  document.getElementById("totalRevenue").textContent =
    "$" + Math.round(totalRevenue).toLocaleString();

  document.getElementById("totalSales").textContent =
    totalSales.toLocaleString();

  document.getElementById("newInquiries").textContent =
    newInquiries.toLocaleString();

  document.getElementById("topRegion").textContent = topRegion;

  renderBarChart("revenueByRegion", revenueByRegion, "$");
  renderBarChart("inquiriesByStatus", inquiriesByStatus, "");
  renderOperatorNotes({
    totalRevenue,
    totalSales,
    newInquiries,
    topRegion,
    revenueByRegion,
    inquiriesByStatus
  });
  renderRecentInquiries(inquiries);
  renderTriageWorkflow(inquiries);
}

function groupRevenueByRegion(sales) {
  const regionMap = {};

  sales.forEach((sale) => {
    const region = getRegion(sale);
    const revenue = getRevenue(sale);

    regionMap[region] = (regionMap[region] || 0) + revenue;
  });

  return regionMap;
}

function groupInquiriesByStatus(inquiries) {
  const statusMap = {};

  inquiries.forEach((inquiry) => {
    const status = getStatus(inquiry);
    statusMap[status] = (statusMap[status] || 0) + 1;
  });

  return statusMap;
}

function renderBarChart(elementId, data, prefix) {
  const container = document.getElementById(elementId);
  container.innerHTML = "";

  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const maxValue = Math.max(...entries.map((entry) => entry[1]), 1);

  entries.forEach(([label, value]) => {
    const width = (value / maxValue) * 100;

    const row = document.createElement("div");
    row.className = "bar-row";

    row.innerHTML = `
      <div class="bar-label">${label}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${width}%"></div>
      </div>
      <div class="bar-value">${prefix}${Math.round(value).toLocaleString()}</div>
    `;

    container.appendChild(row);
  });
}

function renderOperatorNotes(data) {
  const notes = document.getElementById("operatorNotes");

  const averageSale =
    data.totalSales > 0 ? data.totalRevenue / data.totalSales : 0;

  const busiestStatus =
    Object.entries(data.inquiriesByStatus).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "No inquiry status";

  notes.innerHTML = `
    <div class="note">
      <strong>${data.newInquiries} new inquiries</strong> are waiting for review. These should be checked first during daily triage.
    </div>

    <div class="note">
      <strong>${data.topRegion}</strong> is currently the strongest revenue region. Operators should prioritize high-quality inquiries from this region.
    </div>

    <div class="note">
      Average sale value is <strong>$${Math.round(averageSale).toLocaleString()}</strong>. This can be used as a benchmark when reviewing new opportunities.
    </div>

    <div class="note">
      The busiest inquiry status is <strong>${busiestStatus}</strong>. This helps identify where the workflow may be getting backed up.
    </div>
  `;
}

function renderRecentInquiries(inquiries) {
  const tbody = document.getElementById("recentInquiries");
  tbody.innerHTML = "";

  const recentInquiries = [...inquiries].slice(0, 6);

  recentInquiries.forEach((inquiry) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${getCompany(inquiry)}</td>
      <td>${getRegion(inquiry)}</td>
      <td>${getStatus(inquiry)}</td>
      <td>${getPriority(inquiry)}</td>
    `;

    tbody.appendChild(row);
  });
}
function getInquiryId(inquiry, index) {
  return String(
    inquiry.id ||
    inquiry.inquiryId ||
    inquiry.email ||
    inquiry.company ||
    inquiry.customer ||
    `inquiry-${index}`
  );
}

function getInquiryText(inquiry) {
  return JSON.stringify(inquiry).toLowerCase();
}

function classifyInquiry(inquiry) {
  const text = getInquiryText(inquiry);
  const priority = String(getPriority(inquiry)).toLowerCase();
  const status = String(getStatus(inquiry)).toLowerCase();

  const hotSignals = [
    "high",
    "urgent",
    "enterprise",
    "large",
    "bulk",
    "wholesale",
    "asap",
    "immediately",
    "rush"
  ];

  const warmSignals = [
    "medium",
    "new",
    "open",
    "interested",
    "quote",
    "pricing"
  ];

  const hasHotSignal = hotSignals.some((signal) => {
    return text.includes(signal) || priority.includes(signal);
  });

  if (hasHotSignal) {
    return {
      level: "hot",
      label: "Hot",
      reason: "High-priority or urgent wholesale opportunity. Review first."
    };
  }

  const hasWarmSignal = warmSignals.some((signal) => {
    return text.includes(signal) || priority.includes(signal) || status.includes(signal);
  });

  if (hasWarmSignal) {
    return {
      level: "warm",
      label: "Warm",
      reason: "Active or qualified inquiry with buying intent. Review after hot leads."
    };
  }

  return {
    level: "cold",
    label: "Cold",
    reason: "Lower urgency or less complete inquiry. Review after higher-priority items."
  };
}

function getContactedState() {
  const saved = localStorage.getItem("contactedInquiries");

  if (!saved) {
    return {};
  }

  try {
    return JSON.parse(saved);
  } catch (error) {
    return {};
  }
}

function saveContactedState(contactedState) {
  localStorage.setItem("contactedInquiries", JSON.stringify(contactedState));
}

function markInquiryAsContacted(inquiryId) {
  const contactedState = getContactedState();

  contactedState[inquiryId] = {
    contacted: true,
    contactedAt: new Date().toISOString()
  };

  saveContactedState(contactedState);
  renderTriageWorkflow(window.currentInquiries || []);
}

function buildTriageItems(inquiries) {
  return inquiries.map((inquiry, index) => {
    const id = getInquiryId(inquiry, index);
    const classification = classifyInquiry(inquiry);

    return {
      id,
      inquiry,
      classification
    };
  });
}

function getPriorityRank(level) {
  if (level === "hot") return 1;
  if (level === "warm") return 2;
  return 3;
}

function renderTriageWorkflow(inquiries) {
  window.currentInquiries = inquiries;

  const list = document.getElementById("triageList");
  const filter = document.getElementById("triageFilter");

  if (!list || !filter) {
    return;
  }

  const contactedState = getContactedState();

  let triageItems = buildTriageItems(inquiries);

  triageItems.sort((a, b) => {
    const contactedA = contactedState[a.id]?.contacted ? 1 : 0;
    const contactedB = contactedState[b.id]?.contacted ? 1 : 0;

    if (contactedA !== contactedB) {
      return contactedA - contactedB;
    }

    return (
      getPriorityRank(a.classification.level) -
      getPriorityRank(b.classification.level)
    );
  });

  const selectedFilter = filter.value;

  if (selectedFilter !== "all") {
    triageItems = triageItems.filter((item) => {
      return item.classification.level === selectedFilter;
    });
  }

  updateTriageCounts(buildTriageItems(inquiries), contactedState);

  list.innerHTML = "";

  if (!triageItems.length) {
    list.innerHTML = `
      <div class="empty-state">
        No inquiries found for this filter.
      </div>
    `;
    return;
  }

  triageItems.forEach((item) => {
    const inquiry = item.inquiry;
    const isContacted = contactedState[item.id]?.contacted;
    const contactedAt = contactedState[item.id]?.contactedAt;

    const card = document.createElement("div");
    card.className = `triage-card ${isContacted ? "contacted" : ""}`;

    card.innerHTML = `
      <div class="triage-main">
        <h3>${getCompany(inquiry)}</h3>

        <div class="triage-meta">
          <span class="badge badge-${item.classification.level}">
            ${item.classification.label}
          </span>

          <span class="badge badge-status">
            ${getStatus(inquiry)}
          </span>

          <span class="badge badge-status">
            ${getRegion(inquiry)}
          </span>

          <span class="badge badge-status">
            Priority: ${getPriority(inquiry)}
          </span>
        </div>

        <p class="triage-reason">
          ${item.classification.reason}
        </p>

        ${
          isContacted
            ? `<p class="triage-reason">Contacted on ${formatDate(contactedAt)}.</p>`
            : ""
        }
      </div>

      <div class="triage-actions">
        <button onclick="markInquiryAsContacted('${item.id}')" ${
          isContacted ? "disabled" : ""
        }>
          ${isContacted ? "Contacted" : "Mark as Contacted"}
        </button>
      </div>
    `;

    list.appendChild(card);
  });

  filter.onchange = function () {
    renderTriageWorkflow(window.currentInquiries || []);
  };
}

function updateTriageCounts(triageItems, contactedState) {
  const hotCount = triageItems.filter((item) => {
    return item.classification.level === "hot";
  }).length;

  const warmCount = triageItems.filter((item) => {
    return item.classification.level === "warm";
  }).length;

  const coldCount = triageItems.filter((item) => {
    return item.classification.level === "cold";
  }).length;

  const contactedCount = triageItems.filter((item) => {
    return contactedState[item.id]?.contacted;
  }).length;

  document.getElementById("hotCount").textContent = hotCount;
  document.getElementById("warmCount").textContent = warmCount;
  document.getElementById("coldCount").textContent = coldCount;
  document.getElementById("contactedCount").textContent = contactedCount;
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "unknown date";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "unknown date";
  }

  return date.toLocaleDateString();
}
loadDashboardData();
