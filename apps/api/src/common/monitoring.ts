// Only explicit, sanitized exception reporting is enabled. No automatic request capture.
export const monitoringPrivacy = {
  sendDefaultPii: false,
  defaultIntegrations: false,
  beforeSend(event: any) {
    delete event.user; delete event.extra; delete event.contexts;
    event.breadcrumbs = [];
    if (event.request) {
      const value = String(event.request.url || '').split('?')[0].split('#')[0];
      let url = value;
      try { const parsed = new URL(value); parsed.username = ''; parsed.password = ''; url = parsed.toString(); } catch { /* Relative request path. */ }
      event.request = { method: event.request.method, url };
    }
    if (event.exception?.values) for (const value of event.exception.values) {
      if (!/^HTTP \d{3} at (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/[^?\s]*$/.test(String(value.value))) value.value = 'Application failure';
    }
    if (event.message) event.message = 'Application failure';
    return event;
  },
};
