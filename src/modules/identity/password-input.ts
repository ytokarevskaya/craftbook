import { z } from "zod";
export const passwordValue = z.string().refine(value => [...value].length>=12 && new TextEncoder().encode(value).length<=72,
  "Heslo musí mít alespoň 12 znaků a nejvýše 72 bajtů UTF-8.");
export const passwordInput = z.object({
  newPassword: passwordValue,
  confirmation: z.string(),
  currentPassword: z.string().max(1024).optional(),
}).strict().refine(value=>value.newPassword===value.confirmation,"Nové heslo a potvrzení se musí shodovat.")
.refine(value=>!value.currentPassword || value.currentPassword!==value.newPassword,"Nové heslo musí být jiné než současné.");
