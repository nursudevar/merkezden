"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, Star } from "lucide-react";
import { Button } from "@/components/ui";
import {
  FEATURE_HIGHLIGHTS_REQUIRED_COUNT,
  type FeatureHighlightCandidate,
  type FeatureHighlightSelection,
} from "@/lib/featureHighlights";

type Props = {
  candidates: FeatureHighlightCandidate[];
  selected: FeatureHighlightSelection[];
  onChange: (next: FeatureHighlightSelection[]) => void;
  warning: string | null;
};

export function FeatureHighlightsCard({ candidates, selected, onChange, warning }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const selectedIds = useMemo(
    () => new Set(selected.map((item) => item.identity)),
    [selected],
  );

  const grouped = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    const map = new Map<string, FeatureHighlightCandidate[]>();
    for (const candidate of candidates) {
      const haystack = `${candidate.label} ${candidate.valueLabel ?? ""} ${candidate.groupName}`
        .toLocaleLowerCase("tr-TR");
      if (needle && !haystack.includes(needle)) continue;
      const list = map.get(candidate.groupName) ?? [];
      list.push(candidate);
      map.set(candidate.groupName, list);
    }
    return Array.from(map.entries());
  }, [candidates, query]);

  const toggle = (candidate: FeatureHighlightCandidate) => {
    if (selectedIds.has(candidate.identity)) {
      onChange(selected.filter((item) => item.identity !== candidate.identity));
      return;
    }
    if (selected.length >= FEATURE_HIGHLIGHTS_REQUIRED_COUNT) return;
    onChange([...selected, candidate]);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <>
      <section className="feature-highlights-card" aria-label="Öne Çıkan Özellikler">
        <div className="feature-highlights-card-head">
          <div className="feature-highlights-card-title-wrap">
            <Star className="feature-highlights-card-icon" aria-hidden size={18} />
            <h3 className="feature-highlights-card-title">Öne Çıkan Özellikler</h3>
          </div>
          <span className="feature-highlights-card-count">
            {selected.length}/{FEATURE_HIGHLIGHTS_REQUIRED_COUNT}
          </span>
        </div>
        <p className="feature-highlights-card-copy">
          Profilinizde öne çıkarmak istediğiniz 4 özelliği, mevcut özellik seçimleriniz arasından
          belirleyin.
        </p>
        {warning ? (
          <p className="feature-highlights-card-warning" role="status">
            {warning}
          </p>
        ) : null}
        {selected.length > 0 ? (
          <ol className="feature-highlights-selected-list">
            {selected.map((item, index) => (
              <li key={item.identity} className="feature-highlights-selected-item">
                <span className="feature-highlights-selected-label">
                  {index + 1}. {item.label}
                  {item.valueLabel ? ` · ${item.valueLabel}` : ""}
                </span>
                <span className="feature-highlights-selected-actions">
                  <button
                    type="button"
                    className="feature-highlights-move-btn"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Yukarı taşı"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="feature-highlights-move-btn"
                    onClick={() => move(index, 1)}
                    disabled={index === selected.length - 1}
                    aria-label="Aşağı taşı"
                  >
                    <ChevronDown size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="feature-highlights-empty">Henüz öne çıkan özellik seçilmedi.</p>
        )}
        <Button
          type="button"
          variant="outline"
          className="feature-highlights-open-btn"
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
        >
          Özellik seç
        </Button>
      </section>

      {open ? (
        <div
          className="app-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feature-highlights-modal-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="app-modal-content feature-highlights-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="feature-highlights-modal-title" className="app-modal-title">
              Öne Çıkan Özellikler
            </h2>
            <div className="app-modal-body">
              <p className="feature-highlights-modal-count">
                {selected.length}/{FEATURE_HIGHLIGHTS_REQUIRED_COUNT}
              </p>
              <label className="feature-highlights-search">
                <Search size={16} aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Özellik ara"
                  aria-label="Öne çıkan özellik ara"
                />
              </label>
              <div className="feature-highlights-modal-groups">
                {grouped.length === 0 ? (
                  <p className="feature-highlights-empty">Seçilebilir özellik bulunamadı.</p>
                ) : (
                  grouped.map(([groupName, items]) => (
                    <section key={groupName} className="feature-highlights-modal-group">
                      <h3 className="feature-highlights-modal-group-title">{groupName}</h3>
                      <ul className="feature-highlights-modal-list">
                        {items.map((candidate) => {
                          const checked = selectedIds.has(candidate.identity);
                          const disabled =
                            !checked && selected.length >= FEATURE_HIGHLIGHTS_REQUIRED_COUNT;
                          return (
                            <li key={candidate.identity}>
                              <label
                                className={`feature-highlights-check${
                                  disabled ? " feature-highlights-check--disabled" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggle(candidate)}
                                />
                                <span>
                                  {candidate.label}
                                  {candidate.valueLabel ? ` · ${candidate.valueLabel}` : ""}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))
                )}
              </div>
            </div>
            <div className="app-modal-footer">
              <Button
                type="button"
                variant="default"
                className="app-modal-btn app-modal-btn--primary"
                onClick={() => setOpen(false)}
              >
                Tamam
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
