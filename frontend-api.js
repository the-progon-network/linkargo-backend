// ============================================
// LINKARGO REAL API
// Replace src/api/index.js with this file
// ============================================

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// ── Helper: make authenticated requests ──
async function request(method, path, body = null) {
  const token = localStorage.getItem('linkargo_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Auth ──
export const auth = {
  login: ({ email, password }) => request('POST', '/auth/login', { email, password }),
  register: (form) => request('POST', '/auth/register', form),
  me: () => request('GET', '/auth/me'),
};

// ── Jobs ──
export const jobs = {
  list: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.vehicle_type) params.set('vehicle_type', filters.vehicle_type);
    if (filters.city) params.set('city', filters.city);
    const qs = params.toString();
    return request('GET', `/jobs${qs ? '?' + qs : ''}`);
  },
  myJobs: () => request('GET', '/jobs/my'),
  get: (id) => request('GET', `/jobs/${id}`),
  create: (form) => request('POST', '/jobs', form),
  updateStatus: (id, status) => request('PATCH', `/jobs/${id}/status`, { status }),
};

// ── Quotes ──
export const quotes = {
  submit: (jobId, form) => request('POST', `/quotes/${jobId}`, form),
  listForJob: (jobId) => request('GET', `/quotes/job/${jobId}`),
  myQuotes: () => request('GET', '/quotes/my'),
  accept: (quoteId) => request('PATCH', `/quotes/${quoteId}/accept`),
  reject: (quoteId) => request('PATCH', `/quotes/${quoteId}/reject`),
};

// ── Stats ──
export const stats = {
  shipper: () => request('GET', '/jobs/stats/shipper'),
  carrier: () => request('GET', '/jobs/stats/carrier'),
};

// ── Profiles ──
export const profiles = {
  update: (form) => request('PATCH', '/profiles/me', form),
};
