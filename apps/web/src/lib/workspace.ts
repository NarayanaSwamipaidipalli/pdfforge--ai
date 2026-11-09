import { useAuthStore } from './auth-store';

export function formatBytes(value: number | string | undefined | null) {
  if (value === undefined || value === null || !Number.isFinite(Number(value)) || Number(value) < 0) return 'Unavailable';
  const bytes = Number(value);
  if (bytes === 0) return '0 B';
  const index = Math.max(0, Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024))));
  return `${(bytes / 1024 ** index).toLocaleString('en-US', { maximumFractionDigits: index > 0 ? 1 : 0 })} ${['B', 'KB', 'MB', 'GB', 'TB'][index]}`;
}

export async function downloadAuthenticated(endpoint: string, fallbackFilename: string) {
  let token = localStorage.getItem('doxera_token');
  const request = () => fetch(`/api/v1${endpoint}`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
  let response = await request();
  if (response.status === 401) { token = await useAuthStore.getState().refreshTokens(); if (token) response = await request(); }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || 'The document could not be downloaded.');
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error('The downloaded document is empty.');
  const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1];
  let decoded = fallbackFilename;
  try { if (filename) decoded = decodeURIComponent(filename); } catch {}
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = decoded.replace(/[\\/\x00-\x1f]/g, '_');
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
