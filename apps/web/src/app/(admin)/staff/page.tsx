'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { getStaff, createStaff, deleteStaff, Staff } from '@/lib/staff';
import { Role } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { StatusBadge, activeTone } from '@/components/ui/StatusBadge';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { SearchInput } from '@/components/ui/SearchInput';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '@/components/ui/styles';
import {
  AlertTriangleIcon,
  InboxIcon,
  Loader2Icon,
  PlusIcon,
  UsersIcon,
  Trash2Icon,
} from '@/components/icons';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  SALESMAN: 'Salesman',
  ACCOUNTANT: 'Accountant',
  BRANCH_MANAGER: 'Branch Manager',
};

function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || 'U';
}

export default function StaffPage() {
  const { user: currentUser } = useCurrentUser();
  const { showToast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [search, setSearch] = useState('');
  // Deactivated staff are hidden by default; toggling this re-fetches
  // including them, purely for historical reference.
  const [showInactive, setShowInactive] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SALESMAN' | 'ACCOUNTANT' | 'BRANCH_MANAGER'>('SALESMAN');

  // Delete Staff — never allowed against your own account. Backend
  // deactivates instead of deleting when the staff member has history.
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadStaff() {
    try {
      const data = await getStaff(showInactive);
      setStaff(data);
    } catch {
      setError('Could not load staff.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  function openDeleteConfirm(s: Staff) {
    setDeleteTarget(s);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteStaff(deleteTarget.id);
      showToast(
        'success',
        'Staff member removed. Any historical sales or payments are preserved.',
      );
      setDeleteTarget(null);
      await loadStaff();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not remove this staff member.');
    } finally {
      setDeleting(false);
    }
  }

  function openAddModal() {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('SALESMAN');
    setShowAddModal(true);
  }

  function closeAddModal() {
    setShowAddModal(false);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createStaff({ fullName, email, password, role });
      showToast('success', 'Staff member added successfully.');
      closeAddModal();
      await loadStaff();
    } catch {
      showToast('error', 'Could not add staff. Email may already be used.');
    } finally {
      setSaving(false);
    }
  }

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (q && !(s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [staff, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Staff"
          subtitle="Manage staff accounts and access."
          actions={
            <button type="button" onClick={openAddModal} className={primaryButtonClass}>
              <PlusIcon className="h-4 w-4" />
              Add Staff
            </button>
          }
        />

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search staff..." />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
              showInactive
                ? 'bg-primary text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showInactive ? 'Hide Disabled Staff' : 'Show Disabled Staff'}
          </button>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton rows={4} />
          ) : filteredStaff.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title={staff.length === 0 ? 'No staff members found.' : 'No staff match your search or filters.'}
              description={
                staff.length === 0
                  ? 'Add your first staff member to get started.'
                  : 'Try adjusting your search or filters.'
              }
              action={
                staff.length === 0 ? (
                  <button type="button" onClick={openAddModal} className={primaryButtonClass}>
                    <PlusIcon className="h-4 w-4" />
                    Add Staff
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-150 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Staff Member</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
                            {initials(s.fullName)}
                          </div>
                          <span className="font-medium text-slate-900">{s.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{s.email}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="neutral">
                          <UsersIcon className="h-3 w-3" />
                          {ROLE_LABELS[s.role] ?? s.role}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{s.outletName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={activeTone(s.isActive)} dot>
                          {s.isActive ? 'Active' : 'Disabled'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        {s.isActive && s.id !== currentUser?.userId && (
                          <ActionMenu
                            actions={[
                              {
                                label: 'Delete',
                                icon: Trash2Icon,
                                variant: 'delete',
                                onClick: () => openDeleteConfirm(s),
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Staff modal */}
      {showAddModal && (
        <Modal
          title="Add Staff"
          onClose={closeAddModal}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeAddModal} disabled={saving} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" form="add-staff-form" disabled={saving} className={primaryButtonClass}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {saving ? 'Adding...' : 'Add Staff'}
              </button>
            </div>
          }
        >
          <form id="add-staff-form" onSubmit={handleAdd}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Full name">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    required
                    className={inputClass}
                  />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Email">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    required
                    className={inputClass}
                  />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Password" helper="Minimum 8 characters">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 8)"
                    type="password"
                    required
                    minLength={8}
                    className={inputClass}
                  />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Role">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as typeof role)}
                    className={inputClass}
                  >
                    <option value="SALESMAN">Salesman</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="BRANCH_MANAGER">Branch Manager</option>
                  </select>
                </FormField>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Staff confirmation — never allowed against your own account.
          Backend deactivates instead of deleting when the staff member has
          sales/payment/purchase history; their records are never removed. */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.fullName}?`}
          description="If this staff member has any sales, payments, or purchase history, their account will be safely disabled instead of deleted — that history is never removed. A disabled account can no longer log in."
          confirmLabel={deleting ? 'Deleting...' : 'Delete Staff'}
          variant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        >
          <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Name</span>
              <span className="font-medium text-slate-900">{deleteTarget.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role</span>
              <span className="font-medium text-slate-900">
                {ROLE_LABELS[deleteTarget.role] ?? deleteTarget.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Branch</span>
              <span className="font-medium text-slate-900">{deleteTarget.outletName ?? '—'}</span>
            </div>
          </div>
          {deleteError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {deleteError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
