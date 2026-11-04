import { monitoringPrivacy } from './monitoring';
describe('production monitoring confidentiality', () => {
  it('removes credentials, reset queries, provider context, breadcrumbs and arbitrary errors', () => {
    const event: any = { user: { email: 'private-fixture' }, extra: { authorization: 'private-fixture' }, contexts: { request: 'private-fixture' },
      request: { url: 'https://user:private-fixture@api.doxera.in/auth?token=private-fixture', method: 'POST', headers: { authorization: 'private-fixture' }, data: 'private-fixture' },
      breadcrumbs: [{ data: 'private-fixture' }], exception: { values: [{ value: 'private-fixture' }] }, message: 'private-fixture' };
    const sanitized = monitoringPrivacy.beforeSend(event);
    expect(JSON.stringify(sanitized)).not.toContain('private-fixture');
    expect(sanitized.request).toEqual({ method: 'POST', url: 'https://api.doxera.in/auth' });
    expect(monitoringPrivacy.defaultIntegrations).toBe(false);
  });
  it('preserves the controlled HTTP failure message used by the exception filter', () => {
    const event = { exception: { values: [{ value: 'HTTP 500 at POST /api/v1/pdf/jobs' }] } };
    expect(monitoringPrivacy.beforeSend(event).exception.values[0].value).toBe('HTTP 500 at POST /api/v1/pdf/jobs');
  });
});
