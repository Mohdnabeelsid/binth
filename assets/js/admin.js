/**
 * BINTH.IN — Admin Portal Controller
 * Manages navigation, role permissions, live API integrations, 15 QR locations, and modals.
 * Zero mock data: live API integration with local configuration persistence.
 */

import { Api, ApiConfig } from './api.js';
import { QRCode } from './qrcode.js';

// Available Roles
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  CAMPAIGN_MANAGER: 'campaign_manager',
  VIEWER: 'viewer'
};

export const AdminState = {
  currentRole: sessionStorage.getItem('binth_admin_role') || ROLES.SUPER_ADMIN,
  apiConnected: false,
  activeLocations: []
};

// Standard Initial 15 Campaign Locations Template across Kerala
export const INITIAL_15_LOCATIONS_TEMPLATE = [
  { code: 'MCH-SHOP-001', name: 'Mananchira Boutique Partner', establishment: 'Crafts Council Pavilion', area: 'Mananchira, Kozhikode', type: 'Boutique', partner: 'Malabar Handloom Guild', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'MCH-STORE-002', name: 'SM Street Traditional Atelier', establishment: 'Mittai Theruvu Heritage Arcade', area: 'SM Street, Kozhikode', type: 'Concept Store', partner: 'Zamorin Crafts Society', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'ALP-BOUTIQUE-003', name: 'Mullakkal Handloom Corner', establishment: 'Mullakkal Central Atelier', area: 'Mullakkal, Alappuzha', type: 'Boutique', partner: 'Backwater Weaves Collective', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'ALP-STORE-004', name: 'Backwater Artisan Hub', establishment: 'Punnamada Craft Studio', area: 'Punnamada, Alappuzha', type: 'Artisan Hub', partner: 'Coir & Loom Artisans', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'KCH-MALL-005', name: 'Marine Drive Concept Atelier', establishment: 'Marine Walkway Centre', area: 'Marine Drive, Kochi', type: 'Concept Store', partner: 'Cochin Artisan Guild', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'KCH-STUDIO-006', name: 'Panampilly Kids Space', establishment: 'Little Atelier Hub', area: 'Panampilly Nagar, Kochi', type: 'Kids Studio', partner: 'Kochi Boutique Collective', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'TVM-STUDIO-007', name: 'Kowdiar Craft Pavilion', establishment: 'Royal Heritage Arcade', area: 'Kowdiar, Thiruvananthapuram', type: 'Kids Studio', partner: 'Travancore Weaves Guild', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'TVM-SHOP-008', name: 'Statue Handloom House', establishment: 'MG Road Boutique Corner', area: 'Statue, Thiruvananthapuram', type: 'Boutique', partner: 'Capital Artisans Guild', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'TCR-STORE-009', name: 'Round North Heritage Hub', establishment: 'Swaraj Heritage Space', area: 'Round North, Thrissur', type: 'Concept Store', partner: 'Thrissur Handloom Society', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'TCR-STUDIO-010', name: 'Guruvayur Traditional Pavilion', establishment: 'East Nada Craft Centre', area: 'Guruvayur, Thrissur', type: 'Artisan Hub', partner: 'Temple Loom Weavers', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'KNR-SHOP-011', name: 'Payyambalam Weavers Point', establishment: 'Coastal Weaves Atelier', area: 'Payyambalam, Kannur', type: 'Boutique', partner: 'Malabar Loom Cooperative', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'KTY-STORE-012', name: 'Baker Junction Little Atelier', establishment: 'Baker Craft Arcade', area: 'Baker Junction, Kottayam', type: 'Concept Store', partner: 'Highland Textile Guild', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'PLK-STUDIO-013', name: 'Fort Maidan Heritage Studio', establishment: 'Tipu Fort View Hub', area: 'Fort Maidan, Palakkad', type: 'Kids Studio', partner: 'Palghat Handloom Guild', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'KLM-BOUTIQUE-014', name: 'Asramam Craft Gallery', establishment: 'Asramam Link Boutique', area: 'Asramam, Kollam', type: 'Boutique', partner: 'Quilon Artisan Society', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 },
  { code: 'MLP-HUB-015', name: 'Kottakkal Traditional Centre', establishment: 'Arya Vaidya Heritage Arcade', area: 'Kottakkal, Malappuram', type: 'Artisan Hub', partner: 'Eranad Artisans Circle', active: true, visits: 0, starts: 0, entries: 0, eligible: 0 }
];

document.addEventListener('DOMContentLoaded', async () => {
  initMobileDrawer();
  initRoleSwitcher();
  initGlobalActionInterception();
  initApiStatus();
  await checkBackendConnection();
  await initPageSpecificLogic();
});

/**
 * Mobile Sidebar Drawer
 */
function initMobileDrawer() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (toggleBtn && sidebar && overlay) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

/**
 * Global write-action interception: guarantees Viewer role cannot trigger
 * any action with [data-require-write="true"], even if clicked on <a> or unstyled elements.
 */
function initGlobalActionInterception() {
  document.addEventListener('click', (e) => {
    const writeEl = e.target.closest('[data-require-write="true"]');
    if (writeEl && AdminState.currentRole === ROLES.VIEWER) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}

/**
 * Role Switcher & Permission Enforcement
 */
function initRoleSwitcher() {
  const roleSelect = document.getElementById('roleSwitcherSelect');
  const roleDisplay = document.getElementById('sidebarCurrentRole');

  if (roleSelect) {
    roleSelect.value = AdminState.currentRole;
    roleSelect.addEventListener('change', (e) => {
      setRole(e.target.value);
    });
  }

  if (roleDisplay) {
    roleDisplay.textContent = formatRole(AdminState.currentRole);
  }

  applyRolePermissions();
}

export function setRole(newRole) {
  AdminState.currentRole = newRole;
  sessionStorage.setItem('binth_admin_role', newRole);
  
  const roleDisplay = document.getElementById('sidebarCurrentRole');
  if (roleDisplay) roleDisplay.textContent = formatRole(newRole);

  applyRolePermissions();
}

function formatRole(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN: return 'Super Admin';
    case ROLES.CAMPAIGN_MANAGER: return 'Campaign Manager';
    case ROLES.VIEWER: return 'Viewer (Read-Only)';
    default: return role;
  }
}

export function applyRolePermissions() {
  const isViewer = AdminState.currentRole === ROLES.VIEWER;

  const writeElements = document.querySelectorAll('[data-require-write="true"]');
  writeElements.forEach(el => {
    if (isViewer) {
      el.setAttribute('title', 'Action unavailable in Viewer (read-only) role');
      el.classList.add('disabled');
      if (el.tagName === 'BUTTON') {
        el.setAttribute('disabled', 'true');
        el.disabled = true;
        el.style.opacity = '0.5';
      } else {
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('tabindex', '-1');
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.5';
        el.style.cursor = 'not-allowed';
      }
    } else {
      el.removeAttribute('title');
      el.classList.remove('disabled');
      if (el.tagName === 'BUTTON') {
        el.removeAttribute('disabled');
        el.disabled = false;
        el.style.opacity = '1';
      } else {
        el.removeAttribute('aria-disabled');
        el.removeAttribute('tabindex');
        el.style.pointerEvents = '';
        el.style.opacity = '1';
        el.style.cursor = '';
      }
    }
  });
}

/**
 * Check Live Backend API Connectivity
 */
async function checkBackendConnection() {
  const statusPill = document.getElementById('apiStatusPill');
  const statusBanner = document.getElementById('apiNoticeBanner');
  const endpointDisplay = document.getElementById('apiEndpointDisplay');

  if (endpointDisplay) {
    endpointDisplay.textContent = ApiConfig.getBaseUrl();
  }

  const result = await Api.checkHealth();
  AdminState.apiConnected = result.ok;

  if (statusPill) {
    if (result.ok) {
      statusPill.className = 'api-pill api-pill-live';
      statusPill.innerHTML = '<span class="api-pill-dot"></span> Backend Connected';
      if (statusBanner) statusBanner.style.display = 'none';
    } else {
      statusPill.className = 'api-pill api-pill-disconnected';
      statusPill.innerHTML = '<span class="api-pill-dot"></span> Backend Disconnected';
      if (statusBanner) statusBanner.style.display = 'flex';
    }
  }
}

function initApiStatus() {
  const retryBtn = document.getElementById('retryApiConnectionBtn');
  if (retryBtn && !retryBtn._bound) {
    retryBtn._bound = true;
    retryBtn.addEventListener('click', async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = 'Checking...';
      await checkBackendConnection();
      await refetchPageData();
      retryBtn.disabled = false;
      retryBtn.textContent = 'Retry Connection';
    });
  }
}

/**
 * Route to page-specific controller to bind one-time event listeners.
 * Called once on DOMContentLoaded.
 */
async function initPageSpecificLogic() {
  const pageId = document.body.dataset.page;

  switch (pageId) {
    case 'admin-overview':
      initOverviewPage();
      break;
    case 'admin-campaigns':
      initCampaignsPage();
      break;
    case 'admin-entries':
      initEntriesPage();
      break;
    case 'admin-customers':
      initCustomersPage();
      break;
    case 'admin-sources':
      initSourcesPage();
      break;
    case 'admin-reports':
      initReportsPage();
      break;
    case 'admin-settings':
      initSettingsPage();
      break;
  }

  await refetchPageData();
}

/**
 * Refetches and re-renders data for current page without re-attaching any event listeners.
 * Called on page load and on API reconnection retry.
 */
export async function refetchPageData() {
  const pageId = document.body.dataset.page;

  switch (pageId) {
    case 'admin-overview':
      await fetchOverviewData();
      break;
    case 'admin-campaigns':
      await fetchCampaignsData();
      break;
    case 'admin-entries':
      await fetchEntriesData();
      break;
    case 'admin-customers':
      await fetchCustomersData();
      break;
    case 'admin-sources':
      await fetchSourcesData();
      break;
    case 'admin-reports':
      await fetchReportsData();
      break;
    case 'admin-settings':
      await checkBackendConnection();
      break;
  }

  applyRolePermissions();
}

/* ==========================================================================
   1. DASHBOARD OVERVIEW PAGE
   ========================================================================== */
function initOverviewPage() {
  // Static controls if any in future
}

async function fetchOverviewData() {
  const metricsResult = await Api.getDashboardMetrics();
  
  if (metricsResult.ok && metricsResult.data) {
    const d = metricsResult.data;
    setMetricText('metricActiveCampaigns', d.activeCampaigns ?? 0);
    setMetricText('metricTotalCustomers', d.totalCustomers ?? 0);
    setMetricText('metricTotalEntries', d.totalEntries ?? 0);
    setMetricText('metricQrVisits', d.qrVisits ?? 0);
    setMetricText('metricFormStarts', d.formStarts ?? 0);
    setMetricText('metricConversionRate', (d.conversionRate ? `${d.conversionRate}%` : '0%'));
  } else {
    setMetricText('metricActiveCampaigns', '—');
    setMetricText('metricTotalCustomers', '—');
    setMetricText('metricTotalEntries', '—');
    setMetricText('metricQrVisits', '—');
    setMetricText('metricFormStarts', '—');
    setMetricText('metricConversionRate', '—');
  }

  const campaignsResult = await Api.getCampaigns();
  const tableBody = document.getElementById('overviewCampaignsTableBody');
  if (tableBody) {
    if (campaignsResult.ok && Array.isArray(campaignsResult.data) && campaignsResult.data.length > 0) {
      renderOverviewCampaigns(tableBody, campaignsResult.data);
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h4>No Active Campaigns Found</h4>
            <p>Connect backend to <code>/api/admin/campaigns</code> or publish a campaign in the Campaigns module.</p>
          </td>
        </tr>
      `;
    }
  }
}

function setMetricText(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = value;
}

function renderOverviewCampaigns(container, campaigns) {
  container.innerHTML = campaigns.map(c => `
    <tr>
      <td><strong>${escapeHtml(c.title || c.name)}</strong></td>
      <td><span class="badge badge-${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td>
      <td>${c.startTime ? new Date(c.startTime).toLocaleDateString() : '—'}</td>
      <td>${c.qrVisits ?? 0}</td>
      <td>${c.totalEntries ?? 0}</td>
      <td>${c.conversionRate ? c.conversionRate + '%' : '0%'}</td>
    </tr>
  `).join('');
}

/* ==========================================================================
   2. CAMPAIGNS PAGE
   ========================================================================== */
function initCampaignsPage() {
  const createModal = document.getElementById('createCampaignModal');
  const openCreateBtn = document.getElementById('openCreateCampaignBtn');
  const closeCreateBtn = document.getElementById('closeCreateCampaignBtn');
  const createForm = document.getElementById('createCampaignForm');
  const tableBody = document.getElementById('campaignsTableBody');

  if (openCreateBtn && createModal && !openCreateBtn._bound) {
    openCreateBtn._bound = true;
    openCreateBtn.addEventListener('click', () => {
      createModal.classList.add('active');
    });
  }

  if (closeCreateBtn && createModal && !closeCreateBtn._bound) {
    closeCreateBtn._bound = true;
    closeCreateBtn.addEventListener('click', () => {
      createModal.classList.remove('active');
    });
  }

  if (createForm && !createForm._bound) {
    createForm._bound = true;
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('campTitle').value,
        prize: document.getElementById('campPrize').value,
        description: document.getElementById('campDesc').value,
        durationHours: 48,
        status: 'active'
      };

      const result = await Api.createCampaign(payload);
      if (result.ok) {
        alert('Campaign created successfully on server.');
        createModal.classList.remove('active');
        createForm.reset();
        await fetchCampaignsData();
      } else {
        alert(`Could not create campaign: ${result.error || 'Server unreachable'}`);
      }
    });
  }

  // Event delegation on table body for Draw Winner button (replaces inline onclick)
  if (tableBody && !tableBody._delegationBound) {
    tableBody._delegationBound = true;
    tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.draw-winner-btn');
      if (btn) {
        if (AdminState.currentRole === ROLES.VIEWER) return;
        const { campaignId, campaignTitle, campaignStatus } = btn.dataset;
        openWinnerModal(campaignId, campaignTitle, campaignStatus);
      }
    });
  }

  initWinnerModalHandlers();
}

async function fetchCampaignsData() {
  const tableBody = document.getElementById('campaignsTableBody');
  const createModal = document.getElementById('createCampaignModal');
  const result = await Api.getCampaigns();

  if (tableBody) {
    if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
      renderCampaignsTable(tableBody, result.data);
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-icon">🏷️</div>
            <h4>No Campaigns Found on Backend</h4>
            <p>The backend endpoint at <code>/api/admin/campaigns</code> returned no records or is not yet connected.</p>
            <button class="btn btn-primary btn-sm" id="emptyCreateCampBtn" data-require-write="true">Create First Campaign</button>
          </td>
        </tr>
      `;
      const emptyBtn = document.getElementById('emptyCreateCampBtn');
      if (emptyBtn && createModal) {
        emptyBtn.addEventListener('click', () => createModal.classList.add('active'));
      }
    }
  }
}

function renderCampaignsTable(container, campaigns) {
  container.innerHTML = campaigns.map(c => `
    <tr>
      <td>
        <strong>${escapeHtml(c.title)}</strong><br>
        <small class="text-muted">${escapeHtml(c.prize || '')}</small>
      </td>
      <td><span class="badge badge-${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td>
      <td>${c.startTime ? new Date(c.startTime).toLocaleString() : '—'}</td>
      <td>${c.endTime ? new Date(c.endTime).toLocaleString() : '—'}</td>
      <td><strong>${c.totalEntries ?? 0}</strong></td>
      <td>${c.conversionRate ? c.conversionRate + '%' : '0%'}</td>
      <td>
        <div class="flex gap-xs">
          <button class="btn btn-secondary btn-sm draw-winner-btn" 
                  data-campaign-id="${escapeHtml(c.id)}" 
                  data-campaign-title="${escapeHtml(c.title)}" 
                  data-campaign-status="${escapeHtml(c.status)}" 
                  data-require-write="true">
            Draw Winner
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function initWinnerModalHandlers() {
  const modal = document.getElementById('winnerSelectionModal');
  if (!modal || modal._initialized) return;
  modal._initialized = true;

  const closeBtn = document.getElementById('closeWinnerModalBtn');
  const cancelBtn = document.getElementById('cancelWinnerModalBtn');
  const submitDrawBtn = document.getElementById('executeWinnerDrawBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (submitDrawBtn) {
    submitDrawBtn.addEventListener('click', async () => {
      const campaignId = submitDrawBtn.dataset.campaignId;
      const campaignStatus = submitDrawBtn.dataset.campaignStatus;
      const reason = document.getElementById('winnerDrawReason').value || 'Official campaign close random draw';

      if (campaignStatus === 'active') {
        if (!confirm('CAUTION: This campaign is currently ACTIVE. Drawing a winner prematurely will conclude the 48-hour cycle early. Are you sure you wish to proceed?')) {
          return;
        }
      } else {
        if (!confirm('Are you sure you want to request server-side winner selection for this campaign?')) {
          return;
        }
      }

      submitDrawBtn.disabled = true;
      submitDrawBtn.textContent = 'Processing with server...';

      const result = await Api.selectWinner(campaignId, { reason });
      submitDrawBtn.disabled = false;
      submitDrawBtn.textContent = 'Execute Selection (Server)';

      if (result.ok && result.data) {
        alert(`Winner selected: ${result.data.winnerName || 'Participant'} (${result.data.entryCode || ''})`);
        modal.classList.remove('active');
        await fetchCampaignsData();
      } else {
        alert(`Winner selection error: ${result.error || 'Server operation failed'}`);
      }
    });
  }
}

window.openWinnerModal = function(campaignId, campaignTitle, status) {
  const modal = document.getElementById('winnerSelectionModal');
  const titleEl = document.getElementById('winnerModalCampaignTitle');
  const submitBtn = document.getElementById('executeWinnerDrawBtn');

  if (titleEl) titleEl.textContent = campaignTitle;
  if (submitBtn) {
    submitBtn.dataset.campaignId = campaignId;
    submitBtn.dataset.campaignStatus = status || '';
  }

  // Contextual status alert inside modal
  let statusNotice = document.getElementById('winnerModalStatusNotice');
  if (!statusNotice && modal) {
    statusNotice = document.createElement('div');
    statusNotice.id = 'winnerModalStatusNotice';
    statusNotice.style.margin = 'var(--space-sm) 0';
    const body = modal.querySelector('.modal-body');
    if (body) {
      body.insertBefore(statusNotice, body.children[2] || null);
    }
  }

  if (statusNotice) {
    if (status === 'active') {
      statusNotice.className = 'alert alert-danger';
      statusNotice.style.display = 'block';
      statusNotice.innerHTML = `
        <strong>⚠️ Campaign is currently ACTIVE:</strong><br>
        Entry submission is live. Drawing a winner now will terminate the 48-hour cycle early.
      `;
      if (submitBtn) submitBtn.textContent = 'Execute Selection (Active Campaign)';
    } else if (status === 'draft') {
      statusNotice.className = 'alert alert-warning';
      statusNotice.style.display = 'block';
      statusNotice.innerHTML = `
        <strong>⚠️ Notice: Campaign is in DRAFT status:</strong><br>
        This campaign has not been launched to participants yet.
      `;
      if (submitBtn) submitBtn.textContent = 'Execute Selection';
    } else {
      statusNotice.style.display = 'none';
      if (submitBtn) submitBtn.textContent = 'Execute Selection (Server)';
    }
  }

  if (modal) modal.classList.add('active');
};

/* ==========================================================================
   3. ENTRIES PAGE
   ========================================================================== */
function initEntriesPage() {
  const searchInput = document.getElementById('entriesSearchInput');
  const statusFilter = document.getElementById('entriesStatusFilter');

  if (searchInput && !searchInput._bound) {
    searchInput._bound = true;
    searchInput.addEventListener('input', debounce(fetchEntriesData, 300));
  }
  if (statusFilter && !statusFilter._bound) {
    statusFilter._bound = true;
    statusFilter.addEventListener('change', fetchEntriesData);
  }
}

async function fetchEntriesData() {
  const tableBody = document.getElementById('entriesTableBody');
  const searchInput = document.getElementById('entriesSearchInput');
  const statusFilter = document.getElementById('entriesStatusFilter');

  const params = {};
  if (searchInput && searchInput.value) params.q = searchInput.value.trim();
  if (statusFilter && statusFilter.value) params.eligible = statusFilter.value;

  const result = await Api.getEntries(params);

  if (tableBody) {
    if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
      renderEntriesTable(tableBody, result.data);
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-icon">🎟️</div>
            <h4>No Entries from Server</h4>
            <p>The backend endpoint at <code>/api/admin/entries</code> returned no records or is not connected.</p>
          </td>
        </tr>
      `;
      const paginationBar = document.getElementById('entriesPaginationBar');
      if (paginationBar) paginationBar.style.display = 'none';
    }
  }
}

function renderEntriesTable(container, entries) {
  container.innerHTML = entries.map(e => `
    <tr>
      <td><code>${escapeHtml(e.entryCode || e.id)}</code></td>
      <td><strong>${escapeHtml(e.parentName)}</strong></td>
      <td>
        <span class="phone-masked">${escapeHtml(e.phoneMasked || e.whatsappPhone)}</span>
      </td>
      <td><span class="badge badge-rose">${escapeHtml(e.ageRange || '—')}</span></td>
      <td><code>${escapeHtml(e.sourceCode || 'DIRECT')}</code></td>
      <td>
        ${e.isEligible 
          ? '<span class="badge badge-active">Eligible</span>' 
          : '<span class="badge badge-closed">Ineligible</span>'}
      </td>
      <td>${e.marketingConsent ? '<span class="badge badge-sage">Yes</span>' : '<span class="text-muted">No</span>'}</td>
    </tr>
  `).join('');

  // Update pagination bar count
  const paginationBar = document.getElementById('entriesPaginationBar');
  const countInfo = document.getElementById('entriesCountInfo');
  if (paginationBar && countInfo) {
    if (entries.length > 0) {
      paginationBar.style.display = 'flex';
      countInfo.innerHTML = `Showing <strong>${entries.length}</strong> recorded entries`;
    } else {
      paginationBar.style.display = 'none';
    }
  }
}

/* ==========================================================================
   4. CUSTOMERS PAGE
   ========================================================================== */
function initCustomersPage() {
  const searchInput = document.getElementById('customersSearchInput');

  if (searchInput && !searchInput._bound) {
    searchInput._bound = true;
    searchInput.addEventListener('input', debounce(fetchCustomersData, 300));
  }
}

async function fetchCustomersData() {
  const tableBody = document.getElementById('customersTableBody');
  const searchInput = document.getElementById('customersSearchInput');

  const params = {};
  if (searchInput && searchInput.value) params.q = searchInput.value.trim();

  const result = await Api.getCustomers(params);

  if (tableBody) {
    if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
      renderCustomersTable(tableBody, result.data);
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-state-icon">👥</div>
            <h4>No Customer Records from Server</h4>
            <p>Customer directory will populate from PostgreSQL once participants enter giveaways.</p>
          </td>
        </tr>
      `;
      const paginationBar = document.getElementById('customersPaginationBar');
      if (paginationBar) paginationBar.style.display = 'none';
    }
  }
}

function renderCustomersTable(container, customers) {
  container.innerHTML = customers.map(c => `
    <tr>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>${escapeHtml(c.phoneMasked || c.phone)}</td>
      <td>${escapeHtml(c.location || 'Kerala')}</td>
      <td>${c.campaignsEnteredCount ?? 1}</td>
      <td>
        ${c.hasMarketingConsent 
          ? '<span class="badge badge-sage">Consented</span>' 
          : '<span class="text-muted">Not Opted In</span>'}
      </td>
      <td>
        ${c.isPurchaser 
          ? '<span class="badge badge-maroon">Purchaser</span>' 
          : '<span class="badge badge-outline">Giveaway Entrant</span>'}
      </td>
    </tr>
  `).join('');

  // Update pagination bar count
  const paginationBar = document.getElementById('customersPaginationBar');
  const countInfo = document.getElementById('customersCountInfo');
  if (paginationBar && countInfo) {
    if (customers.length > 0) {
      paginationBar.style.display = 'flex';
      countInfo.innerHTML = `Showing <strong>${customers.length}</strong> verified customer profiles`;
    } else {
      paginationBar.style.display = 'none';
    }
  }
}

/* ==========================================================================
   5. QR SOURCES PAGE (15 Target Campaign Locations)
   ========================================================================== */
function getLocalConfiguredLocations() {
  try {
    const saved = localStorage.getItem('binth_locations');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

function saveLocalConfiguredLocations(locations) {
  try {
    localStorage.setItem('binth_locations', JSON.stringify(locations));
  } catch (e) {}
}

function initSourcesPage() {
  const tableBody = document.getElementById('sourcesTableBody');
  const createModal = document.getElementById('createSourceModal');
  const openModalBtn = document.getElementById('openCreateSourceBtn');
  const closeModalBtn = document.getElementById('closeCreateSourceBtn');
  const createForm = document.getElementById('createSourceForm');
  const preloadBtn = document.getElementById('preload15LocationsBtn');
  const progressText = document.getElementById('locationProgressText');
  const progressBar = document.getElementById('locationProgressBar');
  const formError = document.getElementById('sourceFormError');

  // Preload button: Populate initial 15 locations template
  if (preloadBtn && !preloadBtn._bound) {
    preloadBtn._bound = true;
    preloadBtn.addEventListener('click', async () => {
      if (!confirm('Populate the 15 standard campaign locations across Kerala?')) return;
      const locations = [...INITIAL_15_LOCATIONS_TEMPLATE];
      saveLocalConfiguredLocations(locations);
      AdminState.activeLocations = locations;
      renderSourcesTable(tableBody, locations);
      updateLocationProgressUI(locations.length, progressText, progressBar);
      applyRolePermissions();
      alert('15 campaign locations populated successfully.');
    });
  }

  if (openModalBtn && createModal && !openModalBtn._bound) {
    openModalBtn._bound = true;
    openModalBtn.addEventListener('click', () => {
      createForm.reset();
      if (formError) formError.style.display = 'none';
      document.getElementById('srcCode').removeAttribute('readonly');
      document.getElementById('createSrcModalTitle').textContent = 'Configure QR Poster Location';
      createModal.classList.add('active');
    });
  }

  if (closeModalBtn && createModal && !closeModalBtn._bound) {
    closeModalBtn._bound = true;
    closeModalBtn.addEventListener('click', () => createModal.classList.remove('active'));
  }

  // Handle Create / Edit Submission with Duplicate Prevention
  if (createForm && !createForm._bound) {
    createForm._bound = true;
    createForm.onsubmit = async (e) => {
      e.preventDefault();
      const code = document.getElementById('srcCode').value.trim().toUpperCase();
      const name = document.getElementById('srcName').value.trim();
      const establishment = document.getElementById('srcEstablishment').value.trim();
      const area = document.getElementById('srcArea').value.trim();
      const type = document.getElementById('srcType').value;
      const partner = document.getElementById('srcPartner').value.trim();

      // Validate code format
      if (!/^[A-Z0-9_-]{3,35}$/.test(code)) {
        if (formError) {
          formError.textContent = 'Location code must be 3-35 characters (letters, numbers, hyphens).';
          formError.style.display = 'block';
        }
        return;
      }

      // Read directly from AdminState.activeLocations to avoid stale closure state
      let locations = AdminState.activeLocations || [];
      const existingIdx = locations.findIndex(loc => loc.code === code);
      const isEditing = document.getElementById('srcCode').hasAttribute('readonly');

      if (!isEditing && existingIdx !== -1) {
        if (formError) {
          formError.textContent = `A location with code "${code}" is already registered. Codes must be unique.`;
          formError.style.display = 'block';
        }
        return;
      }

      const newLoc = {
        code,
        name,
        establishment,
        area,
        type,
        partner,
        active: true,
        visits: 0,
        starts: 0,
        entries: 0
      };

      if (isEditing && existingIdx !== -1) {
        locations[existingIdx] = { ...locations[existingIdx], ...newLoc };
      } else {
        locations.push(newLoc);
      }

      saveLocalConfiguredLocations(locations);
      AdminState.activeLocations = locations;

      // Also notify backend if connected
      Api.createSource(newLoc).catch(() => {});

      createModal.classList.remove('active');
      renderSourcesTable(tableBody, locations);
      updateLocationProgressUI(locations.length, progressText, progressBar);
      applyRolePermissions();
    };
  }

  // Event delegation on sources table body (replaces inline onclick)
  if (tableBody && !tableBody._delegationBound) {
    tableBody._delegationBound = true;
    tableBody.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.copy-link-btn');
      if (copyBtn) {
        copyLocationQrUrl(copyBtn.dataset.url, copyBtn);
        return;
      }

      const qrBtn = e.target.closest('.open-qr-btn');
      if (qrBtn) {
        openQrModal(qrBtn.dataset.code, qrBtn.dataset.name, qrBtn.dataset.url);
        return;
      }

      const toggleBtn = e.target.closest('.toggle-status-btn');
      if (toggleBtn) {
        if (AdminState.currentRole === ROLES.VIEWER) return;
        toggleLocationStatus(toggleBtn.dataset.code);
        return;
      }
    });
  }

  initQrModalControls();
}

async function fetchSourcesData() {
  const tableBody = document.getElementById('sourcesTableBody');
  const progressText = document.getElementById('locationProgressText');
  const progressBar = document.getElementById('locationProgressBar');

  let locations = [];
  const apiResult = await Api.getSources();
  if (apiResult.ok && Array.isArray(apiResult.data) && apiResult.data.length > 0) {
    locations = apiResult.data;
  } else {
    locations = getLocalConfiguredLocations();
  }
  AdminState.activeLocations = locations;

  updateLocationProgressUI(locations.length, progressText, progressBar);
  renderSourcesTable(tableBody, locations);
}

function updateLocationProgressUI(count, textEl, barEl) {
  if (textEl) {
    textEl.textContent = `${count} of 15 locations configured`;
  }
  if (barEl) {
    const pct = Math.min(100, Math.round((count / 15) * 100));
    barEl.style.width = `${pct}%`;
  }
}

function renderSourcesTable(container, sources) {
  if (!container) return;

  if (!sources || sources.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-icon">📍</div>
          <h4>No Physical Locations Configured</h4>
          <p>Click "⚡ Populate Initial 15 Locations" or "+ Add Location" to configure the campaign destinations.</p>
        </td>
      </tr>
    `;
    return;
  }

  const origin = window.location.origin;

  container.innerHTML = sources.map(s => {
    const destinationUrl = `${origin}/index.html?source=${encodeURIComponent(s.code)}`;
    const visits = s.visits ?? 0;
    const entries = s.entries ?? 0;
    const conversion = visits > 0 ? ((entries / visits) * 100).toFixed(1) + '%' : '0.0%';
    const isActive = s.active !== false;

    return `
      <tr>
        <td><code>${escapeHtml(s.code)}</code></td>
        <td>
          <strong>${escapeHtml(s.name)}</strong><br>
          <small class="text-muted">${escapeHtml(s.establishment || '')}</small>
        </td>
        <td>${escapeHtml(s.area || s.location || '')}</td>
        <td><span class="badge badge-outline">${escapeHtml(s.type || 'Boutique')}</span></td>
        <td>
          ${isActive 
            ? '<span class="badge badge-active">Active</span>' 
            : '<span class="badge badge-closed">Inactive</span>'}
        </td>
        <td>${visits}</td>
        <td>${entries}</td>
        <td><strong>${conversion}</strong></td>
        <td>
          <div class="flex gap-xs" style="flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm copy-link-btn" data-url="${escapeHtml(destinationUrl)}" title="Copy direct QR link to clipboard">
              📋 Copy Link
            </button>
            <button class="btn btn-primary btn-sm open-qr-btn" data-code="${escapeHtml(s.code)}" data-name="${escapeHtml(s.name)}" data-url="${escapeHtml(destinationUrl)}" title="Preview and download QR code">
              🔲 QR Code
            </button>
            <button class="btn btn-outline btn-sm toggle-status-btn" data-code="${escapeHtml(s.code)}" data-require-write="true">
              ${isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// One-click clipboard copy helper
window.copyLocationQrUrl = function(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    const origText = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = origText; }, 1500);
  }).catch(() => {
    prompt('Copy QR destination URL:', url);
  });
};

// Toggle location active/inactive: updates both AdminState.activeLocations and localStorage
window.toggleLocationStatus = function(code) {
  let locations = AdminState.activeLocations;
  if (!locations || locations.length === 0) {
    locations = getLocalConfiguredLocations();
  }
  const target = locations.find(l => l.code === code);
  if (target) {
    target.active = !target.active;
    AdminState.activeLocations = locations;
    saveLocalConfiguredLocations(locations);
    const tableBody = document.getElementById('sourcesTableBody');
    renderSourcesTable(tableBody, locations);
    applyRolePermissions();
    Api.updateSource(code, { active: target.active }).catch(() => {});
  }
};

/* QR Code Preview & Download Modal Controls */
function initQrModalControls() {
  const modal = document.getElementById('qrCodePreviewModal');
  if (!modal || modal._initialized) return;
  modal._initialized = true;

  const closeBtn = document.getElementById('closeQrModalBtn');
  const copyBtn = document.getElementById('copyQrUrlBtn');
  const downloadPngBtn = document.getElementById('downloadQrPngBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (copyBtn) {
    copyBtn.onclick = () => {
      const url = document.getElementById('qrModalUrlDisplay').textContent;
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = '📋 Copy URL'; }, 1500);
      });
    };
  }

  if (downloadPngBtn) {
    downloadPngBtn.onclick = () => {
      const canvas = document.getElementById('qrHiddenCanvas');
      const code = document.getElementById('qrModalCodeDisplay').textContent;
      const link = document.createElement('a');
      link.download = `BINTH_QR_${code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  }
}

window.openQrModal = function(code, name, destinationUrl) {
  const modal = document.getElementById('qrCodePreviewModal');
  const nameEl = document.getElementById('qrModalLocationName');
  const codeEl = document.getElementById('qrModalCodeDisplay');
  const urlEl = document.getElementById('qrModalUrlDisplay');
  const svgContainer = document.getElementById('qrSvgContainer');
  const hiddenCanvas = document.getElementById('qrHiddenCanvas');

  if (nameEl) nameEl.textContent = name;
  if (codeEl) codeEl.textContent = code;
  if (urlEl) urlEl.textContent = destinationUrl;

  // Render SVG QR Code into preview box
  if (svgContainer) {
    svgContainer.innerHTML = QRCode.generateSVG(destinationUrl, 240);
  }

  // Also render into hidden Canvas for high-res PNG download
  if (hiddenCanvas) {
    QRCode.renderToCanvas(hiddenCanvas, destinationUrl, 320);
  }

  if (modal) modal.classList.add('active');
};

/* ==========================================================================
   6. REPORTS PAGE (Source Performance Analytics)
   ========================================================================== */
function initReportsPage() {
  const exportBtn = document.getElementById('exportReportsCsvBtn');

  if (exportBtn && !exportBtn._bound) {
    exportBtn._bound = true;
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Requesting server export...';

      const result = await Api.exportCsv('source_performance');
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export CSV Report';

      if (result.ok) {
        alert('CSV export generated by backend. File download initiated.');
      } else {
        alert(`Export Notice: Authorized CSV customer exports require an active backend endpoint at /api/admin/export.\nDetails: ${result.error}`);
      }
    });
  }
}

async function fetchReportsData() {
  const tableBody = document.getElementById('reportsTableBody');
  const result = await Api.getReports();
  let reportData = [];

  if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
    reportData = result.data;
  } else {
    // Show configured locations with honest 0/recorded stats
    const configured = getLocalConfiguredLocations();
    reportData = configured.map(loc => ({
      name: loc.name,
      code: loc.code,
      visits: loc.visits ?? 0,
      starts: loc.starts ?? 0,
      entries: loc.entries ?? 0,
      eligible: loc.eligible ?? 0
    }));
  }

  if (tableBody) {
    if (reportData.length > 0) {
      renderReportsTable(tableBody, reportData);
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h4>No Location Reports Available</h4>
            <p>Configure QR locations in the "QR Sources" tab or connect to <code>/api/admin/reports</code>.</p>
          </td>
        </tr>
      `;
    }
  }
}

function renderReportsTable(container, reports) {
  container.innerHTML = reports.map(r => {
    const visits = r.visits ?? 0;
    const entries = r.entries ?? 0;
    // Formula: successful submissions / recorded visits * 100 (Safe 0 visit handling)
    const conversionRate = visits > 0 ? ((entries / visits) * 100).toFixed(1) + '%' : '0.0%';

    return `
      <tr>
        <td><strong>${escapeHtml(r.name || r.locationName || 'Boutique Partner')}</strong></td>
        <td><code>${escapeHtml(r.code || r.sourceCode)}</code></td>
        <td>${visits}</td>
        <td>${r.starts ?? 0}</td>
        <td>${entries}</td>
        <td>${r.eligible ?? entries}</td>
        <td><strong>${conversionRate}</strong></td>
      </tr>
    `;
  }).join('');
}

/* ==========================================================================
   7. SETTINGS PAGE
   ========================================================================== */
function initSettingsPage() {
  const apiUrlInput = document.getElementById('settingsApiBaseUrl');
  const saveBtn = document.getElementById('saveSettingsBtn');
  const testBtn = document.getElementById('testConnectionBtn');
  const testResult = document.getElementById('connectionTestResult');

  if (apiUrlInput) {
    apiUrlInput.value = ApiConfig.getBaseUrl();
  }

  if (saveBtn && apiUrlInput && !saveBtn._bound) {
    saveBtn._bound = true;
    saveBtn.addEventListener('click', () => {
      ApiConfig.setBaseUrl(apiUrlInput.value);
      alert('API Base URL saved in browser storage for this session.');
      checkBackendConnection();
    });
  }

  if (testBtn && testResult && !testBtn._bound) {
    testBtn._bound = true;
    testBtn.addEventListener('click', async () => {
      testBtn.disabled = true;
      testBtn.textContent = 'Pinging...';
      testResult.style.display = 'block';

      const res = await Api.checkHealth();
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';

      if (res.ok) {
        testResult.className = 'alert alert-success';
        testResult.innerHTML = `<strong>Connected!</strong> Backend service responded at <code>${escapeHtml(ApiConfig.getBaseUrl())}</code>`;
      } else {
        testResult.className = 'alert alert-danger';
        testResult.innerHTML = `
          <strong>Connection Failed:</strong> ${escapeHtml(res.error || 'Server not reachable')}<br>
          <small>Make sure your backend server is running and listening on the specified port.</small>
        `;
      }
    });
  }
}

/* Utility Helpers */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
