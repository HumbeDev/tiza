import { useTranslation } from "react-i18next";
import { useExportProgress } from "../export/export";

/** "Exporting… 3/12" while an export renders its slides. */
export default function ExportProgress() {
  const { t } = useTranslation();
  const progress = useExportProgress();
  if (!progress) return null;
  return (
    <div className="export-progress" role="status">
      <span className="spinner" aria-hidden="true" />
      {t("export.progress", progress)}
      <progress value={progress.done} max={progress.total} />
    </div>
  );
}
