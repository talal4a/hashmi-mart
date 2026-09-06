import { z } from 'zod';

export const PASSWORD_MIN = 8;

export const PHONE_MIN_DIGITS = 9;
export const PHONE_MAX_DIGITS = 12;

export const NAME_MIN = 2;
export const NAME_MAX = 50;

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN, { message: 'Enter your full name' })
    .max(NAME_MAX, { message: `Keep it under ${NAME_MAX} characters` }),
  email: z.string().email({ message: 'Enter a valid email address' }),
  password: z
    .string()
    .min(PASSWORD_MIN, {
      message: `Use at least ${PASSWORD_MIN} characters`,
    })
    .max(64, { message: 'Password is too long' }),
});
export type SignupFormData = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' }),
  password: z.string().min(6, { message: 'Enter your password' }),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' }),
});
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const GENDERS = ['male', 'female', 'unspecified'] as const;
export type Gender = (typeof GENDERS)[number];

export const USER_ROLES = ['customer', 'vendor', 'rider'] as const;
export const userRoleSchema = z.enum(USER_ROLES, {
  error: 'Choose Customer, Vendor, or Rider to continue.',
});
export type UserRole = z.infer<typeof userRoleSchema>;

export const completeProfileSchema = z.object({
  role: userRoleSchema,
  name: z
    .string()
    .trim()
    .min(NAME_MIN, { message: 'Enter your full name' })
    .max(NAME_MAX, { message: `Keep it under ${NAME_MAX} characters` }),
  phone: z
    .string()
    .trim()
    .refine(
      value => {
        const digits = value.replace(/\D/g, '').replace(/^0+/, '');
        return (
          digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS
        );
      },
      { message: 'Enter a valid mobile number' },
    ),
  gender: z.enum(GENDERS).optional(),
  address: z
    .string()
    .trim()
    .min(1, { message: 'Enter your delivery address' })
    .max(140, { message: 'Keep the address under 140 characters' }),
});
export type CompleteProfileFormData = z.infer<typeof completeProfileSchema>;
