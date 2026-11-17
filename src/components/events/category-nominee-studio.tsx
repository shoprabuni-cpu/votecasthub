"use client";

import { Activity, useState } from "react";
import { motion } from "framer-motion";
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-5 dark:border-[#1c2721]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">
              [ 02 // BALLOT & CONTESTANTS ]
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              {categories.length} Categories · {nominees.length} Contestants
            </span>
          </div>
          <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Contestants & Award Ballot
          </h2>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {isDraft ? "Organize categories, add nominees with short bios, and upload portraits." : "View the categories and nominees in this event."}
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
              className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                showAddCategory
                  ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-800"
                  : "border border-stone-200 bg-white text-stone-800 hover:border-emerald-600 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:border-emerald-500"
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
              className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                showBulkImport
                  ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-800"
                  : "border border-stone-200 bg-white text-stone-800 hover:border-emerald-600 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:border-emerald-500"
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
                className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  showBulkPhotos
                    ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-800"
                    : "border border-stone-200 bg-white text-stone-800 hover:border-emerald-600 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:border-emerald-500"
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
      <>
        {canManage && isDraft && (
          <Activity mode={showAddCategory ? "visible" : "hidden"}>
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
                className="text-sm text-stone-500 hover:text-stone-800 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel ✕
              </button>
            </div>
            <CategoryForm eventId={eventId} backTo={pagePath} onAdded={(id) => { setSelectedCategoryId(id); setShowAddCategory(false); }} />
          </motion.div>
          </Activity>
        )}

        {canManage && isDraft && (
          <Activity mode={showBulkImport ? "visible" : "hidden"}>
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
                className="text-sm text-stone-500 hover:text-stone-800 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close ✕
              </button>
            </div>
            <BulkCategoryNomineeImport eventId={eventId} backTo={pagePath} />
          </motion.div>
          </Activity>
        )}

        {canManage && isDraft && nominees.length > 0 && (
          <div hidden={!showBulkPhotos}>
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
                className="text-sm text-stone-500 hover:text-stone-800 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close ✕
              </button>
            </div>
            <BulkNomineeImageUploader eventId={eventId} nominees={nominees} backTo={pagePath} />
          </motion.div>
          </div>
        )}
      </>

      {/* Main Categories Navigation or Empty State */}
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200/80 bg-linear-to-br from-emerald-50/40 via-white to-stone-50/50 px-5 py-8 text-center transition-colors dark:border-emerald-800/40 dark:from-emerald-950/20 dark:via-[#0c120e] dark:to-[#141b16] sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-2xs dark:bg-emerald-950 dark:text-emerald-300">
            <Icon name="award" size={24} />
          </div>
          <h3 className="mt-4 text-base font-serif font-bold text-stone-900 dark:text-stone-100">
            {canManage && isDraft ? "Let’s add your first category" : "No categories added yet"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm leading-6 text-stone-600 dark:text-stone-400">
            {canManage && isDraft ? "A category groups the people voters can choose. Try “Best New Artist” or “Student Leader”, then add your nominees." : "Categories and nominees will appear here once they have been added."}
          </p>
          {canManage && isDraft && (
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowAddCategory(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 cursor-pointer dark:bg-emerald-800 dark:hover:bg-emerald-700"
              >
                <Icon name="sparkle" size={13} />
                <span>Add my first category</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkImport(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-all active:scale-95 cursor-pointer dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:border-stone-700"
              >
                <span>Import from Excel</span>
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
                  className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 relative flex items-center gap-2 shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-800"
                      : "bg-white border border-stone-200/90 text-stone-700 hover:border-emerald-600 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:border-emerald-500"
                  }`}
                >
                  <span className="truncate max-w-[160px] sm:max-w-[200px]">{cat.name}</span>
                  <span
                    className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-bold ${
                      isSelected
                        ? "bg-emerald-700 text-white dark:bg-emerald-600"
                        : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                    }`}
                  >
                    {count}
                  </span>
                  {!cat.is_active && (
                    <span className="font-mono text-[10px] text-amber-500 font-bold">HIDDEN</span>
                  )}
                </button>
              );
            })}

            <button
              key="all"
              type="button"
              onClick={() => setSelectedCategoryId("all")}
              className={`min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                selectedCategoryId === "all"
                  ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-800"
                  : "bg-white border border-stone-200/90 text-stone-700 hover:border-emerald-600 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:border-emerald-500"
              }`}
            >
              <span>View All</span>
              <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-bold ${
                selectedCategoryId === "all" ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
              }`}>
                {nominees.length}
              </span>
            </button>
          </div>

          {/* Active Category Meta & Edit */}
          {activeCategory && (
            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e]">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">{activeCategory.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        activeCategory.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                      }`}
                    >
                      {activeCategory.is_active ? "BALLOT VISIBLE" : "HIDDEN"}
                    </span>
                  </div>
                  {activeCategory.description && (
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 leading-relaxed max-w-2xl">
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
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                {selectedCategoryId === "all"
                  ? `[ ALL CONTESTANTS · ${nominees.length} ]`
                  : `[ ${activeCategory?.name ?? "CATEGORY"} · ${filteredNominees.length} CONTESTANTS ]`}
              </h4>
            </div>

            {filteredNominees.length === 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-5 dark:border-[#223028] dark:bg-[#141b16]/30">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-2xs dark:bg-[#0c120e] dark:text-emerald-400">
                  <Icon name="users" size={19} />
                </span>
                <div>
                  <h5 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {canManage && isDraft ? "Add your first nominee" : "No nominees in this category yet"}
                  </h5>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                    {canManage && isDraft
                      ? activeCategory
                        ? "Enter their name in the form below. A photo portrait and brief biography can also be added."
                        : "Choose a category, then add the people voters can choose."
                      : "Nominees will appear here once added."}
                  </p>
                </div>
              </div>
            )}

            {/* Inline Add Nominee Form if a specific category is selected */}
            {canManage && isDraft && activeCategory && (
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <NomineeForm key={activeCategory.id} categoryId={activeCategory.id} backTo={pagePath} />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredNominees.map((nominee) => {
                const imageUrl = imageUrlMap[nominee.image_path ?? ""];
                return (
                  <motion.div
                    key={nominee.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 bg-white dark:bg-[#0c120e] shadow-2xs hover:shadow-xs ${
                      nominee.is_active
                        ? "border-stone-200/90 dark:border-[#1c2721]"
                        : "border-stone-200/60 opacity-60 bg-stone-50/50 dark:border-[#1c2721]/60 dark:bg-[#141b16]/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        {/* Avatar photo or monogram */}
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-2xs dark:border-[#223028] dark:bg-[#141b16]">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={nominee.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-serif text-base font-bold text-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300">
                              {nominee.name.trim().slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-stone-900 dark:text-stone-100 text-sm leading-tight truncate">
                            {nominee.name}
                          </h5>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-850 dark:bg-emerald-950/60 dark:border-emerald-900/50 dark:text-emerald-300">
                              CODE: {nominee.public_code || String(nominee.display_order + 1).padStart(2, "0")}
                            </span>
                            {!nominee.is_active && (
                              <span className="font-mono text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                HIDDEN
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {nominee.biography && (
                        <p className="mt-2.5 text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                          {nominee.biography}
                        </p>
                      )}
                    </div>

                    {/* Manage & Photo Tools */}
                    {canManage && (
                      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-[#1c2721] flex flex-wrap items-center justify-between gap-2 text-sm">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
