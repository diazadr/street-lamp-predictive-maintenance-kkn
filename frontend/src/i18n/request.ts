import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as "id" | "en")) {
    locale = routing.defaultLocale;
  }

  const [publicMessages, dashboardMessages] = await Promise.all([
    import(`../../messages/public/${locale}.json`),
    import(`../../messages/dashboard/${locale}.json`),
  ]);

  const pMessages = publicMessages.default || {};
  const dMessages = dashboardMessages.default || {};
  const mergedMessages: Record<string, unknown> = { ...pMessages };

  for (const key of Object.keys(dMessages)) {
    const existing = mergedMessages[key];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      mergedMessages[key] = { ...(existing as object), ...dMessages[key] };
    } else {
      mergedMessages[key] = dMessages[key];
    }
  }

  return {
    locale,
    timeZone: "Asia/Jakarta",
    messages: mergedMessages,
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter((part) => part != null).join(".");
    },
    onError(error) {
      if (error.code !== "MISSING_MESSAGE") console.error(error);
    },
  };
});
