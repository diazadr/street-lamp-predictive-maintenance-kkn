import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { loginSchema, type LoginFormData } from "../schema/loginSchema";

export const useLoginForm = () => {
  const { login } = useAuth();
  const t = useTranslations("LoginPage");
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);
    const result = await login(data.email, data.password);
    // sukses: pengalihan ditangani (auth)/layout begitu user ter-set, agar tidak ada dua navigasi bersaing
    if (result.success) return;
    setIsLoading(false);
    if (result.status === 401) setServerError(t("errors.wrong_credentials"));
    else if (result.status === 403) setServerError(result.error || t("errors.inactive"));
    else if (result.status === 429) setServerError(t("errors.too_many"));
    else setServerError(result.error || t("errors.server_error"));
  };

  return { form, onSubmit: form.handleSubmit(onSubmit), isLoading, serverError, t };
};
