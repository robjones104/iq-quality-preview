const KEY = 'iq-auth';

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) === 'true';
}

export function login(password: string): boolean {
  const expected = process.env.NEXT_PUBLIC_PREVIEW_PASSWORD;
  if (!expected || password === expected) {
    localStorage.setItem(KEY, 'true');
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem(KEY);
}
