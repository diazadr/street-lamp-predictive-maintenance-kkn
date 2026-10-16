import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "name_required"),
    email: z.string().min(1, "email_required").email("email_invalid"),
    password: z.string().min(8, "password_min"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "password_mismatch", path: ["confirm"] });

export type RegisterFormData = z.infer<typeof registerSchema>;
