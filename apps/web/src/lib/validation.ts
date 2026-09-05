import { z } from 'zod';

/**
 * Shared request schemas. The same objects validate the form in the browser and
 * the payload on the server, so the two can never drift — but the server always
 * re-validates: client-side validation is a UX affordance, not a control.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Email is too short')
  .max(160)
  .email('Enter a valid email address');

export const passwordSchema = z.string().min(8, 'At least 8 characters').max(128);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'At least 3 characters')
  .max(20, 'At most 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Only a-z, 0-9 and _ are allowed');

export const displayNameSchema = z.string().trim().min(2, 'At least 2 characters').max(40);

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  locale: z.enum(['uz', 'ru', 'en']).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * An image location produced by the storage layer.
 *
 * The two drivers return different shapes: S3/R2 gives an absolute URL, the
 * local driver gives a root-relative path such as `/uploads/duel/…`. Demanding
 * an absolute URL would make image upload unusable in the default local
 * configuration.
 *
 * A single leading slash is required, so a protocol-relative `//evil.com/x.png`
 * is rejected along with `javascript:` and `data:` payloads.
 */
export const imageLocationSchema = z
  .string()
  .max(500)
  .refine(
    (value) => /^https:\/\/[^/]/.test(value) || /^\/[^/]/.test(value),
    'Must be an https URL or a root-relative path',
  );

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: z.string().trim().max(280).optional().or(z.literal('')),
  locale: z.enum(['uz', 'ru', 'en']).optional(),
  avatarUrl: imageLocationSchema.nullable().optional(),
  avatarKey: z.string().max(200).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

// ---------------------------------------------------------------------------
// Duels
// ---------------------------------------------------------------------------

export const duelTitleSchema = z.string().trim().min(6, 'At least 6 characters').max(140);
export const optionNameSchema = z.string().trim().min(1, 'Required').max(80);

const optionInputSchema = z.object({
  name: optionNameSchema,
  imageUrl: imageLocationSchema.nullable().optional(),
  imageKey: z.string().max(200).nullable().optional(),
});

export const createDuelSchema = z
  .object({
    title: duelTitleSchema,
    description: z.string().trim().max(500).optional().or(z.literal('')),
    categoryId: z.string().min(1, 'Choose a category'),
    visibility: z.enum(['PUBLIC', 'UNLISTED']).default('PUBLIC'),
    optionA: optionInputSchema,
    optionB: optionInputSchema,
  })
  .refine(
    (value) => value.optionA.name.toLowerCase() !== value.optionB.name.toLowerCase(),
    { message: 'The two options must be different', path: ['optionB', 'name'] },
  );
export type CreateDuelInput = z.infer<typeof createDuelSchema>;

export const updateDuelSchema = z.object({
  title: duelTitleSchema.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  categoryId: z.string().min(1).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED']).optional(),
});

export const voteSchema = z.object({
  optionId: z.string().min(1, 'Choose an option'),
});

export const shareSchema = z.object({
  channel: z.enum(['COPY', 'TELEGRAM', 'WHATSAPP', 'X', 'FACEBOOK', 'NATIVE', 'OTHER']),
});

// ---------------------------------------------------------------------------
// Comments and reports
// ---------------------------------------------------------------------------

export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Write something').max(1000, 'At most 1000 characters'),
});

export const reportSchema = z.object({
  reason: z.enum([
    'SPAM',
    'NSFW',
    'HATE',
    'HARASSMENT',
    'COPYRIGHT',
    'MISINFORMATION',
    'OTHER',
  ]),
  details: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ReportInput = z.infer<typeof reportSchema>;

// ---------------------------------------------------------------------------
// Feeds and queries
// ---------------------------------------------------------------------------

export const FEEDS = ['trending', 'new', 'popular'] as const;
export type Feed = (typeof FEEDS)[number];

export const feedQuerySchema = z.object({
  feed: z.enum(FEEDS).default('trending'),
  category: z.string().max(60).optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  author: z.string().max(30).optional(),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const paginationSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const ANALYTICS_EVENTS = [
  'page_view',
  'duel_view',
  'vote',
  'duel_created',
  'duel_shared',
  'duel_liked',
  'comment_created',
  'search',
  'registration',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export const analyticsEventSchema = z.object({
  name: z.enum(ANALYTICS_EVENTS),
  duelId: z.string().max(40).optional(),
  locale: z.enum(['uz', 'ru', 'en']).optional(),
  props: z.record(z.union([z.string().max(120), z.number(), z.boolean()])).optional(),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Only a-z, 0-9 and - are allowed'),
  nameUz: z.string().trim().min(2).max(40),
  nameRu: z.string().trim().min(2).max(40),
  nameEn: z.string().trim().min(2).max(40),
  emoji: z.string().trim().min(1).max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #6366f1'),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const moderateDuelSchema = z.object({
  action: z.enum(['HIDE', 'RESTORE', 'DELETE']),
  note: z.string().trim().max(300).optional(),
});

export const moderateCommentSchema = z.object({
  action: z.enum(['HIDE', 'RESTORE', 'DELETE']),
});

export const resolveReportSchema = z.object({
  action: z.enum(['RESOLVE', 'DISMISS']),
  note: z.string().trim().max(500).optional(),
});

export const moderateUserSchema = z.object({
  action: z.enum(['BAN', 'UNBAN', 'PROMOTE', 'DEMOTE']),
  reason: z.string().trim().max(300).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
});
