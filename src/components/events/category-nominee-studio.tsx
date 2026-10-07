"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/icon";
import { EditCategoryForm } from "@/components/events/edit-category-form";
import { EditNomineeForm } from "@/components/events/edit-nominee-form";
import { NomineeImageForm } from "@/components/events/nominee-image-form";
import { NomineeForm } from "@/components/events/nominee-form";
import { CategoryForm } from "@/components/events/category-form";
import { BulkCategoryNomineeImport } from "@/components/events/bulk-category-nominee-import";
import { BulkNomineeImageUploader } from "@/components/events/bulk-nominee-image-uploader";

type CategoryItem = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

type NomineeItem = {
  id: string;
  category_id: string;
  name: string;
  public_code: string | null;
  biography: string | null;
  image_path: string | null;
  display_order: number;
  is_active: boolean;
};

export function CategoryNomineeStudio({
  categories,
  nominees,
  imageUrlMap,
  eventId,
  canManage,
  isDraft,
  pagePath,
}: {
  categories: CategoryItem[];
  nominees: NomineeItem[];
  imageUrlMap: Record<string, string>;
  eventId: string;
  canManage: boolean;
  isDraft: boolean;
  pagePath: string;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">(
    categories[0]?.id ?? "all"
  );
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBulkPhotos, setShowBulkPhotos] = useState(false);

  const activeCategory = categories.find((c) => c.id === selectedCategoryId);
  const filteredNominees =
    selectedCategoryId === "all"
      ? nominees
      : nominees.filter((n) => n.category_id === selectedCategoryId);

  return (
    <div className="space-y-6">
      {/* Studio Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
            Step 2 · Category & Nominee Studio
          </div>
          <h2 className="mt-1 text-2xl font-serif font-medium text-stone-900 tracking-tight">
            Build your ballot roster
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Create award categories, assign nominees, and upload candidate photos.
          </p>
        </div>

        {/* Action Buttons */}
        {canManage && isDraft && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddCategory((prev) => !prev);
                setShowBulkImport(false);
                setShowBulkPhotos(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                showAddCategory
                  ? "bg-emerald-900 text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-800 hover:border-emerald-600 hover:bg-stone-50"
              }`}
            >
              <Icon name="sparkle" size={13} />
              <span>{showAddCategory ? "Close Form" : "+ Add Category"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowBulkImport((prev) => !prev);
                setShowAddCategory(false);
                setShowBulkPhotos(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                showBulkImport
                  ? "bg-emerald-900 text-white shadow-xs"
                  : "border border-stone-200 bg-white text-stone-800 hover:border-emerald-600 hover:bg-stone-50"
              }`}
            >
              <Icon name="vote" size={13} />
              <span>{showBulkImport ? "Hide Excel Tool" : "Import Excel / CSV"}</span>
            </button>

            {nominees.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowBulkPhotos((prev) => !prev);
                  setShowAddCategory(false);
                  setShowBulkImport(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                  showBulkPhotos
                    ? "bg-emerald-900 text-white shadow-xs"
                    : "border border-stone-200 bg-white text-stone-800 hover:border-emerald-600 hover:bg-stone-50"
                }`}
              >
                <Icon name="image" size={13} />
                <span>{showBulkPhotos ? "Hide Photo Tool" : "Bulk Photos"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expandable Drawers */}
      <AnimatePresence>
        {showAddCategory && canManage && isDraft && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-emerald-900/15 bg-emerald-50/20 p-5 shadow-xs"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Add New Category</h3>
              <button
                type="button"
                onClick={() => setShowAddCategory(false)}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Cancel ✕
              </button>
            </div>
            <CategoryForm eventId={eventId} backTo={pagePath} />
          </motion.div>
        )}

        {showBulkImport && canManage && isDraft && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Spreadsheet Batch Importer</h3>
              <button
                type="button"
                onClick={() => setShowBulkImport(false)}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Close ✕
              </button>
            </div>
            <BulkCategoryNomineeImport eventId={eventId} backTo={pagePath} />
          </motion.div>
        )}

        {showBulkPhotos && canManage && isDraft && nominees.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Batch Nominee Photo Uploader</h3>
              <button
                type="button"
                onClick={() => setShowBulkPhotos(false)}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Close ✕
              </button>
            </div>
            <BulkNomineeImageUploader eventId={eventId} nominees={nominees} backTo={pagePath} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Categories Navigation or Empty State */}
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
            <Icon name="award" size={24} />
          </div>
          <h3 className="mt-4 text-base font-serif font-semibold text-stone-900">
            Start with your first award category
          </h3>
          <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            Categories are the sections voters will browse, such as “Best New Artist”, “Student Leader of the Year”, or “Department Choice”.
          </p>
          {canManage && isDraft && (
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddCategory(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 cursor-pointer"
              >
                <Icon name="sparkle" size={13} />
                <span>Create Category</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkImport(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-all cursor-pointer"
              >
                <span>Import Excel Template</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Category Tabs Pill Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => {
              const count = nominees.filter((n) => n.category_id === cat.id && n.is_active).length;
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`relative flex items-center gap-2 shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-900 text-white shadow-xs"
                      : "bg-white border border-stone-200/90 text-stone-700 hover:border-emerald-600 hover:bg-stone-50"
                  }`}
                >
                  <span className="truncate max-w-[160px] sm:max-w-[200px]">{cat.name}</span>
                  <span
                    className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                      isSelected ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {count}
                  </span>
                  {!cat.is_active && (
                    <span className="text-[10px] text-amber-500 font-bold">Hidden</span>
                  )}
                </button>
              );
            })}

            <button
              key="all"
              type="button"
              onClick={() => setSelectedCategoryId("all")}
              className={`flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                selectedCategoryId === "all"
                  ? "bg-emerald-900 text-white shadow-xs"
                  : "bg-white border border-stone-200/90 text-stone-700 hover:border-emerald-600 hover:bg-stone-50"
              }`}
            >
              <span>View All ({nominees.length})</span>
            </button>
          </div>

          {/* Active Category Meta & Edit */}
          {activeCategory && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-serif font-bold text-stone-900">{activeCategory.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        activeCategory.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {activeCategory.is_active ? "Visible to Voters" : "Hidden from Ballot"}
                    </span>
                  </div>
                  {activeCategory.description && (
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed max-w-2xl">
                      {activeCategory.description}
                    </p>
                  )}
                </div>

                {canManage && isDraft && (
                  <div className="shrink-0">
                    <EditCategoryForm category={activeCategory} backTo={pagePath} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nominees Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {selectedCategoryId === "all"
                  ? "All Nominees Across Categories"
                  : `Nominees in ${activeCategory?.name ?? "Category"} (${filteredNominees.length})`}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredNominees.map((nominee) => {
                const imageUrl = imageUrlMap[nominee.image_path ?? ""];
                return (
                  <motion.div
                    key={nominee.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all bg-white shadow-2xs hover:shadow-xs ${
                      nominee.is_active ? "border-stone-200/90" : "border-stone-200/60 opacity-60 bg-stone-50/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        {/* Avatar photo or monogram */}
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-2xs">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={nominee.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-serif text-base font-bold text-emerald-900 bg-emerald-50">
                              {nominee.name.trim().slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h5 className="font-semibold text-stone-900 text-sm leading-tight truncate">
                            {nominee.name}
                          </h5>
                          {nominee.public_code && (
                            <span className="mt-1 inline-block rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-stone-700">
                              {nominee.public_code}
                            </span>
                          )}
                        </div>
                      </div>

                      {nominee.biography && (
                        <p className="mt-2.5 text-xs text-stone-500 line-clamp-2 leading-relaxed">
                          {nominee.biography}
                        </p>
                      )}
                    </div>

                    {/* Manage & Photo Tools */}
                    {canManage && (
                      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                        {isDraft && <EditNomineeForm nominee={nominee} backTo={pagePath} />}
                        <NomineeImageForm
                          eventId={eventId}
                          nomineeId={nominee.id}
                          nomineeName={nominee.name}
                          initialPath={nominee.image_path}
                          initialUrl={imageUrl ?? null}
                          backTo={pagePath}
                          reviewRequired={!isDraft}
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Inline Add Nominee Form if a specific category is selected */}
              {canManage && isDraft && activeCategory && (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/30 p-4 flex flex-col justify-center">
                  <NomineeForm categoryId={activeCategory.id} backTo={pagePath} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
