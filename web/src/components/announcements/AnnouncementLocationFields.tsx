"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import {
  fetchIller,
  fetchIlcelerByIlId,
  parseLocationId,
  type TurkiyeLocationOption,
} from "@/lib/turkiyeLocationsClient";

type AnnouncementLocationFieldsProps = {
  ilId: string;
  ilceId: string;
  disabled?: boolean;
  onIlChange: (ilId: string) => void;
  onIlceChange: (ilceId: string) => void;
  rowClassName: string;
  fieldClassName: string;
  labelClassName: string;
  selectTriggerClassName: string;
  selectContentClassName: string;
  ilSelectId: string;
  ilceSelectId: string;
};

export function AnnouncementLocationFields({
  ilId,
  ilceId,
  disabled = false,
  onIlChange,
  onIlceChange,
  rowClassName,
  fieldClassName,
  labelClassName,
  selectTriggerClassName,
  selectContentClassName,
  ilSelectId,
  ilceSelectId,
}: AnnouncementLocationFieldsProps) {
  const [iller, setIller] = useState<TurkiyeLocationOption[]>([]);
  const [ilceler, setIlceler] = useState<TurkiyeLocationOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchIller();
        if (!cancelled) setIller(rows);
      } catch (error) {
        console.error("İller yüklenemedi:", error);
        if (!cancelled) setIller([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const parsedIlId = parseLocationId(ilId);
    if (parsedIlId == null) {
      setIlceler([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchIlcelerByIlId(parsedIlId);
        if (!cancelled) setIlceler(rows);
      } catch (error) {
        console.error("İlçeler yüklenemedi:", error);
        if (!cancelled) setIlceler([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ilId]);

  return (
    <div className={rowClassName}>
      <div className={fieldClassName}>
        <label className={labelClassName} htmlFor={ilSelectId}>
          İl
        </label>
        <Select
          value={ilId || undefined}
          onValueChange={onIlChange}
          disabled={disabled || iller.length === 0}
        >
          <SelectTrigger id={ilSelectId} className={selectTriggerClassName} aria-label="İl">
            <SelectValue placeholder="İl seçiniz" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="start"
            sideOffset={4}
            className={selectContentClassName}
          >
            {iller.map((row) => (
              <SelectItem key={row.id} value={String(row.id)} className="select-item">
                {row.ad}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={fieldClassName}>
        <label className={labelClassName} htmlFor={ilceSelectId}>
          İlçe
        </label>
        <Select
          value={ilceId || undefined}
          onValueChange={onIlceChange}
          disabled={disabled || !ilId}
        >
          <SelectTrigger id={ilceSelectId} className={selectTriggerClassName} aria-label="İlçe">
            <SelectValue placeholder="İlçe seçiniz" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="start"
            sideOffset={4}
            className={selectContentClassName}
          >
            {ilceler.map((row) => (
              <SelectItem key={row.id} value={String(row.id)} className="select-item">
                {row.ad}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
