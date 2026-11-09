import { describe, expect, it } from 'vitest';
import { isOrganizationList } from '../workspace';

const member = { id: 'm1', userId: 'u1', role: 'OWNER', user: { id: 'u1', name: null, email: 'owner@example.com' } };
const org = { id: 'o1', name: 'Team', plan: 'BUSINESS', myRole: 'OWNER', storageUsedBytes: '0', storageLimitBytes: '53687091200', members: [member] };

describe('isOrganizationList', () => {
  it('accepts the API shape, including an empty list and members without a name', () => {
    expect(isOrganizationList([org])).toBe(true);
    expect(isOrganizationList([])).toBe(true);
  });

  it.each([
    ['an object instead of a list', {}],
    ['an error payload', { message: 'Internal server error occurred' }],
    ['null', null],
    ['an organization without members', [{ ...org, members: undefined }]],
    ['a member without a user', [{ ...org, members: [{ ...member, user: null }] }]],
    ['a member user without an email', [{ ...org, members: [{ ...member, user: { name: 'x' } }] }]],
    ['a non-string id', [{ ...org, id: 7 }]],
  ])('rejects %s', (_label, value) => {
    expect(isOrganizationList(value)).toBe(false);
  });
});
