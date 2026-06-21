async function loadTriageData() {
  try {
    const inquiriesResponse = await fetch("./data/inquiries.json");
    const accountsResponse = await fetch("./data/accounts.json");

    if (!inquiriesResponse.ok) {
      throw new Error("Could not load inquiries.json");
    }

    const inquiriesRaw = await inquiriesResponse.json();

    let accountsRaw = [];

    if (accountsResponse.ok) {
      accountsRaw = await accountsResponse.json();
    }

    const inquiries = getUniqueInquiries(normalizeData(inquiriesRaw));
    const accounts = normalizeData(accountsRaw);

    window.currentInquiries = inquiries;
    window.currentAccounts = accounts;
    window.selectedInquiryId = null;

    renderTriageWorkflow(inquiries, accounts);
    setupModalEvents();
  } catch (error) {
    console.error("Error loading triage data:", error);

    document.body.innerHTML = `
      <main class="page">
        <div class="panel">
          <h1>Triage workflow could not load</h1>
          <p>Please check if inquiries.json exists inside the data folder.</p>
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

function getUniqueInquiries(inquiries) {
  const uniqueMap = {};

  inquiries.forEach((inquiry, index) => {
    const id = getInquiryId(inquiry, index);

    if (!uniqueMap[id]) {
      uniqueMap[id] = inquiry;
    }
  });

  return Object.values(uniqueMap);
}

function getStatus(inquiry) {
  return inquiry.status || inquiry.stage || "Unknown";
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

function getRegion(inquiry) {
  return (
    inquiry.region ||
    inquiry.sales_region ||
    inquiry.market ||
    inquiry.state ||
    inquiry.location ||
    "Unknown"
  );
}

function getChannel(inquiry) {
  return inquiry.channel || inquiry.source || inquiry.lead_source || inquiry.leadSource || "Unknown channel";
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

function getInquiryText(inquiry) {
  return JSON.stringify(inquiry).toLowerCase();
}

function isClosedInquiry(inquiry) {
  return String(getStatus(inquiry)).toLowerCase() === "closed";
}

function getActiveInquiries(inquiries) {
  return inquiries.filter((inquiry) => !isClosedInquiry(inquiry));
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

function getPriorityRank(level) {
  if (level === "hot") {
    return 1;
  }

  if (level === "warm") {
    return 2;
  }

  return 3;
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
    getEmail(inquiry),
    getRegion(inquiry),
    getChannel(inquiry)
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchValue);
}

function populateStatusFilter(activeInquiries) {
  const statusFilter = document.getElementById("triageStatusFilter");

  if (!statusFilter) {
    return;
  }

  const currentValue = statusFilter.value || "all";

  const statuses = [...new Set(activeInquiries.map((inquiry) => getStatus(inquiry))]
    )
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

function updateTriageCounts(triageItems, contactedState) {
  const hotCount = triageItems.filter((item) => item.classification.level === "hot").length;
  const warmCount = triageItems.filter((item) => item.classification.level === "warm").length;
  const coldCount = triageItems.filter((item) => item.classification.level === "cold").length;

  const contactedCount = triageItems.filter((item) => {
    return contactedState[item.id]?.contacted;
  }).length;

  const needsActionCount = triageItems.filter((item) => {
    const status = String(getStatus(item.inquiry)).toLowerCase();
    return !contactedState[item.id]?.contacted && status !== "contacted";
  }).length;

  setText("hotCount", hotCount);
  setText("warmCount", warmCount);
  setText("coldCount", coldCount);
  setText("contactedCount", contactedCount);
  setText("triageNeedsAction", needsActionCount);
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

      <div class="triage-actions triage-actions-stack">
        <button class="secondary-action-button view-detail-button" type="button">
          View Details
        </button>

        <button class="primary-action-button mark-contacted-button" type="button" ${isContacted ? "disabled" : ""}>
          ${isContacted ? "Contacted" : "Mark as Contacted"}
        </button>
      </div>
    `;

    list.appendChild(card);

    const detailButton = card.querySelector(".view-detail-button");
    const contactButton = card.querySelector(".mark-contacted-button");

    detailButton.addEventListener("click", function () {
      openInquiryModal(item.id);
    });

    contactButton.addEventListener("click", function () {
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

function getInquiryById(inquiryId) {
  const inquiries = window.currentInquiries || [];

  return inquiries.find((inquiry, index) => {
    return getInquiryId(inquiry, index) === inquiryId;
  });
}

function openInquiryModal(inquiryId) {
  const modal = document.getElementById("inquiryModal");
  const modalCompany = document.getElementById("modalCompany");
  const modalBody = document.getElementById("modalBody");
  const modalContactButton = document.getElementById("modalContactButton");

  if (!modal || !modalCompany || !modalBody || !modalContactButton) {
    return;
  }

  const inquiry = getInquiryById(inquiryId);

  if (!inquiry) {
    return;
  }

  const classification = classifyInquiry(inquiry);
  const contactedState = getContactedState();
  const isContacted = contactedState[inquiryId]?.contacted;
  const contactedAt = contactedState[inquiryId]?.contactedAt;
  const inquiryCountLabel = getInquiryCountLabel(inquiry, window.currentInquiries || []);

  window.selectedInquiryId = inquiryId;

  modalCompany.textContent = getCompany(inquiry);

  modalBody.innerHTML = `
    <div class="modal-detail-grid">
      <div>
        <span>Priority</span>
        <strong class="priority-text ${classification.level}">${classification.label}</strong>
      </div>

      <div>
        <span>Status</span>
        <strong>${getStatus(inquiry)}</strong>
      </div>

      <div>
        <span>Contact Name</span>
        <strong>${getContactName(inquiry)}</strong>
      </div>

      <div>
        <span>Email</span>
        <strong>${getEmail(inquiry)}</strong>
      </div>

      <div>
        <span>Region</span>
        <strong>${getRegion(inquiry)}</strong>
      </div>

      <div>
        <span>Channel</span>
        <strong>${getChannel(inquiry)}</strong>
      </div>

      <div>
        <span>Requested Volume</span>
        <strong>${getRequestedVolume(inquiry).toLocaleString()} lbs/month</strong>
      </div>

      <div>
        <span>Received Date</span>
        <strong>${getReceivedDate(inquiry)}</strong>
      </div>

      <div>
        <span>Number of Inquiries</span>
        <strong>${inquiryCountLabel}</strong>
      </div>

      <div>
        <span>Contacted State</span>
        <strong>${isContacted ? `Contacted on ${formatDate(contactedAt)}` : "Not contacted yet"}</strong>
      </div>
    </div>

    <div class="modal-message-box">
      <span>Original Message</span>
      <p>${getInquiryMessage(inquiry)}</p>
    </div>

    <div class="modal-message-box">
      <span>Priority Reason</span>
      <p>${classification.reason}</p>
    </div>
  `;

  modalContactButton.disabled = isContacted;
  modalContactButton.textContent = isContacted ? "Already Contacted" : "Mark as Contacted";

  modal.classList.remove("hidden");
}

function closeInquiryModal() {
  const modal = document.getElementById("inquiryModal");

  if (modal) {
    modal.classList.add("hidden");
  }

  window.selectedInquiryId = null;
}

function setupModalEvents() {
  const closeModalButton = document.getElementById("closeModalButton");
  const modalCloseBottomButton = document.getElementById("modalCloseBottomButton");
  const modalContactButton = document.getElementById("modalContactButton");
  const modal = document.getElementById("inquiryModal");

  if (closeModalButton) {
    closeModalButton.addEventListener("click", closeInquiryModal);
  }

  if (modalCloseBottomButton) {
    modalCloseBottomButton.addEventListener("click", closeInquiryModal);
  }

  if (modalContactButton) {
    modalContactButton.addEventListener("click", function () {
      if (!window.selectedInquiryId) {
        return;
      }

      markInquiryAsContacted(window.selectedInquiryId);
      openInquiryModal(window.selectedInquiryId);
    });
  }

  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeInquiryModal();
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeInquiryModal();
    }
  });
}

function getInquirySummary(inquiry) {
  const volume = getRequestedVolume(inquiry);
  const channel = getChannel(inquiry);
  const region = getRegion(inquiry);
  const status = getStatus(inquiry);
  const message = getInquiryMessage(inquiry);

  return `${getCompany(inquiry)} is a ${status} inquiry from ${region}, sourced through ${channel}. Requested volume is ${volume.toLocaleString()} lbs/month. Message: "${message}"`;
}

function setText(elementId, value) {
  const element = document.getElementById(elementId);

  if (element) {
    element.textContent = value;
  }
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

loadTriageData();
