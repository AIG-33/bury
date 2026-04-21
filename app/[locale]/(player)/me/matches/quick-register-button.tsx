"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { QuickRegisterDialog } from "./quick-register-dialog";

export function QuickRegisterButton() {
  const t = useTranslations("myMatches");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-grass-500 px-3 text-sm font-medium text-white shadow-card hover:bg-grass-600"
      >
        <Plus className="h-4 w-4" />
        {t("quick_register_cta")}
      </button>
      <QuickRegisterDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
