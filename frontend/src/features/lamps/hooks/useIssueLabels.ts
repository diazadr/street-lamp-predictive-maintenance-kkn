import { useTranslations } from "next-intl";

/** Readable names for pju_ml finding codes (rule engine or ML_*) and Random Forest condition labels. */
export function useIssueLabels() {
  const t = useTranslations("LampDetail.prediction");

  const conditionLabel = (label: string) => {
    const key = `conditions.${label}`;
    return t.has(key) ? t(key) : label.replace(/_/g, " ");
  };

  const issueTitle = (code: string) => {
    if (code.startsWith("ML_")) {
      return t("ml_prefix") + conditionLabel(code.slice(3).toLowerCase());
    }
    const key = `issue_codes.${code}`;
    return t.has(key) ? t(key) : code.replace(/_/g, " ").toLowerCase();
  };

  return { issueTitle, conditionLabel };
}
