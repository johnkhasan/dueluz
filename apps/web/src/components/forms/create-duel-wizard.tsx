'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, PartyPopper } from 'lucide-react';
import type { CategoryDto } from '@/server/categories/service';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/field';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiPost, trackEvent } from '@/lib/client/api';
import { createDuelSchema, duelTitleSchema, optionNameSchema } from '@/lib/validation';
import { cn, gradientFor } from '@/lib/utils';
import { ImageUpload, type UploadedImage } from './image-upload';
import { VsBadge } from '@/components/duel/vs-badge';

type Step = 0 | 1 | 2 | 3;
const TOTAL_STEPS = 4;

type Draft = {
  title: string;
  optionA: string;
  optionB: string;
  imageA: UploadedImage;
  imageB: UploadedImage;
  categoryId: string;
  description: string;
};

/**
 * Four-step creation flow.
 *
 * Step 1 asks only for the three things a duel cannot exist without, so the
 * fastest path to a published duel is short. Everything optional (images,
 * description) comes after, and the preview is the real card component rather
 * than an approximation.
 */
export function CreateDuelWizard({ categories }: { categories: CategoryDto[] }) {
  const { locale, t, fill, errorMessage } = useI18n();
  const { show } = useToast();

  const [step, setStep] = useState<Step>(0);
  const [draft, setDraft] = useState<Draft>({
    title: '',
    optionA: '',
    optionB: '',
    imageA: null,
    imageB: null,
    categoryId: categories[0]?.id ?? '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }

  const stepValid = useMemo(() => {
    if (step === 0) {
      return (
        duelTitleSchema.safeParse(draft.title).success &&
        optionNameSchema.safeParse(draft.optionA).success &&
        optionNameSchema.safeParse(draft.optionB).success &&
        draft.optionA.trim().toLowerCase() !== draft.optionB.trim().toLowerCase()
      );
    }
    if (step === 2) return draft.categoryId.length > 0;
    return true;
  }, [step, draft]);

  function next() {
    if (step === 0) {
      const issues: Record<string, string> = {};
      const title = duelTitleSchema.safeParse(draft.title);
      if (!title.success) issues.title = title.error.issues[0]?.message ?? '';

      const a = optionNameSchema.safeParse(draft.optionA);
      if (!a.success) issues.optionA = a.error.issues[0]?.message ?? '';

      const b = optionNameSchema.safeParse(draft.optionB);
      if (!b.success) issues.optionB = b.error.issues[0]?.message ?? '';

      if (
        !issues.optionB &&
        draft.optionA.trim().toLowerCase() === draft.optionB.trim().toLowerCase()
      ) {
        issues.optionB = t.create.optionB;
      }

      if (Object.keys(issues).length > 0) {
        setErrors(issues);
        return;
      }
    }
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1) as Step);
  }

  async function publish() {
    const parsed = createDuelSchema.safeParse({
      title: draft.title,
      description: draft.description,
      categoryId: draft.categoryId,
      visibility: 'PUBLIC',
      optionA: { name: draft.optionA, imageUrl: draft.imageA?.url, imageKey: draft.imageA?.key },
      optionB: { name: draft.optionB, imageUrl: draft.imageB?.url, imageKey: draft.imageB?.key },
    });

    if (!parsed.success) {
      show(errorMessage('VALIDATION_ERROR'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { duel } = await apiPost<{ duel: { id: string; slug: string; category: { slug: string } } }>(
        '/api/duels',
        parsed.data,
      );
      trackEvent('duel_created', { duelId: duel.id, locale });
      setPublishedSlug(duel.slug);
    } catch (error) {
      show(
        error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (publishedSlug) {
    return (
      <Card>
        <CardBody className="space-y-4 py-10 text-center">
          <PartyPopper className="text-accent mx-auto size-12" />
          <h2 className="text-fg text-2xl font-black tracking-tight">{t.create.published}</h2>
          <p className="text-fg-muted text-sm">{t.create.publishedHint}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link href={`/${locale}/d/${publishedSlug}`}>
              <Button size="lg">{t.create.viewDuel}</Button>
            </Link>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                setPublishedSlug(null);
                setStep(0);
                setDraft({
                  title: '',
                  optionA: '',
                  optionB: '',
                  imageA: null,
                  imageB: null,
                  categoryId: categories[0]?.id ?? '',
                  description: '',
                });
              }}
            >
              {t.create.createAnother}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const labels = [t.create.stepQuestion, t.create.stepImages, t.create.stepDetails, t.create.stepPreview];

  return (
    <div className="space-y-5">
      <Stepper step={step} labels={labels} />

      <Card>
        <CardBody className="space-y-5">
          {step === 0 ? (
            <>
              <Input
                data-testid="duel-title"
                label={t.create.question}
                hint={t.create.questionHint}
                placeholder={t.create.questionPlaceholder}
                value={draft.title}
                error={errors.title}
                maxLength={140}
                required
                onChange={(event) => update('title', event.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  data-testid="duel-option-a"
                  label={t.create.optionA}
                  placeholder={t.create.optionAPlaceholder}
                  value={draft.optionA}
                  error={errors.optionA}
                  maxLength={80}
                  required
                  onChange={(event) => update('optionA', event.target.value)}
                />
                <Input
                  data-testid="duel-option-b"
                  label={t.create.optionB}
                  placeholder={t.create.optionBPlaceholder}
                  value={draft.optionB}
                  error={errors.optionB}
                  maxLength={80}
                  required
                  onChange={(event) => update('optionB', event.target.value)}
                />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div>
                <p className="text-fg text-sm font-medium">{t.create.images}</p>
                <p className="text-fg-subtle text-xs">{t.create.imagesHint}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ImageUpload
                  value={draft.imageA}
                  onChange={(image) => update('imageA', image)}
                  label={draft.optionA || t.create.optionA}
                />
                <ImageUpload
                  value={draft.imageB}
                  onChange={(image) => update('imageB', image)}
                  label={draft.optionB || t.create.optionB}
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="space-y-2">
                <p className="text-fg text-sm font-medium">
                  {t.create.category}
                  <span className="text-danger ml-0.5">*</span>
                </p>
                <p className="text-fg-subtle text-xs">{t.create.categoryHint}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => update('categoryId', category.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors',
                        draft.categoryId === category.id
                          ? 'border-accent bg-accent text-accent-fg'
                          : 'border-border text-fg-muted hover:bg-surface-muted',
                      )}
                    >
                      <span aria-hidden>{category.emoji}</span>
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                label={t.create.description}
                placeholder={t.create.descriptionPlaceholder}
                value={draft.description}
                maxLength={500}
                onChange={(event) => update('description', event.target.value)}
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div>
                <p className="text-fg text-sm font-medium">{t.create.preview}</p>
                <p className="text-fg-subtle text-xs">{t.create.previewHint}</p>
              </div>
              <PreviewCard draft={draft} categories={categories} />
            </>
          ) : null}

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              variant="ghost"
              onClick={() => setStep((current) => Math.max(0, current - 1) as Step)}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft className="size-4" />
              {t.common.back}
            </Button>

            <span className="text-fg-subtle text-xs font-semibold">
              {fill(t.create.step, { current: step + 1, total: TOTAL_STEPS })}
            </span>

            {step === TOTAL_STEPS - 1 ? (
              <Button onClick={publish} loading={submitting}>
                <Check className="size-4" />
                {submitting ? t.create.publishing : t.create.publish}
              </Button>
            ) : (
              <Button onClick={next} disabled={!stepValid}>
                {t.common.next}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-1.5">
      {labels.map((label, index) => (
        <li key={label} className="flex-1">
          <div
            className={cn(
              'h-1.5 rounded-full transition-colors',
              index <= step ? 'brand-gradient' : 'bg-surface-muted',
            )}
          />
          <p
            className={cn(
              'mt-1.5 truncate text-[11px] font-semibold',
              index === step ? 'text-fg' : 'text-fg-subtle',
            )}
          >
            {label}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** The real card layout, so what the author approves is what gets published. */
function PreviewCard({ draft, categories }: { draft: Draft; categories: CategoryDto[] }) {
  const { t } = useI18n();
  const category = categories.find((item) => item.id === draft.categoryId);

  return (
    <div className="border-border bg-surface overflow-hidden rounded-2xl border">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <span className="bg-surface-muted text-fg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
          <span aria-hidden>{category?.emoji}</span>
          {category?.name}
        </span>
      </div>

      <h3 className="text-fg px-4 pb-3 text-base font-bold tracking-tight">{draft.title}</h3>

      <div className="relative flex h-36 overflow-hidden sm:h-40">
        <VsBadge />
        {(
          [
            { name: draft.optionA, image: draft.imageA, side: 'a' as const },
            { name: draft.optionB, image: draft.imageB, side: 'b' as const },
          ]
        ).map(({ name, image, side }) => (
          <div
            key={side}
            className="border-bg relative w-1/2 border-x-2"
            style={image ? undefined : { backgroundImage: gradientFor(name || side, side) }}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt={name} className="absolute inset-0 size-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />
            <span className="absolute inset-x-0 bottom-0 line-clamp-2 p-3 text-sm font-bold text-white drop-shadow">
              {name}
            </span>
          </div>
        ))}
      </div>

      <p className="text-fg-subtle border-border border-t px-4 py-2.5 text-xs font-semibold">
        {t.duel.tapToVote}
      </p>
    </div>
  );
}
