"use client";

import { AlertTriangle } from "lucide-react";

export type AdminActingAsKind = "institution" | "instructor";

export function isAdminActingAsTargetId(
  isAdmin: boolean,
  targetIdParam: string | null | undefined,
): boolean {
  if (!isAdmin) return false;
  const trimmed = String(targetIdParam ?? "").trim();
  if (!trimmed) return false;
  const numericId = Number(trimmed);
  return Number.isFinite(numericId) && numericId > 0;
}

function buildAdminActingAsMessage(kind: AdminActingAsKind, entityName?: string | null): string {
  const trimmedName = String(entityName ?? "").trim();
  if (kind === "institution") {
    if (trimmedName) {
      return `ADMIN olarak “${trimmedName}” kurumunun düzenleme panelindesiniz.`;
    }
    return "ADMIN olarak kurum düzenleme panelindesiniz.";
  }
  if (trimmedName) {
    return `ADMIN olarak “${trimmedName}” eğitmeninin düzenleme panelindesiniz.`;
  }
  return "ADMIN olarak eğitmen düzenleme panelindesiniz.";
}

export function AdminActingAsBanner({
  visible,
  kind,
  entityName,
}: {
  visible: boolean;
  kind: AdminActingAsKind;
  entityName?: string | null;
}) {
  if (!visible) return null;

  const message = buildAdminActingAsMessage(kind, entityName);

  return (
    <div className="admin-acting-as-banner" role="status">
      <AlertTriangle className="admin-acting-as-banner-icon" aria-hidden />
      <p className="admin-acting-as-banner-text">{message}</p>
    </div>
  );
}
