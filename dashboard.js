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

    console.log("Loaded sales:", sales);
    console.log("Loaded inquiries:", inquiries);
    console.log("Loaded accounts:", accounts);

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
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

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
    if (Array.isArray(data[key])) {
      return data[key];
    }
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

function getSaleDate(sale) {
  return (
    sale.sale_date ||
    sale.sales_date ||
    sale.order_date ||
    sale.date ||
    sale.created_at ||
    sale.createdAt ||
    "Unknown date"
  );
}

function getProductName(sale) {
  return (
    sale.product ||
    sale.product_name ||
    sale.productName ||
    sale.sku ||
    sale.item ||
    sale.item_name ||
    sale.itemName ||
    sale.category ||
    "Unknown Product"
  );
}

function getUnitsLbs(sale) {
  return Number(sale.units_lbs || sale.unitsLbs || sale.units || sale.lbs || 0) || 0;
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

function getMonthKeyFromDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthKey(inquiry) {
  return getMonthKeyFromDate(getReceivedDate(inquiry));
}

function getSaleMonthKey(sale) {
  return getMonthKeyFromDate(getSaleDate(sale));
}

function formatMonthLabel(monthKey) {
  if (monthKey === "Unknown") {
    return "Unknown";
  }

  const parts = monthKey.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  });
}

function populateMonthFilter(inquiries) {
  const monthFilter = document.getElementById("monthFilter");

  if (!monthFilter) {
    return;
  }

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

  if (!monthFilter) {
    return "all";
  }

  return monthFilter.value || "all";
}

function filterInquiriesByMonth(inquiries) {
  const selectedMonth = getSelectedMonth();

  if (selectedMonth === "all") {
    return inquiries;
  }

  return inquiries.filter((inquiry) => getMonthKey(inquiry) === selectedMonth);
}

function filterSalesByMonth(sales) {
  const selectedMonth = getSelectedMonth();

  if (selectedMonth === "all") {
    return sales;
  }

  const salesWithValidDate = sales.filter((sale) => getSaleMonthKey(sale) !== "Unknown");

  if (!salesWithValidDate.length) {
    return sales;
  }

  return sales.filter((sale) => getSaleMonthKey(sale) === selectedMonth);
}

function renderDashboard(sales, inquiries, accounts) {
  window.allSales = sales;
  window.allInquiries = inquiries;
  window.currentAccounts = accounts;

  populateMonthFilter(inquiries);

  const filteredInquiries = filterInquiriesByMonth(inquiries);
  const filteredSales = filterSalesByMonth(sales);

  renderInquiryMetrics(filteredInquiries, filteredSales);
  renderInquiryCharts(inquiries, filteredInquiries, filteredSales);
  renderTopProducts(filteredSales);
  renderTriageWorkflow(filteredInquiries, accounts);
  updateDashboardFilterLabel();

  const monthFilter = document.getElementById("monthFilter");

  if (monthFilter) {
    monthFilter.onchange = function () {
      renderDashboard(
        window.allSales || [],
        window.allInquiries || [],
        window.currentAccounts || []
      );
    };
  }
}

function renderInquiryMetrics(inquiries, sales) {
  const contactedState = getContactedState();

  const totalInquiries = inquiries.length;
  const closedInquiries = inquiries.filter((inquiry) => isClosedInquiry(inquiry)).length;
  const conversionRate =
    totalInquiries > 0 ? (closedInquiries / totalInquiries) * 100 : 0;

  const activeInquiries = getActiveInquiries(inquiries);

  const needsAction = activeInquiries.filter((inquiry, index) => {
    const inquiryId = getInquiryId(inquiry, index);
    return !contactedState[inquiryId]?.contacted;
  }).length;

  const totalRevenue = sales.reduce((sum, sale) => {
    return sum + getRevenue(sale);
  }, 0);

  setText("totalInquiries", totalInquiries.toLocaleString());
  setText("closedInquiries", closedInquiries.toLocaleString());
  setText("conversionRate", `${conversionRate.toFixed(1)}%`);
  setText("needsAction", needsAction.toLocaleString());
  setText("totalRevenue", `$${Math.round(totalRevenue).toLocaleString()}`);
}

function renderInquiryCharts(allInquiries, filteredInquiries, filteredSales) {
  const closedByMonth = groupClosedByMonth(allInquiries);
  const inquiriesByRegion = groupCountByRegion(filteredInquiries);
  const closedByRegion = groupCountByRegion(
    filteredInquiries.filter((inquiry) => isClosedInquiry(inquiry))
  );
  const revenueByRegion = groupRevenueByRegion(filteredSales);
  const salesByRegion = groupSalesByRegion(filteredSales);

  renderBarChart("closedByMonthChart", closedByMonth, "", true);
  renderBarChart("revenueByRegionChart", revenueByRegion, "$", false);
  renderPieChart("inquiriesByRegionChart", inquiriesByRegion);
  renderPieChart("closedByRegionChart", closedByRegion);
  renderBarChart("salesByRegionChart", salesByRegion, "", false);
  renderPieChart("revenueMixByRegionChart", revenueByRegion, "$");
}

function renderTopProducts(sales) {
  const container = document.getElementById("topProductsTable");

  if (!container) {
    console.warn("topProductsTable element was not found in dashboard.html");
    return;
  }

  container.innerHTML = "";

  if (!sales || !sales.length) {
    container.innerHTML = `
      <div class="empty-state">
        No sales data available for the selected view.
      </div>
    `;
    return;
  }

  const topProducts = groupSalesByProduct(sales);

  if (!topProducts.length) {
    container.innerHTML = `
      <div class="empty-state">
        No product sales data available.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="top-products-row header-row">
      <div>Rank</div>
      <div>Product</div>
      <div>Total Sales</div>
      <div>Avg LBS / Sale</div>
      <div>Total Revenue</div>
      <div>AOV</div>
    </div>
  `;

  topProducts.forEach((product, index) => {
    const row = document.createElement("div");
    row.className = "top-products-row";

    row.innerHTML = `
      <div>
        <span class="product-rank">${index + 1}</span>
      </div>

      <div class="product-name">
        ${product.product}
      </div>

      <div class="product-metric">
        ${product.salesCount.toLocaleString()}
      </div>

      <div class="product-metric">
        ${product.avgUnits.toFixed(1)} lbs
      </div>

      <div class="product-metric">
        $${product.revenue.toFixed(2)}
      </div>

      <div class="product-metric">
        $${product.aov.toFixed(2)}
      </div>
    `;

    container.appendChild(row);
  });
}

function groupSalesByProduct(sales) {
  const productMap = {};

  sales.forEach((sale) => {
    const productName = getProductName(sale);
    const revenue = getRevenue(sale);
    const units = getUnitsLbs(sale);

    if (!productMap[productName]) {
      productMap[productName] = {
        product: productName,
        salesCount: 0,
        totalUnits: 0,
        revenue: 0
      };
    }

    productMap[productName].salesCount += 1;
    productMap[productName].totalUnits += units;
    productMap[productName].revenue += revenue;
  });

  return Object.values(productMap)
    .map((item) => {
      const aov = item.salesCount > 0 ? item.revenue / item.salesCount : 0;
      const avgUnits = item.salesCount > 0 ? item.totalUnits / item.salesCount : 0;

      return {
        product: item.product,
        salesCount: item.salesCount,
        totalUnits: item.totalUnits,
        avgUnits: avgUnits,
        revenue: item.revenue,
        aov: aov
      };
    })
    .sort((a, b) => {
      if (b.salesCount !== a.salesCount) {
        return b.salesCount - a.salesCount;
      }

      return b.revenue - a.revenue;
    })
    .slice(0, 5);
}

function updateDashboardFilterLabel() {
  const selectedMonth = getSelectedMonth();
  const label =
    selectedMonth === "all" ? "All months" : formatMonthLabel(selectedMonth);

  setText("currentMonthLabel", label);
}

function setText(elementId, value) {
  const element = document.getElementById(elementId);

  if (element) {
    element.textContent = value;
  }
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

function groupSalesByRegion(sales) {
  const regionMap = {};

  sales.forEach((sale) => {
    const region = getRegion(sale);
    regionMap[region] = (regionMap[region] || 0) + 1;
  });

  return regionMap;
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
    if (!isClosedInquiry(inquiry)) {
      return;
    }

    const monthKey = getMonthKey(inquiry);
    const label = formatMonthLabel(monthKey);

    monthMap[label] = (monthMap[label] || 0) + 1;
  });

  return monthMap;
}

function renderBarChart(elementId, data, prefix, isColumnChart) {
  const container = document.getElementById(elementId);

  if (!container) {
    return;
  }

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

function renderPieChart(elementId, data, prefix = "") {
  const container = document.getElementById(elementId);

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const entries = Object.entries(data).filter((entry) => Number(entry[1]) > 0);

  if (!entries.length) {
    container.innerHTML = `<p class="empty-state">No data available.</p>`;
    return;
  }

  const colors = ["#6f4728", "#8b5e34", "#c7a17a", "#d9b99b", "#4b2e1f", "#a47148"];
  const total = entries.reduce((sum, entry) => sum + Number(entry[1]), 0);

  let currentDegree = 0;

  const gradientParts = entries.map(([label, value], index) => {
    const numericValue = Number(value);
    const degrees = (numericValue / total) * 360;
    const start = currentDegree;
    const end = currentDegree + degrees;

    currentDegree = end;

    return `${colors[index % colors.length]} ${start}deg ${end}deg`;
  });

  const chart = document.createElement("div");
  chart.className = "pie-chart-content";

  const legendItems = entries.map(([label, value], index) => {
    const numericValue = Number(value);
    const percent = total > 0 ? (numericValue / total) * 100 : 0;

    return `
      <div class="pie-legend-item">
        <span class="pie-dot" style="background: ${colors[index % colors.length]}"></span>
        <span>${label}</span>
        <span class="pie-value">${prefix}${Math.round(numericValue).toLocaleString()} (${percent.toFixed(1)}%)</span>
      </div>
    `;
  }).join("");

  chart.innerHTML = `
    <div class="pie-visual" style="background: conic-gradient(${gradientParts.join(", ")})"></div>
    <div class="pie-legend">${legendItems}</div>
  `;

  container.appendChild(chart);
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
  renderDashboard(window.allSales || [], window.allInquiries || [], window.currentAccounts || []);
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
  if (level === "hot") {
    return 1;
  }

  if (level === "warm") {
    return 2;
  }

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

  if (!inquiryName) {
    return 1;
  }

  const countByName = inquiries.filter((item) => {
    return normalizeName(getCompany(item)) === inquiryName;
  }).length;

  return countByName || 1;
}

function getInquiryCountLabel(inquiry, inquiries) {
  const count = getInquiryCountForCustomer(inquiry, inquiries);

  if (count === 1) {
    return "1 - New";
  }

  return `${count} - Returning`;
}

function populateStatusFilter(activeInquiries) {
  const statusFilter = document.getElementById("triageStatusFilter");

  if (!statusFilter) {
    return;
  }

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

  if (!searchInput) {
    return "";
  }

  return searchInput.value.trim().toLowerCase();
}

function matchesSearch(inquiry, searchValue) {
  if (!searchValue) {
    return true;
  }

  const searchableText = [
    getCompany(inquiry),
    getContactName(inquiry),
    getEmail(inquiry)
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchValue);
}

function updateTriageFilterLabel() {
  const priorityFilter = document.getElementById("triageFilter");
  const statusFilter = document.getElementById("triageStatusFilter");
  const searchInput = document.getElementById("triageSearch");

  const priority = priorityFilter ? priorityFilter.value : "all";
  const status = statusFilter ? statusFilter.value : "all";
  const search = searchInput ? searchInput.value.trim() : "";

  const parts = [];

  if (search) {
    parts.push(`Search: ${search}`);
  }

  if (priority !== "all") {
    parts.push(`Priority: ${priority}`);
  }

  if (status !== "all") {
    parts.push(`Status: ${status}`);
  }

  setText("currentTriageFilterLabel", parts.length ? parts.join(" | ") : "All active inquiries");
}

function renderTriageWorkflow(inquiries, accounts = []) {
  window.currentInquiries = inquiries;
  window.currentAccounts = accounts;

  const activeInquiries = getActiveInquiries(inquiries);

  const list = document.getElementById("triageList");
  const priorityFilter = document.getElementById("triageFilter");
  const statusFilter = document.getElementById("triageStatusFilter");
  const searchInput = document.getElementById("triageSearch");

  if (!list || !priorityFilter) {
    return;
  }

  populateStatusFilter(activeInquiries);

  const contactedState = getContactedState();

  let triageItems = buildTriageItems(activeInquiries);

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
  updateTriageFilterLabel();

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
