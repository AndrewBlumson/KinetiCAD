export interface ReplitHostEnvironment {
  REPLIT_DEV_DOMAIN?: string;
  REPLIT_DOMAINS?: string;
}

/** Trust only this app's explicit domains; Vite already permits localhost/IPs. */
export function replitAllowedHosts(env: ReplitHostEnvironment): string[] {
  const hosts = new Set<string>();
  for (const key of ['REPLIT_DEV_DOMAIN', 'REPLIT_DOMAINS'] as const) {
    const values = key === 'REPLIT_DOMAINS' ? (env[key] ?? '').split(',') : [env[key] ?? ''];
    for (const value of values) {
      const entry = value.trim();
      if (!entry) continue;
      try {
        // Accept a documented hostname or an HTTP(S) origin, never a path,
        // credentials or Vite's leading-dot subdomain allowlist syntax.
        if (/[\s\\*]/.test(entry) || entry.startsWith('.') || entry.startsWith('/')) throw new Error();
        const url = new URL(entry.includes('://') ? entry : `https://${entry}`);
        const host = url.hostname.toLowerCase();
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
            url.pathname !== '/' || url.search || url.hash || host.length > 253 ||
            !host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
          throw new Error();
        }
        hosts.add(host);
      } catch {
        throw new Error(`${key} must contain exact hostnames or HTTP(S) origins, without wildcard domains, paths or credentials.`);
      }
    }
  }
  return [...hosts];
}
