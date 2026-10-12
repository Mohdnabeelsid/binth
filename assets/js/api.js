/**
 * BINTH.IN — API Client Module
 * Single location for all server interactions.
 * 
 * STRICT COMPLIANCE:
 * - NO mock data is fabricated.
 * - Real HTTP requests are executed against the configured API baseUrl.
 * - Network errors and unavailable backend states are reported transparently.
 */

export const ApiConfig = {
  // Base URL for backend endpoints. Checked in priority order:
  // 1. localStorage override ('binth_api_url')
  // 2. window.BINTH_CONFIG.apiUrl (runtime deployment config)
  // 3. Default relative '/api' (same-origin / reverse proxy)
  getBaseUrl() {
    const customUrl = localStorage.getItem('binth_api_url');
    if (customUrl) return customUrl.trim();
    if (typeof window !== 'undefined' && window.BINTH_CONFIG && window.BINTH_CONFIG.apiUrl) {
      return window.BINTH_CONFIG.apiUrl.trim();
    }
    return '/api';
  },
  setBaseUrl(url) {
    if (url) {
      localStorage.setItem('binth_api_url', url.trim());
    } else {
      localStorage.removeItem('binth_api_url');
    }
  }
};

/**
 * Core HTTP Request Wrapper
 */
async function apiRequest(endpoint, options = {}) {
  const baseUrl = ApiConfig.getBaseUrl().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const defaultHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  // Add auth token if available from authenticated session
  const authToken = sessionStorage.getItem('binth_auth_token');
  if (authToken) {
    defaultHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type') || '';
    let responseData = null;

    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: (responseData && responseData.message) || response.statusText || `HTTP ${response.status}`,
        data: responseData
      };
    }

    return {
      ok: true,
      status: response.status,
      data: responseData
    };
  } catch (networkError) {
    // Network failure (server down, CORS error, offline, or connection refused)
    return {
      ok: false,
      status: 0,
      error: 'Backend API service is currently unreachable. Please ensure the backend server is running and endpoint is configured correctly.',
      isNetworkError: true,
      details: networkError.message
    };
  }
}

export const Api = {
  /**
   * Health check / diagnostic ping
   */
  async checkHealth() {
    return await apiRequest('/health', { method: 'GET' });
  },

  /**
   * Public: Fetch active campaign details for a given QR source code
   * Endpoint: GET /api/campaigns/active?source=MCH-SHOP-001
   */
  async getActiveCampaign(sourceCode) {
    const query = sourceCode ? `?source=${encodeURIComponent(sourceCode)}` : '';
    return await apiRequest(`/campaigns/active${query}`, { method: 'GET' });
  },

  /**
   * Public: Submit a giveaway participant entry
   * Endpoint: POST /api/giveaway/entries
   */
  async submitEntry(entryPayload) {
    return await apiRequest('/giveaway/entries', {
      method: 'POST',
      body: JSON.stringify(entryPayload)
    });
  },

  /**
   * Public: Record a landing page visit from a QR source
   * Endpoint: POST /api/giveaway/visit
   */
  async recordVisit(sourceCode) {
    if (!sourceCode) return { ok: false, error: 'No source code provided' };
    return await apiRequest('/giveaway/visit', {
      method: 'POST',
      body: JSON.stringify({ sourceCode, timestamp: new Date().toISOString() })
    });
  },

  /**
   * Public: Record initial interaction / form start from a QR source
   * Endpoint: POST /api/giveaway/start
   */
  async recordFormStart(sourceCode) {
    if (!sourceCode) return { ok: false, error: 'No source code provided' };
    return await apiRequest('/giveaway/start', {
      method: 'POST',
      body: JSON.stringify({ sourceCode, timestamp: new Date().toISOString() })
    });
  },

  /**
   * Admin: Get dashboard overview metrics
   * Endpoint: GET /api/admin/metrics
   */
  async getDashboardMetrics() {
    return await apiRequest('/admin/metrics', { method: 'GET' });
  },

  /**
   * Admin: Fetch campaign list with optional status filter
   * Endpoint: GET /api/admin/campaigns?status=...
   */
  async getCampaigns(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await apiRequest(`/admin/campaigns${query ? `?${query}` : ''}`, { method: 'GET' });
  },

  /**
   * Admin: Create a new campaign
   * Endpoint: POST /api/admin/campaigns
   */
  async createCampaign(campaignData) {
    return await apiRequest('/admin/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaignData)
    });
  },

  /**
   * Admin: Update an existing campaign
   * Endpoint: PUT /api/admin/campaigns/:id
   */
  async updateCampaign(campaignId, updateData) {
    return await apiRequest(`/admin/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  },

  /**
   * Admin: Fetch entries list with search/filter/pagination
   * Endpoint: GET /api/admin/entries
   */
  async getEntries(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await apiRequest(`/admin/entries${query ? `?${query}` : ''}`, { method: 'GET' });
  },

  /**
   * Admin: Fetch customer directory with search/filters
   * Endpoint: GET /api/admin/customers
   */
  async getCustomers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await apiRequest(`/admin/customers${query ? `?${query}` : ''}`, { method: 'GET' });
  },

  /**
   * Admin: Fetch QR source locations and statistics
   * Endpoint: GET /api/admin/sources
   */
  async getSources() {
    return await apiRequest('/admin/sources', { method: 'GET' });
  },

  /**
   * Admin: Create a new QR source
   * Endpoint: POST /api/admin/sources
   */
  async createSource(sourceData) {
    return await apiRequest('/admin/sources', {
      method: 'POST',
      body: JSON.stringify(sourceData)
    });
  },

  /**
   * Admin: Update an existing QR source
   * Endpoint: PUT /api/admin/sources/:code
   */
  async updateSource(sourceCode, sourceData) {
    return await apiRequest(`/admin/sources/${encodeURIComponent(sourceCode)}`, {
      method: 'PUT',
      body: JSON.stringify(sourceData)
    });
  },

  /**
   * Admin: Toggle source active status
   * Endpoint: PATCH /api/admin/sources/:code/status
   */
  async toggleSourceStatus(sourceCode, isActive) {
    return await apiRequest(`/admin/sources/${encodeURIComponent(sourceCode)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active: isActive })
    });
  },

  /**
   * Admin: Delete a QR source
   * Endpoint: DELETE /api/admin/sources/:code
   */
  async deleteSource(sourceCode) {
    return await apiRequest(`/admin/sources/${encodeURIComponent(sourceCode)}`, {
      method: 'DELETE'
    });
  },

  /**
   * Admin: Fetch conversion reports
   * Endpoint: GET /api/admin/reports
   */
  async getReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await apiRequest(`/admin/reports${query ? `?${query}` : ''}`, { method: 'GET' });
  },

  /**
   * Admin: Trigger secure server-side winner selection
   * Endpoint: POST /api/admin/campaigns/:id/select-winner
   */
  async selectWinner(campaignId, payload) {
    return await apiRequest(`/admin/campaigns/${encodeURIComponent(campaignId)}/select-winner`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Admin: Close an active campaign
   * Endpoint: POST /api/admin/campaigns/:id/close
   */
  async closeCampaign(campaignId) {
    return await apiRequest(`/admin/campaigns/${encodeURIComponent(campaignId)}/close`, {
      method: 'POST'
    });
  },

  /**
   * Admin: Request authorized CSV export from backend
   * Endpoint: GET /api/admin/export?type=...
   */
  async exportCsv(type, params = {}) {
    const queryParams = new URLSearchParams({ type, ...params }).toString();
    return await apiRequest(`/admin/export?${queryParams}`, { method: 'GET' });
  }
};
