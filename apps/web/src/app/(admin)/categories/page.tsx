'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  Category,
} from '@/lib/categories';
import { getModels, updateModel, deleteModel, Model } from '@/lib/models';
import { ApiRequestError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { StatusBadge, activeTone } from '@/components/ui/StatusBadge';
import {
  inputClass,
  labelClass,
  errorClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/ui/styles';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  InboxIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SmartphoneIcon,
  TagIcon,
  Trash2Icon,
  XIcon,
} from '@/components/icons';

interface CategoryFormState {
  name: string;
  description: string;
  isSerialized: boolean;
  isActive: boolean;
}

const emptyForm: CategoryFormState = {
  name: '',
  description: '',
  isSerialized: false,
  isActive: true,
};

type ModalState =
  | { type: 'closed' }
  | { type: 'add' }
  | { type: 'edit'; category: Category }
  | { type: 'confirm-delete'; category: Category }
  | { type: 'models'; category: Category };

type ModelModalState =
  | { type: 'closed' }
  | { type: 'edit'; model: Model }
  | { type: 'confirm-delete'; model: Model };

export default function CategoriesPage() {
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'ARCHIVED'>('');

  const [modal, setModal] = useState<ModalState>({ type: 'closed' });
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [models, setModels] = useState<Model[]>([]);
  // The Category page's Models list only ever shows models with real,
  // in-stock products — a model whose last unit just sold out (or was
  // deleted) disappears immediately rather than lingering with an Archived
  // badge. This never touches the stored Model row or its isActive flag;
  // it's a display-only filter over the same computed productCount the
  // backend already returns.
  const modelsToDisplay = useMemo(
    () => models.filter((model) => model.productCount > 0),
    [models],
  );
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelModal, setModelModal] = useState<ModelModalState>({ type: 'closed' });
  const [modelName, setModelName] = useState('');
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelSaving, setModelSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {
      setError('Could not load categories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateField<K extends keyof CategoryFormState>(
    key: K,
    value: CategoryFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function closeModal() {
    setModal({ type: 'closed' });
    setForm(emptyForm);
    setErrors({});
    setModelModal({ type: 'closed' });
    setModels([]);
  }

  function openAdd() {
    setForm(emptyForm);
    setErrors({});
    setModal({ type: 'add' });
  }

  function openEdit(c: Category) {
    setForm({
      name: c.name,
      description: c.description ?? '',
      isSerialized: c.isSerialized,
      isActive: c.isActive,
    });
    setErrors({});
    setModal({ type: 'edit', category: c });
  }

  async function openModels(c: Category) {
    setModal({ type: 'models', category: c });
    setModelsLoading(true);
    try {
      const data = await getModels({ categoryId: c.id });
      setModels(data);
    } catch {
      showToast('error', 'Could not load models for this category.');
    } finally {
      setModelsLoading(false);
    }
  }

  function openEditModel(m: Model) {
    setModelName(m.name);
    setModelError(null);
    setModelModal({ type: 'edit', model: m });
  }

  async function handleSubmitModel(e: FormEvent) {
    e.preventDefault();
    if (modal.type !== 'models' || modelModal.type !== 'edit') return;
    const name = modelName.trim();
    if (!name) {
      setModelError('Model name is required.');
      return;
    }
    setModelSaving(true);
    setModelError(null);
    try {
      await updateModel(modelModal.model.id, { name });
      showToast('success', 'Model updated successfully.');
      setModelModal({ type: 'closed' });
      const data = await getModels({ categoryId: modal.category.id });
      setModels(data);
    } catch (err) {
      setModelError(
        err instanceof ApiRequestError ? err.message : 'Could not save model. It may already exist.',
      );
    } finally {
      setModelSaving(false);
    }
  }

  async function confirmDeleteModel() {
    if (modal.type !== 'models' || modelModal.type !== 'confirm-delete') return;
    setModelSaving(true);
    try {
      const result = await deleteModel(modelModal.model.id);
      showToast('success', result.message);
      setModelModal({ type: 'closed' });
      const data = await getModels({ categoryId: modal.category.id });
      setModels(data);
      await loadData();
    } catch (err) {
      showToast('error', err instanceof ApiRequestError ? err.message : 'Could not delete model.');
    } finally {
      setModelSaving(false);
    }
  }

  async function toggleModelActive(m: Model) {
    if (modal.type !== 'models') return;
    setModelSaving(true);
    try {
      await updateModel(m.id, { isActive: !m.isActive });
      showToast('success', m.isActive ? 'Model deactivated.' : 'Model reactivated.');
      const data = await getModels({ categoryId: modal.category.id });
      setModels(data);
    } catch (err) {
      showToast('error', err instanceof ApiRequestError ? err.message : 'Could not update model.');
    } finally {
      setModelSaving(false);
    }
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Category name is required.';
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        isSerialized: form.isSerialized,
      };
      if (modal.type === 'edit') {
        await updateCategory(modal.category.id, { ...payload, isActive: form.isActive });
        showToast('success', 'Category updated successfully.');
      } else {
        await createCategory(payload);
        showToast('success', 'Category added successfully.');
      }
      closeModal();
      await loadData();
    } catch (err) {
      showToast(
        'error',
        err instanceof ApiRequestError ? err.message : 'Could not save category. Name may already exist.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (modal.type !== 'confirm-delete') return;
    setSaving(true);
    try {
      const result = await deleteCategory(modal.category.id);
      showToast('success', result.message);
      closeModal();
      await loadData();
    } catch (err) {
      showToast('error', err instanceof ApiRequestError ? err.message : 'Could not delete category.');
    } finally {
      setSaving(false);
    }
  }

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (statusFilter === 'ACTIVE' && !c.isActive) return false;
      if (statusFilter === 'ARCHIVED' && c.isActive) return false;
      return true;
    });
  }, [categories, search, statusFilter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Categories"
          subtitle="Manage the broad product categories used across Products, Inventory and POS"
          actions={
            isAdmin ? (
              <button type="button" onClick={openAdd} className={primaryButtonClass}>
                <PlusIcon className="h-4 w-4" />
                Add Category
              </button>
            ) : undefined
          }
        />

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." />
        </div>

        <FilterToolbar>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | 'ACTIVE' | 'ARCHIVED')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </FilterToolbar>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : filteredCategories.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No categories found"
              description={
                categories.length === 0
                  ? 'Add your first category using the button above.'
                  : 'Try adjusting your search or filters.'
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Name</th>
                    <th className="px-5 py-3.5 font-medium">Type</th>
                    <th className="px-5 py-3.5 font-medium">Products</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-t border-slate-100 transition-colors hover:bg-slate-50/70 ${!c.isActive ? 'opacity-60' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                            <TagIcon className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="text-base font-semibold text-slate-900">{c.name}</div>
                            {c.description && (
                              <div className="mt-0.5 text-xs text-slate-400">{c.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={c.isSerialized ? 'purple' : 'neutral'}>
                          {c.isSerialized ? 'Serialized (IMEI)' : 'Accessory'}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {formatNumber(c.productCount)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={activeTone(c.isActive)} dot>
                          {c.isActive ? 'Active' : 'Archived'}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openModels(c)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-primary/40 hover:text-primary"
                          >
                            View Models
                          </button>
                          {isAdmin && (
                            <ActionMenu
                              actions={[
                                { label: 'Edit', icon: PencilIcon, variant: 'edit', onClick: () => openEdit(c) },
                                {
                                  label: 'Delete',
                                  icon: Trash2Icon,
                                  variant: 'delete',
                                  onClick: () => setModal({ type: 'confirm-delete', category: c }),
                                },
                              ]}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {(modal.type === 'add' || modal.type === 'edit') && (
        <Modal
          title={modal.type === 'edit' ? 'Edit Category' : 'Add Category'}
          onClose={closeModal}
          size="md"
          footer={
            <div className="flex gap-2">
              <button type="submit" form="category-form" disabled={saving} className={primaryButtonClass}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : modal.type === 'edit' ? 'Update Category' : 'Save Category'}
              </button>
              <button type="button" onClick={closeModal} disabled={saving} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          }
        >
          <form id="category-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={labelClass}>
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Samsung, Apple, Oppo, Accessories"
                  className={inputClass}
                />
                {errors.name && <p className={errorClass}>{errors.name}</p>}
              </div>
              <div>
                <label className={labelClass}>Description (optional)</label>
                <input
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className={inputClass}
                />
              </div>
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.isSerialized}
                  onChange={(e) => updateField('isSerialized', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block font-medium text-slate-700">Track individual units by IMEI</span>
                  <span className="block text-xs text-slate-500">
                    Enable this for phone-type categories (Storage, IMEI, PTA, Battery, Condition
                    fields). Leave off for simple accessories (Quantity, Compatibility).
                  </span>
                </span>
              </label>
              {modal.type === 'edit' && (
                <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => updateField('isActive', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="font-medium text-slate-700">Active (available for new products)</span>
                </label>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* Models management modal */}
      {modal.type === 'models' && (
        <Modal
          title={`Models — ${modal.category.name}`}
          onClose={closeModal}
          size="lg"
        >
          {modelModal.type === 'edit' && (
            <div className="mb-4">
              <form onSubmit={handleSubmitModel} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    autoFocus
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. Galaxy S24 Ultra"
                    className={inputClass}
                  />
                  {modelError && <p className={errorClass}>{modelError}</p>}
                </div>
                <button type="submit" disabled={modelSaving} className={primaryButtonClass}>
                  {modelSaving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                  Update
                </button>
                <button
                  type="button"
                  disabled={modelSaving}
                  onClick={() => setModelModal({ type: 'closed' })}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {modelsLoading ? (
            <TableSkeleton />
          ) : modelsToDisplay.length === 0 ? (
            <EmptyState
              icon={SmartphoneIcon}
              title={models.length === 0 ? 'No models yet' : 'No active models'}
              description={
                models.length === 0
                  ? 'Models are created automatically from the Products page when a new device is added under this category.'
                  : 'Every model under this category is currently out of stock.'
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500">
                {formatNumber(modelsToDisplay.length)} active model
                {modelsToDisplay.length === 1 ? '' : 's'}
              </p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {modelsToDisplay.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <SmartphoneIcon className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <div className="text-base font-semibold text-slate-900">{m.name}</div>
                        <div className="text-xs text-slate-400">{formatNumber(m.productCount)} products</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <ActionMenu
                        actions={[
                          { label: 'Edit', icon: PencilIcon, variant: 'edit', onClick: () => openEditModel(m) },
                          {
                            label: m.isActive ? 'Deactivate' : 'Reactivate',
                            icon: m.isActive ? XIcon : CheckCircleIcon,
                            variant: 'neutral',
                            disabled: modelSaving,
                            onClick: () => toggleModelActive(m),
                          },
                          {
                            label: 'Delete',
                            icon: Trash2Icon,
                            variant: 'delete',
                            onClick: () => setModelModal({ type: 'confirm-delete', model: m }),
                          },
                        ]}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Delete model confirmation */}
      {modal.type === 'models' && modelModal.type === 'confirm-delete' && (
        <ConfirmDialog
          title="Delete Model?"
          description="This model will be removed. If products already use this model, it will be archived instead of permanently deleted so those products keep their model."
          confirmLabel={modelSaving ? 'Deleting...' : 'Delete Model'}
          variant="danger"
          loading={modelSaving}
          onConfirm={confirmDeleteModel}
          onCancel={() => setModelModal({ type: 'closed' })}
        />
      )}

      {/* Delete confirmation */}
      {modal.type === 'confirm-delete' && (
        <ConfirmDialog
          title="Are you sure you want to delete this category?"
          description="This action cannot be undone. Related products and models will remain in the system without a category."
          confirmLabel={saving ? 'Deleting...' : 'Delete Category'}
          variant="danger"
          loading={saving}
          onConfirm={confirmDelete}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}
