import { created, handler } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { RATE_LIMITS, enforce } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/request';
import { requireUser } from '@/server/auth/guards';
import { processUpload, type UploadKind } from '@/server/uploads/service';

/** Uploads run through sharp, which needs the Node.js runtime. */
export const runtime = 'nodejs';

export const POST = handler(async (request) => {
  assertSameOrigin(request);
  const user = await requireUser();
  await enforce(RATE_LIMITS.upload, user.id);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new AppError('BAD_REQUEST', 'Attach a file under the "file" field');
  }

  const kindValue = form.get('kind');
  const kind: UploadKind = kindValue === 'avatar' ? 'avatar' : 'duel';

  const stored = await processUpload(file, kind, user.id);
  return created({ upload: stored });
});
