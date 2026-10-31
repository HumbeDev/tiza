import { useTranslation } from "react-i18next";
import { openWebPresenterView, presentClient, useWebPresentation } from "./client";
import AudienceView from "./AudienceView";

/** Web version: the audience view covers the editor tab (fullscreen). */
export default function WebPresentation() {
  const { t } = useTranslation();
  const active = useWebPresentation((s) => s.snapshot !== null);
  if (!active) return null;
  return (
    <div className="web-presentation">
      <AudienceView client={presentClient} />
      <div className="web-present-controls">
        <button type="button" className="small-button" onClick={openWebPresenterView}>
          {t("present.openPresenter")}
        </button>
        <button type="button" className="small-button" onClick={() => presentClient.end()}>
          {t("present.end")}
        </button>
      </div>
    </div>
  );
}
