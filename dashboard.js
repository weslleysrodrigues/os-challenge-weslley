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

  if (firstArray) {
    return firstArray;
  }

  return [];
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

function renderDashboard(sales, inquiries, accounts) {
  const totalRevenue = sales.reduce((sum, sale) => sum + getRevenue(sale), 0);
  const totalSales = sales.length;

  const newInquiries = inquiries.filter((inquiry) => {
    const status = String(getStatus(inquiry)).toLowerCase();
    return status === "new" || status === "qualified" || status === "open";
  }).length;

  const revenueByRegion = groupRevenueByRegion(sales);
  const inquiriesByStatus = groupInquiriesByStatus(inquiries);

  const topRegion =
    Object.entries(revenueByRegion).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "No data";

  setText("totalRevenue", "$" + Math.round(totalRevenue).toLocaleString());
  setText("totalSales", totalSales.toLocaleString());
  setText("newInquiries", newInquiries.toLocaleString());
  setText("topRegion", topRegion);

  renderBarChart("revenueByRegion", revenueByRegion, "$");
  renderBarChart("inquiriesByStatus", inquiriesByStatus, "");

  renderOperatorNotes({
    totalRevenue,
    totalSales,
    newInquiries,
    topRegion,
    revenueByRegion,
    inquiriesByStatus,
    inquiries
  });

  renderRecentInquiries(inquiries);
  renderTriageWorkflow(inquiries);
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

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    container.innerHTML = `<p class="empty-state">No data available.</p>`;
    return;
  }

  const maxValue = Math.max(...entries.map((entry) => Number(entry[1])), 1);

  entries.forEach(([label, value]) => {
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

function renderOperatorNotes(data) {
  const notes = document.getElementById("operatorNotes");

  if (!notes) {
    return;
  }

  const averageSale =
    data.totalSales > 0 ? data.totalRevenue / data.totalSales : 0;

  const busiestStatus =
    Object.entries(data.inquiriesByStatus).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "No inquiry status";

  const totalRequestedVolume = data.inquiries.reduce((sum, inquiry) => {
    return sum + getRequestedVolume(inquiry);
  }, 0);

  notes.innerHTML = `
    <div class="note">
      <strong>${data.newInquiries} active inquiries</strong> are waiting for review or follow-up.
    </div>

    <div class="note">
      <strong>${data.topRegion}</strong> is currently the strongest revenue region based on sales data.
    </div>

    <div class="note">
      Average sale value is <strong>$${Math.round(averageSale).toLocaleString()}</strong>. This can be used as a benchmark when reviewing new opportunities.
    </div>

    <div class="note">
      Current inbound requested volume is <strong>${totalRequestedVolume.toLocaleString()} lbs/month</strong> across all inquiries.
    </div>

    <div class="note">
      The busiest inquiry status is <strong>${busiestStatus}</strong>. This helps identify where the workflow may be getting backed up.
    </div>
  `;
}

function renderRecentInquiries(inquiries) {
  const tbody = document.getElementById("recentInquiries");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  const recentInquiries = [...inquiries]
    .sort((a, b) => {
      const dateA = new Date(getReceivedDate(a)).getTime();
      const dateB = new Date(getReceivedDate(b)).getTime();

      return dateB - dateA;
    })
    .slice(0, 6);

  recentInquiries.forEach((inquiry) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${getCompany(inquiry)}</td>
      <td>${getRegion(inquiry)}</td>
      <td>${getStatus(inquiry)}</td>
      <td>${getRequestedVolume(inquiry).toLocaleString()} lbs/month</td>
    `;

    tbody.appendChild(row);
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

function isClosedInquiry(inquiry) {
  return String(getStatus(inquiry)).toLowerCase() === "closed";
}

function renderTriageWorkflow(inquiries) {
  window.currentInquiries = inquiries;

  const activeInquiries = inquiries.filter((inquiry) => {
    return !isClosedInquiry(inquiry);
  });

  const list = document.getElementById("triageList");
  const filter = document.getElementById("triageFilter");

  if (!list || !filter) {
    return;
  }

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

  const selectedFilter = filter.value;

  if (selectedFilter !== "all") {
    triageItems = triageItems.filter((item) => {
      return item.classification.level === selectedFilter;
    });
  }

  updateTriageCounts(buildTriageItems(activeInquiries), contactedState);

  list.innerHTML = "";

  if (!triageItems.length) {
    list.innerHTML = `
      <div class="empty-state">
        No active inquiries found for this filter.
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
            ? `<p class="triage-reason">Contacted on ${formatDate(contactedAt)}.</p>`
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
