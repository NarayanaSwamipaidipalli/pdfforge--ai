'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Building,
  Mail,
  MoreVertical,
  Trash2,
  HardDrive,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export default function OrganizationsPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [members, setMembers] = useState([
    {
      id: 'm1',
      name: 'Alex Morgan',
      email: 'alex.morgan@enterprise.com',
      role: 'OWNER',
      joined: '2026-08-10',
      avatar: 'AM',
    },
    {
      id: 'm2',
      name: 'Elena Rostova',
      email: 'elena.rostova@enterprise.com',
      role: 'ADMIN',
      joined: '2026-09-02',
      avatar: 'ER',
    },
    {
      id: 'm3',
      name: 'Marcus Chen',
      email: 'marcus.chen@enterprise.com',
      role: 'MEMBER',
      joined: '2026-09-18',
      avatar: 'MC',
    },
  ]);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    setTimeout(() => {
      setIsInviting(false);
      setInviteSuccess(true);
      setMembers((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          name: inviteEmail.split('@')[0],
          email: inviteEmail,
          role: inviteRole,
          joined: 'Just now (Pending)',
          avatar: inviteEmail[0].toUpperCase(),
        },
      ]);
      setInviteEmail('');
      setTimeout(() => setInviteSuccess(false), 3000);
    }, 600);
  };

  const handleRemoveMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
  };

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
                  Apex Global Legal Workspace
                </h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Business Plan
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Shared workspace for confidential document review, contracts, and RAG pipelines
              </p>
            </div>
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
              14.2 GB <span className="text-xs text-zinc-400 font-normal">/ 50.0 GB</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: '28%' }} />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-medium">Team Member Seats</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-zinc-900 mb-2">
              {members.length} <span className="text-xs text-zinc-400 font-normal">/ 15 Seats Used</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full"
                style={{ width: `${(members.length / 15) * 100}%` }}
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
            New members will receive an email invite to join your organization workspace
          </p>

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
              className="px-5 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors shrink-0 shadow-sm"
            >
              {isInviting ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>

          {inviteSuccess && (
            <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Invitation dispatched successfully!</span>
            </div>
          )}
        </div>

        {/* Member List Table */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">
            Active Workspace Members ({members.length})
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
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50/50">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {m.avatar}
                      </div>
                      <div>
                        <div className="font-medium text-zinc-900">{m.name}</div>
                        <div className="text-[11px] text-zinc-400">{m.email}</div>
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
                    <td className="py-3 px-4 text-zinc-500">{m.joined}</td>
                    <td className="py-3 px-4 text-right">
                      {m.role !== 'OWNER' && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
