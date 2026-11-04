import { themeOf } from "../document/themes";
import { useEditor } from "../store/editor";

/** The design's colors, offered as suggestions by every color picker. */
export default function DesignColors() {
  const theme = useEditor((s) => themeOf(s.doc));
  return (
    <datalist id="design-colors">
      {[theme.text, theme.background, ...theme.accents].map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}
