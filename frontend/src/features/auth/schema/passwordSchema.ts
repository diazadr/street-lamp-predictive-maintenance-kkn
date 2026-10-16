import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "email_required").email("email_invalid"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "password_min"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "password_mismatch", path: ["confirm"] });

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
