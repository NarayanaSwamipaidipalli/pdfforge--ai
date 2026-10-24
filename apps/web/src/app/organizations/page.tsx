'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import {
  Users,
  UserPlus,
  Building,
  Trash2,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  Plus,
  AlertCircle,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface OrgMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
  };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  myRole?: string;
  storageLimitBytes?: number | string;
  storageUsedBytes?: number | string;
  members: OrgMember[];
}

export default function OrganizationsPage() {
  const { user, token } = useAuthStore();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const fetchOrganizations = async () => {
    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);

    if (!authToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/organizations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrganizations(data || []);
        if (data.length > 0 && !selectedOrgId) {
          setSelectedOrgId(data[0].id);
        }
      }
    } catch (err: any) {
      console.warn('Organizations fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [token]);

  const activeOrg = organizations.find((o) => o.id === selectedOrgId) || organizations[0];

  const handleCreateOrg = async () => {
    const orgName = prompt('Enter a name for the new Organization Workspace:', 'Engineering & Legal Workspace');
    if (!orgName) return;

    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: orgName }),
      });

      if (res.ok) {
        await fetchOrganizations();
      } else {
        const err = await res.json();
        alert(err.message || 'Could not create organization.');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !activeOrg) return;

    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    setIsInviting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/organizations/${activeOrg.id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (res.ok) {
        setInviteSuccess(true);
        setInviteEmail('');
        setTimeout(() => setInviteSuccess(false), 3000);
        await fetchOrganizations();
      } else {
        const errData = await res.json();
        setError(errData.message || 'Invitation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!activeOrg) return;
    if (!confirm('Are you sure you want to remove this member from the organization?')) return;

    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/organizations/${activeOrg.id}/members/${targetUserId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );

      if (res.ok) {
        await fetchOrganizations();
      } else {
        const err = await res.json();
        alert(err.message || 'Could not remove member');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const members = activeOrg?.members || [];

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Org Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
                  {activeOrg?.name || `${user?.name || 'Personal'}'s Workspace`}
                </h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {activeOrg?.plan || user?.plan || 'PRO'} Plan
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Shared workspace for confidential document review, contracts, and RAG pipelines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrganizations}
              className="p-2 rounded-full border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreateOrg}
              className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> New Workspace
            </button>
          </div>
        </div>

        {/* Workspace Storage & Members summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Shared Organization Storage</span>
              <HardDrive className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-zinc-900 mb-2">
              1.8 GB <span className="text-xs text-zinc-400 font-normal">/ 50.0 GB</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: '4%' }} />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Team Member Seats</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-zinc-900 mb-2">
              {members.length > 0 ? members.length : 1} <span className="text-xs text-zinc-400 font-normal">/ 15 Seats Used</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full"
                style={{ width: `${Math.max(1, members.length) * 6.6}%` }}
              />
            </div>
          </div>
        </div>

        {/* Invite Member Card */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-1 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-blue-600" /> Invite Team Member
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            New members will receive full workspace permissions to collaborate on PDF workflows and AI Studio
          </p>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="colleague@enterprise.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-4 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              required
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            >
              <option value="MEMBER">Member (Process & AI)</option>
              <option value="ADMIN">Admin (Manage Members & API)</option>
              <option value="VIEWER">Viewer (Read-only)</option>
            </select>
            <button
              type="submit"
              disabled={isInviting}
              className="px-5 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors shrink-0 shadow-sm disabled:opacity-50"
            >
              {isInviting ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>

          {inviteSuccess && (
            <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Invitation dispatched successfully! Member added to workspace.</span>
            </div>
          )}
        </div>

        {/* Member List Table */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">
            Active Workspace Members ({members.length > 0 ? members.length : 1})
          </h3>

          <div className="border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {members.length > 0 ? (
                  members.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {m.user?.name?.[0] || m.user?.email?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900">
                            {m.user?.name || m.user?.email?.split('@')[0]}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono">{m.user?.email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            m.role === 'OWNER'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : m.role === 'ADMIN'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {m.role !== 'OWNER' && (
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="hover:bg-zinc-50/50">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {user?.name?.[0] || 'A'}
                      </div>
                      <div>
                        <div className="font-medium text-zinc-900">{user?.name || 'Alex Morgan'}</div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {user?.email || 'admin@pdfforge.ai'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        OWNER
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500">Workspace Primary</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-[11px] text-zinc-400">Default Admin</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
