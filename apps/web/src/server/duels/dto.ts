import type { Prisma } from '@dueluz/db';
import { votePercentages } from '@/lib/utils';

/**
 * Every duel read goes through this projection, so the shape the API returns is
 * defined in exactly one place and no query can accidentally leak a column.
 */
export const duelSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  status: true,
  visibility: true,
  voteCount: true,
  likeCount: true,
  commentCount: true,
  shareCount: true,
  viewCount: true,
  hotScore: true,
  createdAt: true,
  publishedAt: true,
  author: {
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  },
  category: {
    select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true, emoji: true, color: true },
  },
  options: {
    orderBy: { position: 'asc' },
    select: { id: true, name: true, imageUrl: true, position: true, voteCount: true },
  },
} satisfies Prisma.DuelSelect;

export type DuelRow = Prisma.DuelGetPayload<{ select: typeof duelSelect }>;

export type DuelOptionDto = {
  id: string;
  name: string;
  imageUrl: string | null;
  position: number;
  voteCount: number;
  percentage: number;
};

export type DuelDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: DuelRow['status'];
  visibility: DuelRow['visibility'];
  voteCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  createdAt: string;
  publishedAt: string | null;
  author: DuelRow['author'];
  category: DuelRow['category'];
  options: DuelOptionDto[];
  /** Which option the current viewer picked, if any. */
  votedOptionId: string | null;
  liked: boolean;
};

export function toDuelDto(
  row: DuelRow,
  viewer: { votedOptionId?: string | null; liked?: boolean } = {},
): DuelDto {
  const [first, second] = row.options;
  const [percentA, percentB] = votePercentages(first?.voteCount ?? 0, second?.voteCount ?? 0);
  const percentages = [percentA, percentB];

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    voteCount: row.voteCount,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    shareCount: row.shareCount,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    author: row.author,
    category: row.category,
    options: row.options.map((option, index) => ({
      id: option.id,
      name: option.name,
      imageUrl: option.imageUrl,
      position: option.position,
      voteCount: option.voteCount,
      percentage: percentages[index] ?? 0,
    })),
    votedOptionId: viewer.votedOptionId ?? null,
    liked: viewer.liked ?? false,
  };
}
