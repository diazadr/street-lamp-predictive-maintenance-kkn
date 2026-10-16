import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { getErrorMessage } from "@/src/lib/http/axios";
import { authService } from "../services/authService";
import { registerSchema, type RegisterFormData } from "../schema/registerSchema";

export const useRegisterForm = () => {
  const router = useRouter();
  const t = useTranslations("RegisterPage");
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);
    try {
      await authService.register({ name: data.name, email: data.email, password: data.password });
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (error) {
      setServerError(getErrorMessage(error, t("errors.failed")));
    } finally {
      setIsLoading(false);
    }
  };

  return { form, onSubmit: form.handleSubmit(onSubmit), isLoading, serverError, t };
};
