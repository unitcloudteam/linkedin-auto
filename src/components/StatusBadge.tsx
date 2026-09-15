import { STATUS_CLASS, STATUS_LABEL } from "@/lib/articles";
import type { ArticleStatus } from "@/lib/db";

/** Farbiges Status-Etikett für einen Artikel. */
export function StatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
