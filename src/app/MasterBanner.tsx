import { useTranslation } from "react-i18next";
import { isEditingMaster, removeMaster, selectSlide, useEditor } from "../store/editor";
import Icon from "./Icon";

/** Shown over the canvas while the master slide is open. */
export default function MasterBanner() {
  const { t } = useTranslation();
  const editing = useEditor(isEditingMaster);
  if (!editing) return null;
  return (
    <div className="master-banner" role="status">
      <Icon name="master" />
      <span>{t("master.editing")}</span>
      <button
        type="button"
        className="small-button primary"
        onClick={() => selectSlide(useEditor.getState().doc.slides[0].id)}
      >
        {t("master.close")}
      </button>
      <button type="button" className="small-button danger" onClick={removeMaster}>
        {t("master.remove")}
      </button>
    </div>
  );
}
