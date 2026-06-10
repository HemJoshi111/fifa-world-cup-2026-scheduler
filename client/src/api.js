// Pointing to our Express backend route
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1/worldcup';

export async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}
