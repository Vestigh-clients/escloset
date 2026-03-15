import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
  uploadCategoryImage,
  type AdminCategoryWithCount,
} from "@/services/adminService";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

type CategoryFormState = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: string;
  isActive: boolean;
  slugManual: boolean;
};

const defaultFormState: CategoryFormState = {
  id: null,
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  displayOrder: "0",
  isActive: true,
  slugManual: false,
};

const AdminCategoriesPage = () => {
  const [categories, setCategories] = useState<AdminCategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(defaultFormState);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAdminCategories();
      setCategories(data);
    } catch {
      setCategories([]);
      setLoadError("Unable to load categories.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (form.slugManual) return;
    setForm((current) => ({
      ...current,
      slug: slugify(current.name),
    }));
  }, [form.name, form.slugManual]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const resetForm = () => {
    setForm(defaultFormState);
    setIsFormOpen(false);
    setEditingId(null);
  };

  const openNewForm = () => {
    setForm(defaultFormState);
    setEditingId(null);
    setIsFormOpen(true);
  };

  const openEditForm = (category: AdminCategoryWithCount) => {
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      imageUrl: category.image_url || "",
      displayOrder: String(category.display_order ?? 0),
      isActive: category.is_active ?? true,
      slugManual: false,
    });
    setEditingId(category.id);
    setIsFormOpen(true);
  };

  const onUploadImage = async (file: File | null) => {
    if (!file) return;
    if (!form.slug.trim()) {
      setMessage("Add category name/slug before uploading image.");
      return;
    }

    const result = await uploadCategoryImage(slugify(form.slug), file);
    setForm((current) => ({ ...current, imageUrl: result.url }));
  };

  const onSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setMessage("Category name and slug are required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: slugify(form.slug),
        description: form.description.trim() || null,
        image_url: form.imageUrl.trim() || null,
        display_order: Number(form.displayOrder || 0),
        is_active: form.isActive,
      };

      if (form.id) {
        const previous = categories.find((entry) => entry.id === form.id);
        await updateAdminCategory(form.id, payload, previous as never);
        setMessage("Category updated.");
      } else {
        await createAdminCategory(payload);
        setMessage("Category created.");
      }

      await load();
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (category: AdminCategoryWithCount) => {
    await deleteAdminCategory(category);
    setDeleteConfirmId(null);
    setMessage("Category deleted.");
    await load();
  };

  const onMoveCategory = async (categoryId: string, direction: "up" | "down") => {
    const sorted = [...categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const currentIndex = sorted.findIndex((entry) => entry.id === categoryId);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const current = sorted[currentIndex];
    const target = sorted[targetIndex];
    const currentOrder = current.display_order ?? currentIndex;
    const targetOrder = target.display_order ?? targetIndex;

    setIsReordering(true);
    setCategories((existing) =>
      existing.map((entry) => {
        if (entry.id === current.id) {
          return { ...entry, display_order: targetOrder };
        }
        if (entry.id === target.id) {
          return { ...entry, display_order: currentOrder };
        }
        return entry;
      }),
    );

    try {
      await Promise.all([
        updateAdminCategory(current.id, { display_order: targetOrder }, current as never),
        updateAdminCategory(target.id, { display_order: currentOrder }, target as never),
      ]);
      setMessage("Display order updated.");
      await load();
    } catch {
      setMessage("Unable to reorder category.");
      await load();
    } finally {
      setIsReordering(false);
    }
  };

  const renderedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [categories],
  );

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title font-display text-[36px] italic text-[#1A1A1A]">Categories</h1>
        <div className="admin-page-actions">
          <button
            type="button"
            onClick={openNewForm}
            className="rounded-[2px] bg-[#1A1A1A] px-7 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A]"
          >
            Add Category
          </button>
        </div>
      </div>

      {message ? <p className="mb-4 font-body text-[12px] text-[#C4A882]">{message}</p> : null}

      {isFormOpen && !editingId ? (
        <div className="mb-6 border border-[#d4ccc2] p-5">
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Add Category</p>
          <CategoryForm form={form} setForm={setForm} onUploadImage={onUploadImage} onSave={onSave} onCancel={resetForm} isSaving={isSaving} />
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[940px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[#d4ccc2]">
              {["Image", "Name", "Slug", "Products", "Order", "Status", "Actions"].map((heading) => (
                <th
                  key={heading}
                  className="px-2 py-3 text-left font-body text-[10px] uppercase tracking-[0.12em] text-[#777777] first:pl-0 last:pr-0"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center font-body text-[12px] text-[#777777]">
                  Loading categories...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={7} className="py-8 text-center font-body text-[12px] text-[#C0392B]">
                  {loadError}
                </td>
              </tr>
            ) : renderedCategories.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center font-body text-[12px] text-[#777777]">
                  No categories yet.
                </td>
              </tr>
            ) : (
              renderedCategories.flatMap((category) => [
                <tr key={`row-${category.id}`} className="border-b border-[#e4dbd1] hover:bg-[rgba(196,168,130,0.04)]">
                  <td className="px-2 py-4 pl-0">
                    <div className="h-12 w-12 overflow-hidden bg-[#ede5db]">
                      {category.image_url ? (
                        <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-[#e2d9cf]" />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-4 font-body text-[13px] text-[#1A1A1A]">{category.name}</td>
                  <td className="px-2 py-4 font-body text-[11px] text-[#777777]">{category.slug}</td>
                  <td className="px-2 py-4 font-body text-[12px] text-[#555555]">{category.products_count}</td>
                  <td className="px-2 py-4">
                    <span className="font-body text-[12px] text-[#555555]">{category.display_order ?? 0}</span>
                  </td>
                  <td className="px-2 py-4">
                    <span
                      className={`inline-block rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                        category.is_active ? "border border-[#C4A882] text-[#C4A882]" : "border border-[#C0392B] text-[#C0392B]"
                      }`}
                    >
                      {category.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-0 py-4">
                    <div className="flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.1em]">
                      <button type="button" onClick={() => openEditForm(category)} className="text-[#555555] hover:text-[#1A1A1A]">
                        Edit
                      </button>
                      <span className="text-[#d4ccc2]">|</span>
                      {category.products_count > 0 ? (
                        <span className="text-[#C0392B]">Move or delete all {category.products_count} products before deleting.</span>
                      ) : deleteConfirmId === category.id ? (
                        <span className="normal-case">
                          Delete {category.name}?{" "}
                          <button type="button" onClick={() => void onDelete(category)} className="uppercase text-[#C0392B]">
                            Yes Delete
                          </button>{" "}
                          <button type="button" onClick={() => setDeleteConfirmId(null)} className="uppercase text-[#555555]">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(category.id)}
                          className="text-[#555555] hover:text-[#C0392B]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>,
                isFormOpen && editingId === category.id ? (
                  <tr key={`edit-${category.id}`}>
                    <td colSpan={7} className="border-b border-[#d4ccc2] bg-[rgba(255,255,255,0.32)] px-4 py-5">
                      <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Edit Category</p>
                      <CategoryForm
                        form={form}
                        setForm={setForm}
                        onUploadImage={onUploadImage}
                        onSave={onSave}
                        onCancel={resetForm}
                        isSaving={isSaving}
                      />
                    </td>
                  </tr>
                ) : null,
              ])
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#d4ccc2] md:hidden">
        {isLoading ? (
          <p className="py-8 text-center font-body text-[12px] text-[#777777]">Loading categories...</p>
        ) : loadError ? (
          <p className="py-8 text-center font-body text-[12px] text-[#C0392B]">{loadError}</p>
        ) : renderedCategories.length === 0 ? (
          <p className="py-8 text-center font-body text-[12px] text-[#777777]">No categories yet.</p>
        ) : (
          renderedCategories.map((category, index) => (
            <div key={`mobile-${category.id}`} className="admin-mobile-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-8 w-8 overflow-hidden bg-[#ede5db]">
                    {category.image_url ? (
                      <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[#e2d9cf]" />
                    )}
                  </div>
                  <p className="truncate font-body text-[12px] text-[#1A1A1A]">{category.name}</p>
                </div>
                <span
                  className={`inline-block rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                    category.is_active ? "border border-[#C4A882] text-[#C4A882]" : "border border-[#C0392B] text-[#C0392B]"
                  }`}
                >
                  {category.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="font-body text-[10px] text-[#777777]">{category.slug}</p>
                <p className="font-body text-[11px] text-[#555555]">{category.products_count} products</p>
              </div>

              <div className="mt-2 flex items-center justify-end gap-3 font-body text-[10px] uppercase tracking-[0.1em] text-[#888888]">
                <button
                  type="button"
                  disabled={isReordering || index === 0}
                  onClick={() => void onMoveCategory(category.id, "up")}
                  className="normal-case text-[14px] text-[#888888] disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={isReordering || index === renderedCategories.length - 1}
                  onClick={() => void onMoveCategory(category.id, "down")}
                  className="normal-case text-[14px] text-[#888888] disabled:opacity-40"
                >
                  ↓
                </button>
                <button type="button" onClick={() => openEditForm(category)} className="text-[#555555] hover:text-[#1A1A1A]">
                  Edit
                </button>
                <span className="text-[#d4ccc2]">|</span>
                {category.products_count > 0 ? (
                  <span className="normal-case text-[#C0392B]">Delete locked ({category.products_count})</span>
                ) : deleteConfirmId === category.id ? (
                  <span className="normal-case">
                    <button type="button" onClick={() => void onDelete(category)} className="uppercase text-[#C0392B]">
                      Yes Delete
                    </button>{" "}
                    <button type="button" onClick={() => setDeleteConfirmId(null)} className="uppercase text-[#555555]">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(category.id)}
                    className="text-[#555555] hover:text-[#C0392B]"
                  >
                    Delete
                  </button>
                )}
              </div>

              {isFormOpen && editingId === category.id ? (
                <div className="mt-4 border-t border-[#d4ccc2] pt-4">
                  <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Edit Category</p>
                  <CategoryForm
                    form={form}
                    setForm={setForm}
                    onUploadImage={onUploadImage}
                    onSave={onSave}
                    onCancel={resetForm}
                    isSaving={isSaving}
                  />
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const CategoryForm = ({
  form,
  setForm,
  onUploadImage,
  onSave,
  onCancel,
  isSaving,
}: {
  form: CategoryFormState;
  setForm: Dispatch<SetStateAction<CategoryFormState>>;
  onUploadImage: (file: File | null) => Promise<void>;
  onSave: () => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) => {
  return (
    <div className="grid gap-4">
      <div>
        <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#777777]">Category Name *</label>
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#777777]">Slug</label>
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, slugManual: !current.slugManual }))}
            className="font-body text-[10px] text-[#C4A882] hover:text-[#1A1A1A]"
          >
            {form.slugManual ? "Lock slug" : "Edit slug"}
          </button>
        </div>
        <input
          value={form.slug}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              slug: slugify(event.target.value),
              slugManual: true,
            }))
          }
          className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
        />
      </div>

      <div>
        <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#777777]">Description</label>
        <textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          className="mt-2 min-h-20 w-full resize-y border border-[#d4ccc2] bg-transparent p-3 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
        />
      </div>

      <div>
        <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#777777]">Image</label>
        <label className="mt-2 block cursor-pointer border-2 border-dashed border-[#d4ccc2] p-6 text-center">
          <p className="font-body text-[12px] text-[#777777]">Upload hero image (16:9)</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void onUploadImage(event.target.files?.[0] || null)}
            className="hidden"
          />
        </label>
        {form.imageUrl ? (
          <div className="mt-3 h-24 overflow-hidden bg-[#ede5db]">
            <img src={form.imageUrl} alt={form.name || "Category image"} className="h-full w-full object-cover" />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#777777]">Display Order</label>
          <input
            value={form.displayOrder}
            onChange={(event) =>
              setForm((current) => ({ ...current, displayOrder: event.target.value.replace(/[^\d-]/g, "") }))
            }
            className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
          />
        </div>
        <label className="mt-6 flex items-center gap-2 font-body text-[12px] text-[#1A1A1A]">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            className="h-3.5 w-3.5 accent-[#1A1A1A]"
          />
          Is Active
        </label>
      </div>

      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={isSaving}
          className="rounded-[2px] bg-[#1A1A1A] px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.1em] text-[#F5F0E8] disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Category"}
        </button>
        <button type="button" onClick={onCancel} className="font-body text-[10px] uppercase tracking-[0.1em] text-[#555555]">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AdminCategoriesPage;

