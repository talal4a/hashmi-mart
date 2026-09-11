import { z } from 'zod';
import { DELIVERY_AREAS } from '../data/deliveryAreas';
import { phoneDigits } from '../utils/phone';

/**
 * What has to be true before an order can be placed.
 *
 * Deliberately not `completeProfileSchema`. That one also demands a role, which
 * has nothing to do with delivering groceries, and it has no concept of an area
 * or of instructions for the rider. Sharing it would mean either loosening the
 * profile gate or asking this form for a field it has no business collecting.
 *
 * The messages are the ones shown under the fields, so they say what to do
 * rather than what is wrong: "Enter a valid mobile number", not "invalid".
 */

export const PHONE_MIN_DIGITS = 9;
export const PHONE_MAX_DIGITS = 12;

export const deliverySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Enter your full name' })
    .max(50, { message: 'Keep it under 50 characters' }),
  phone: z
    .string()
    .trim()
    .refine(
      value => {
        const digits = phoneDigits(value);
        return (
          digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS
        );
      },
      { message: 'Enter a valid mobile number' },
    ),
  area: z.enum(DELIVERY_AREAS, {
    error: 'Choose the area we are delivering to',
  }),
  address: z
    .string()
    .trim()
    .min(6, { message: 'House and street, so the rider can find you' })
    .max(140, { message: 'Keep the address under 140 characters' }),
  /** Optional by design: most orders have nothing to add. */
  instructions: z
    .string()
    .trim()
    .max(160, { message: 'Keep instructions under 160 characters' })
    .optional(),
});

export type DeliveryForm = {
  name: string;
  phone: string;
  area: string;
  address: string;
  instructions: string;
};

export type DeliveryErrors = Partial<Record<keyof DeliveryForm, string>>;

/** Field-keyed messages, so each one can be shown under its own input. */
export function validateDelivery(form: DeliveryForm): DeliveryErrors {
  const result = deliverySchema.safeParse({
    ...form,
    instructions: form.instructions.trim() || undefined,
  });
  if (result.success) return {};
  const errors: DeliveryErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof DeliveryForm | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
