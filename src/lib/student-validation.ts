import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .max(255, "Email must be 255 characters or fewer")
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Enter a valid email address",
  });

export const addStudentSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the student's full name").max(100),
  cohort_id: z.string().uuid("Choose a cohort"),
  year_level: z.enum(["Year 1", "Year 2", "Year 3", "Year 4"]),
  guardian_name: z.string().trim().min(2, "Enter the guardian or parent's name").max(100),
  guardian_email: z.string().trim().email("Enter a valid guardian email").max(255),
  guardian_phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(24, "Phone number is too long")
    .regex(/^\+?[0-9 ()-]+$/, "Use numbers and an optional country code"),
  student_email: optionalEmail,
  rfid_uid: z
    .string()
    .trim()
    .max(64, "RFID UID must be 64 characters or fewer")
    .regex(/^[A-Za-z0-9:_-]*$/, "Use only letters, numbers, colons, dashes or underscores"),
  photo_url: z
    .string()
    .startsWith("data:image/jpeg;base64,", "Upload a valid student photo")
    .max(180_000, "The processed photo is too large"),
});

export type AddStudentInput = z.infer<typeof addStudentSchema>;