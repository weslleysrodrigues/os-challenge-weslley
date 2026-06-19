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

loadDashboardData();
