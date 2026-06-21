async function loadDashboardData() {
  try {
    const salesResponse = await fetch("./data/sales.json");
    const inquiriesResponse = await fetch("./data/inquiries.json");
    const accountsResponse = await fetch("./data/accounts.json");

    if (!salesResponse.ok) {
      throw new Error("Could not load sales.json");
    }

    if (!inquiriesResponse.ok) {
      throw new Error("Could not load inquiries.json");
    }

    const salesRaw = await salesResponse.json();
    const inquiriesRaw = await inquiriesResponse.json();

    let accountsRaw = [];

    if (accountsResponse.ok) {
      accountsRaw = await accountsResponse.json();
    }

    const sales = normalizeData(salesRaw);
    const inquiries = normalizeData(inquiriesRaw);
    const accounts = normalizeData(accountsRaw);

    renderDashboard(sales, inquiries, accounts);
  } catch (error) {
    console.error("Error loading dashboard data:", error);

    document.body.innerHTML = `
      <main class="page">
        <div class="panel">
          <h1>Dashboard could not load</h1>
          <p>Please check if sales.json and inquiries.json exist inside the data folder.</p>
          <p>Error: ${error.message}</p>
        </div>
      </main>
    `;
  }
}

function normalizeData(data) {
  if (Array.isArray(data)) return data;

  if (!data || typeof data !== "object") return [];

  const possibleKeys = [
    "data",
    "items",
    "records",
    "sales",
    "inquiries",
    "accounts",
    "results"
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(data[key])) return data[key];
  }

  const firstArray = Object.values(data).find((value) => Array.isArray(value));

  return firstArray || [];
}

function getRevenue(sale) {
  const value =
    sale.revenue ||
    sale.revenue_usd ||
    sale.total_revenue ||
    sale.totalRevenue ||
    sale.total ||
    sale.amount ||
    sale.amount_usd ||
    sale.value ||
    sale.order_value ||
    sale.orderValue ||
    sale.sales ||
    sale.price ||
    sale.total_price ||
    0;

  return Number(value) || 0;
}

function getRegion(item) {
  return (
    item.region ||
    item.sales_region ||
    item.market ||
    item.state ||
    item.location ||
    "Unknown"
  );
}

function getStatus(item) {
  return item.status || item.stage || "Unknown";
}

function getCompany(inquiry) {
  return (
    inquiry.cafe_name ||
    inquiry.company ||
    inquiry.company_name ||
    inquiry.companyName ||
    inquiry.business ||
    inquiry.business_name ||
    inquiry.customer ||
    inquiry.customer_name ||
    inquiry.name ||
    "Unknown"
  );
}

function getContactName(inquiry) {
  return inquiry.contact_name || inquiry.contactName || "Unknown contact";
}

function getEmail(inquiry) {
  return inquiry.email || "No email provided";
}

function getChannel(inquiry) {
  return inquiry.channel || "Unknown channel";
}

function getRequestedVolume(inquiry) {
  return (
    Number(
      inquiry.requested_volume_lbs_month ||
        inquiry.requestedVolumeLbsMonth ||
        inquiry.monthly_volume_lbs ||
        inquiry.volume ||
        inquiry.volume_lbs ||
        0
    ) || 0
  );
}

function getReceivedDate(inquiry) {
  return (
    inquiry.received_date ||
    inquiry.receivedDate ||
    inquiry.date ||
    inquiry.created_at ||
    inquiry.createdAt ||
    "Unknown date"
  );
}

function getInquiryMessage(inquiry) {
  return inquiry.message || inquiry.notes || inquiry.description || "No message provided.";
}

function getInquirySummary(inquiry) {
  const volume = getRequestedVolume(inquiry);
  const channel = getChannel(inquiry);
  const region = getRegion(inquiry);
  const status = getStatus(inquiry);
  const message = getInquiryMessage(inquiry);

  return `${getCompany(inquiry)} is a ${status} inquiry from ${region}, sourced through ${channel}. Requested volume is ${volume.toLocaleString()} lbs/month. Message: "${message}"`;
}

function isClosedInquiry(inquiry) {
  return String(getStatus(inquiry)).toLowerCase() === "closed";
}

function getActiveInquiries(inquiries) {
  return inquiries.filter((inquiry) => !isClosedInquiry(inquiry));
}

function getMonthKey(inquiry) {
  const date = new Date(getReceivedDate(inquiry));

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
  if (monthKey === "Unknown") return "Unknown";

  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  });
}

function populateMonthFilter(inquiries) {
  const monthFilter = document.getElementById("monthFilter");

  if (!monthFilter) return;

  const currentValue = monthFilter.value || "all";

  const months = [...new Set(inquiries.map((inquiry) => getMonthKey(inquiry)))]
    .filter((month) => month !== "Unknown")
    .sort();

  monthFilter.innerHTML = `<option value="all">All months</option>`;

  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = formatMonthLabel(month);
    monthFilter.appendChild(option);
  });

  const stillExists = Array.from(monthFilter.options).some((option) => {
    return option.value === currentValue;
  });

  monthFilter.value = stillExists ? currentValue : "all";
}

function getSelectedMonth() {
  const monthFilter = document.getElementById("monthFilter");

  if (!monthFilter) return "all";

  return monthFilter.value || "all";
}

function filterInquiriesByMonth(inquiries) {
  const selectedMonth = getSelectedMonth();

  if (selectedMonth === "all") return inquiries;

  return inquiries.filter((inquiry) => getMonthKey(inquiry) === selectedMonth);
}

function renderDashboard(sales, inquiries, accounts) {
  window.allSales = sales;
  window.allInquiries = inquiries;
  window.currentAccounts = accounts;

  populateMonthFilter(inquiries);

  const filteredInquiries = filterInquiriesByMonth(inquiries);

  renderInquiryMetrics(filteredInquiries);
  renderInquiryCharts(inquiries, filteredInquiries);
  renderTriageWorkflow(filteredInquiries, accounts);

  const monthFilter = document.getElementById("monthFilter");

  if (monthFilter) {
    monthFilter.onchange = function () {
      renderDashboard(window.allSales || [], window.allInquiries || [], window.currentAccounts || []);
    };
  }
}

function renderInquiryMetrics(inquiries) {
  const totalInquiries = inquiries.length;
  const closedInquiries = inquiries.filter((inquiry) => isClosedInquiry(inquiry)).length;
  const conversionRate =
    totalInquiries > 0 ? (closedInquiries / totalInquiries) * 100 : 0;

  const requestedVolume = inquiries.reduce((sum, inquiry) => {
    return sum + getRequestedVolume(inquiry);
  }, 0);

  const activePipeline = inquiries.filter((inquiry) => !isClosedInquiry(inquiry)).length;

  const avgRequestedVolume =
    totalInquiries > 0 ? requestedVolume / totalInquiries : 0;

  const inquiriesByRegion = groupCountByRegion(inquiries);
  const closedByRegion = groupCountByRegion(
    inquiries.filter((inquiry) => isClosedInquiry(inquiry))
  );

  setText("totalInquiries", totalInquiries.toLocaleString());
  setText("closedInquiries", closedInquiries.toLocaleString());
  setText("conversionRate", `${conversionRate.toFixed(1)}%`);
  setText("requestedVolume", `${requestedVolume.toLocaleString()} lbs`);
  setText("topInquiryRegion", getTopKey(inquiriesByRegion));
  setText("topClosedRegion", getTopKey(closedByRegion));
  setText("activePipeline", activePipeline.toLocaleString());
  setText("avgRequestedVolume", `${Math.round(avgRequestedVolume).toLocaleString()} lbs`);
}

function renderInquiryCharts(allInquiries, filteredInquiries) {
  const closedByMonth = groupClosedByMonth(allInquiries);
  const inquiriesByRegion = groupCountByRegion(filteredInquiries);
  const closedByRegion = groupCountByRegion(
    filteredInquiries.filter((inquiry) => isClosedInquiry(inquiry))
  );

  renderBarChart("closedByMonthChart", closedByMonth, "", true);
  renderBarChart("inquiriesByRegionChart", inquiriesByRegion, "", false);
  renderBarChart("closedByRegionChart", closedByRegion, "", false);
}

function setText(elementId, value) {
  const element = document.getElementById(elementId);

  if (element) {
    element.textContent = value;
  }
}

function getTopKey(data) {
  const top = Object.entries(data).sort((a, b) => b[1] - a[1])[0];

  return top ? top[0] : "-";
}

function groupCountByRegion(inquiries) {
  const regionMap = {};

  inquiries.forEach((inquiry) => {
    const region = getRegion(inquiry);
    regionMap[region] = (regionMap[region] || 0) + 1;
  });

  return regionMap;
}

function groupClosedByMonth(inquiries) {
  const monthMap = {};

  inquiries.forEach((inquiry) => {
    if (!isClosedInquiry(inquiry)) return;

    const monthKey = getMonthKey(inquiry);
    const label = formatMonthLabel(monthKey);

    monthMap[label] = (monthMap[label] || 0) + 1;
  });

  return monthMap;
}

function renderBarChart(elementId, data, prefix, isColumnChart) {
  const container = document.getElementById(elementId);

  if (!container) return;

  container.innerHTML = "";

  const entries = Object.entries(data);

  if (!entries.length) {
    container.innerHTML = `<p class="empty-state">No data available.</p>`;
    return;
  }

  const sortedEntries = isColumnChart
    ? entries
    : entries.sort((a, b) => b[1] - a[1]);

  const maxValue = Math.max(...sortedEntries.map((entry) => Number(entry[1])), 1);

  if (isColumnChart) {
    const chart = document.createElement("div");
    chart.className = "column-chart";

    sortedEntries.forEach(([label, value]) => {
      const numericValue = Number(value) || 0;
      const height = Math.max((numericValue / maxValue) * 160, 8);

      const column = document.createElement("div");
      column.className = "column-item";

      column.innerHTML = `
        <div class="column-value">${prefix}${numericValue.toLocaleString()}</div>
        <div class="column-bar" style="height: ${height}px"></div>
        <div class="column-label">${label}</div>
      `;

      chart.appendChild(column);
    });

    container.appendChild(chart);
    return;
  }

  sortedEntries.forEach(([label, value]) => {
    const numericValue = Number(value) || 0;
    const width = (numericValue / maxValue) * 100;

    const row = document.createElement("div");
    row.className = "bar-row";

    row.innerHTML = `
      <div class="bar-label">${label}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${width}%"></div>
      </div>
      <div class="bar-value">${prefix}${Math.round(numericValue).toLocaleString()}</div>
    `;

    container.appendChild(row);
  });
}

function getInquiryId(inquiry, index) {
  return String(
    inquiry.id ||
      inquiry.inquiryId ||
      inquiry.email ||
      inquiry.cafe_name ||
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
  const status = String(getStatus(inquiry)).toLowerCase();
  const volume = getRequestedVolume(inquiry);

  const hotSignals = [
    "urgent",
    "asap",
    "immediately",
    "rush",
    "wholesale",
    "large",
    "scale",
    "growth",
    "grow quickly",
    "multiple locations"
  ];

  const warmSignals = [
    "qualified",
    "interested",
    "quote",
    "pricing",
    "partner",
    "grow",
    "sample",
    "referral"
  ];

  const hasHotSignal = hotSignals.some((signal) => text.includes(signal));

  const hasWarmSignal = warmSignals.some((signal) => {
    return text.includes(signal) || status.includes(signal);
  });

  if (volume >= 300 || hasHotSignal) {
    return {
      level: "hot",
      label: "Hot",
      reason: "High potential inquiry based on requested volume or strong buying/growth signals."
    };
  }

  if (volume >= 100 || status === "qualified" || hasWarmSignal) {
    return {
      level: "warm",
      label: "Warm",
      reason: "Qualified opportunity with moderate volume or clear interest. Good follow-up candidate."
    };
  }

  return {
    level: "cold",
    label: "Cold",
    reason: "Lower-volume or lower-urgency inquiry. Review after higher-priority opportunities."
  };
}

function getContactedState() {
  const saved = localStorage.getItem("contactedInquiries");

  if (!saved) return {};

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
  renderTriageWorkflow(window.currentInquiries || [], window.currentAccounts || []);
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

function getInquiryAccountId(inquiry) {
  return (
    inquiry.account_id ||
    inquiry.accountId ||
    inquiry.accountID ||
    inquiry.account ||
    inquiry.customer_id ||
    inquiry.customerId ||
    inquiry.account_ref ||
    ""
  );
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function getInquiryCountForCustomer(inquiry, inquiries) {
  const inquiryAccountId = getInquiryAccountId(inquiry);

  if (inquiryAccountId) {
    const countByAccountId = inquiries.filter((item) => {
      return String(getInquiryAccountId(item)) === String(inquiryAccountId);
    }).length;

    return countByAccountId || 1;
  }

  const inquiryName = normalizeName(getCompany(inquiry));

  if (!inquiryName) return 1;

  const countByName = inquiries.filter((item) => {
    return normalizeName(getCompany(item)) === inquiryName;
  }).length;

  return countByName || 1;
}

function getInquiryCountLabel(inquiry, inquiries) {
  const count = getInquiryCountForCustomer(inquiry, inquiries);

  if (count === 1) return "1 - New";

  return `${count} - Returning`;
}

function populateStatusFilter(activeInquiries) {
  const statusFilter = document.getElementById("triageStatusFilter");

  if (!statusFilter) return;

  const currentValue = statusFilter.value || "all";

  const statuses = [...new Set(activeInquiries.map((inquiry) => getStatus(inquiry)))]
    .filter((status) => status && String(status).toLowerCase() !== "closed")
    .sort();

  statusFilter.innerHTML = `<option value="all">All active statuses</option>`;

  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = String(status).toLowerCase();
    option.textContent = status;
    statusFilter.appendChild(option);
  });

  const stillExists = Array.from(statusFilter.options).some((option) => {
    return option.value === currentValue;
  });

  statusFilter.value = stillExists ? currentValue : "all";
}

function getSearchValue() {
  const searchInput = document.getElementById("triageSearch");

  if (!searchInput) return "";

  return searchInput.value.trim().toLowerCase();
}

function matchesSearch(inquiry, searchValue) {
  if (!searchValue) return true;

  const searchableText = [
    getCompany(inquiry),
    getContactName(inquiry),
    getEmail(inquiry)
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchValue);
}

function renderTriageWorkflow(inquiries, accounts = []) {
  window.currentInquiries = inquiries;
  window.currentAccounts = accounts;

  const activeInquiries = getActiveInquiries(inquiries);

  const list = document.getElementById("triageList");
  const priorityFilter = document.getElementById("triageFilter");
  const statusFilter = document.getElementById("triageStatusFilter");
  const searchInput = document.getElementById("triageSearch");

  if (!list || !priorityFilter) return;

  populateStatusFilter(activeInquiries);

  const contactedState = getContactedState();

  let triageItems = buildTriageItems(activeInquiries);

  triageItems.sort((a, b) => {
    const contactedA = contactedState[a.id]?.contacted ? 1 : 0;
    const contactedB = contactedState[b.id]?.contacted ? 1 : 0;

    if (contactedA !== contactedB) return contactedA - contactedB;

    return (
      getPriorityRank(a.classification.level) -
      getPriorityRank(b.classification.level)
    );
  });

  const selectedPriority = priorityFilter.value;
  const selectedStatus = statusFilter ? statusFilter.value : "all";
  const searchValue = getSearchValue();

  if (selectedPriority !== "all") {
    triageItems = triageItems.filter((item) => {
      return item.classification.level === selectedPriority;
    });
  }

  if (selectedStatus !== "all") {
    triageItems = triageItems.filter((item) => {
      return String(getStatus(item.inquiry)).toLowerCase() === selectedStatus;
    });
  }

  triageItems = triageItems.filter((item) => {
    return matchesSearch(item.inquiry, searchValue);
  });

  updateTriageCounts(buildTriageItems(activeInquiries), contactedState);

  list.innerHTML = "";

  if (!triageItems.length) {
    list.innerHTML = `
      <div class="empty-state">
        No active inquiries found for the selected filters.
      </div>
    `;
    return;
  }

  triageItems.forEach((item) => {
    const inquiry = item.inquiry;
    const isContacted = contactedState[item.id]?.contacted;
    const contactedAt = contactedState[item.id]?.contactedAt;
    const inquiryCountLabel = getInquiryCountLabel(inquiry, inquiries);

    const card = document.createElement("div");
    card.className = `triage-card ${isContacted ? "contacted" : ""}`;

    card.innerHTML = `
      <div class="triage-main">
        <div class="triage-title-row">
          <div>
            <h3>${getCompany(inquiry)}</h3>
            <p class="triage-contact">
              ${getContactName(inquiry)} | ${getEmail(inquiry)}
            </p>
          </div>
        </div>

        <div class="triage-details-grid">
          <div class="detail-item">
            <span>Priority</span>
            <strong class="priority-text ${item.classification.level}">
              ${item.classification.label}
            </strong>
          </div>

          <div class="detail-item">
            <span>Status</span>
            <strong>${getStatus(inquiry)}</strong>
          </div>

          <div class="detail-item">
            <span>Region</span>
            <strong>${getRegion(inquiry)}</strong>
          </div>

          <div class="detail-item">
            <span>Channel</span>
            <strong>${getChannel(inquiry)}</strong>
          </div>

          <div class="detail-item">
            <span>Requested Volume</span>
            <strong>${getRequestedVolume(inquiry).toLocaleString()} lbs/month</strong>
          </div>

          <div class="detail-item">
            <span>Received Date</span>
            <strong>${getReceivedDate(inquiry)}</strong>
          </div>

          <div class="detail-item">
            <span>Number of Inquiries</span>
            <strong>${inquiryCountLabel}</strong>
          </div>
        </div>

        <div class="triage-summary-text">
          <strong>Operator Summary:</strong>
          <p>${getInquirySummary(inquiry)}</p>
        </div>

        <p class="triage-reason">
          <strong>Why ${item.classification.label}:</strong> ${item.classification.reason}
        </p>

        ${
          isContacted
            ? `<p class="triage-reason">Contacted on ${formatDate(contactedAt)}. This client is ready for follow-up.</p>`
            : ""
        }
      </div>

      <div class="triage-actions">
        <button ${isContacted ? "disabled" : ""}>
          ${isContacted ? "Contacted" : "Mark as Contacted"}
        </button>
      </div>
    `;

    list.appendChild(card);

    const button = card.querySelector("button");

    button.addEventListener("click", function () {
      markInquiryAsContacted(item.id);
    });
  });

  priorityFilter.onchange = function () {
    renderTriageWorkflow(window.currentInquiries || [], window.currentAccounts || []);
  };

  if (statusFilter) {
    statusFilter.onchange = function () {
      renderTriageWorkflow(window.currentInquiries || [], window.currentAccounts || []);
    };
  }

  if (searchInput) {
    searchInput.oninput = function () {
      renderTriageWorkflow(window.currentInquiries || [], window.currentAccounts || []);
    };
  }
}

function updateTriageCounts(triageItems, contactedState) {
  const hotCount = triageItems.filter((item) => item.classification.level === "hot").length;
  const warmCount = triageItems.filter((item) => item.classification.level === "warm").length;
  const coldCount = triageItems.filter((item) => item.classification.level === "cold").length;

  const contactedCount = triageItems.filter((item) => {
    return contactedState[item.id]?.contacted;
  }).length;

  setText("hotCount", hotCount);
  setText("warmCount", warmCount);
  setText("coldCount", coldCount);
  setText("contactedCount", contactedCount);
}

function formatDate(dateValue) {
  if (!dateValue) return "unknown date";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "unknown date";

  return date.toLocaleDateString();
}

loadDashboardData();
