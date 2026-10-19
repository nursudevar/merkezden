"use client";

import { Plus } from "lucide-react";

type InstructorExtraBranchesSidebarCardProps = {
  onAddClick: () => void;
  disabled?: boolean;
};

export function InstructorExtraBranchesSidebarCard({
  onAddClick,
  disabled = false,
}: InstructorExtraBranchesSidebarCardProps) {
  return (
    <aside className="egitmen-panel-sidebar-extra-branches-card" aria-label="Ek Branşlar tanıtımı">
      <h3 className="egitmen-panel-sidebar-extra-branches-card-title">Ek Branşlar</h3>
      <p className="egitmen-panel-sidebar-extra-branches-card-desc">
        Ana kategoriniz dışında hizmet verdiğiniz alanları ekleyebilirsiniz.
      </p>
      <button
        type="button"
        className="egitmen-panel-sidebar-extra-branches-card-btn"
        onClick={onAddClick}
        disabled={disabled}
      >
        <Plus className="egitmen-panel-sidebar-extra-branches-card-btn-icon" aria-hidden />
        Ek Branş Ekle
      </button>
    </aside>
  );
}
