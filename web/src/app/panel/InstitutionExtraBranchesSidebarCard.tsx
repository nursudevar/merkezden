"use client";

import { Plus } from "lucide-react";

type InstitutionExtraBranchesSidebarCardProps = {
  onAddClick: () => void;
  disabled?: boolean;
};

export function InstitutionExtraBranchesSidebarCard({
  onAddClick,
  disabled = false,
}: InstitutionExtraBranchesSidebarCardProps) {
  return (
    <aside
      className="panel-sidebar-extra-branches-card"
      aria-label="Ek Branşlar tanıtımı"
    >
      <h3 className="panel-sidebar-extra-branches-card-title">Ek Branşlar</h3>
      <p className="panel-sidebar-extra-branches-card-desc">
        Ana kategoriniz dışında hizmet verdiğiniz alanları ekleyebilirsiniz.
      </p>
      <button
        type="button"
        className="panel-sidebar-extra-branches-card-btn"
        onClick={onAddClick}
        disabled={disabled}
      >
        <Plus className="panel-sidebar-extra-branches-card-btn-icon" aria-hidden />
        Ek Branş Ekle
      </button>
    </aside>
  );
}
