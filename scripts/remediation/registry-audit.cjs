// Public npm advisory lookup only. No application modules or credentials are loaded.
const fs = require('node:fs');
const semver = require('/app/node_modules/semver');
(async () => {
  const lock = JSON.parse(fs.readFileSync('/verification/package-lock.json', 'utf8'));
  const packages = [];
  for (const [path, value] of Object.entries(lock.packages || {})) {
    if (!path || !value.version || value.link) continue;
    const name = value.name || path.slice(path.lastIndexOf('node_modules/') + 13);
    packages.push({ name, version: value.version, dev: !!value.dev });
  }
  const versions = {};
  for (const p of packages) versions[p.name] = [...new Set([...(versions[p.name] || []), p.version])];
  const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(versions), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error();
  const advisories = await response.json(), found = new Map();
  for (const p of packages) for (const advisory of advisories[p.name] || []) {
    if (semver.valid(p.version) && semver.satisfies(p.version, advisory.vulnerable_versions, { includePrerelease: true })) {
      const key = `${p.name}:${p.version}:${advisory.id}`;
      const existing = found.get(key);
      found.set(key, { package: p.name, version: p.version, devOnly: existing ? existing.devOnly && p.dev : p.dev,
        severity: advisory.severity, id: advisory.id, url: advisory.url, title: advisory.title, vulnerableRange: advisory.vulnerable_versions });
    }
  }
  const result = { source: 'npm bulk advisories', packages: packages.length, findings: [...found.values()] };
  fs.writeFileSync('/tmp/registry-audit.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ packages: packages.length, findings: result.findings }));
  if (result.findings.some(f => ['high', 'critical'].includes(f.severity))) process.exitCode = 1;
})().catch(() => { console.error('Registry advisory lookup failed'); process.exitCode = 2; });
