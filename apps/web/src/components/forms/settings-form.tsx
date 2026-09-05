'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { ApiClientError, apiPatch, apiPost } from '@/lib/client/api';
import { ImageUpload, type UploadedImage } from './image-upload';

type Props = {
  user: {
    id: string;
    username: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
  };
};

export function SettingsForm({ user }: Props) {
  const { t, errorMessage } = useI18n();
  const { show } = useToast();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatar, setAvatar] = useState<UploadedImage>(
    user.avatarUrl ? { url: user.avatarUrl, key: '' } : null,
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileErrors({});

    try {
      await apiPatch('/api/me/profile', {
        displayName,
        bio,
        avatarUrl: avatar?.url ?? null,
        ...(avatar?.key ? { avatarKey: avatar.key } : {}),
      });
      show(t.settings.saved, 'success');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setProfileErrors(error.fieldErrors);
        show(errorMessage(error.code, error.message), 'error');
      } else {
        show(errorMessage(undefined), 'error');
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordErrors({});

    try {
      await apiPost('/api/me/password', passwords);
      show(t.settings.passwordChanged, 'success');
      // Every session was revoked, including this one.
      router.push('/');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setPasswordErrors(error.fieldErrors);
        show(errorMessage(error.code, error.message), 'error');
      } else {
        show(errorMessage(undefined), 'error');
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody>
          <form onSubmit={saveProfile} className="space-y-4">
            <CardTitle>{t.settings.profileSection}</CardTitle>

            <div className="flex items-center gap-4">
              <div className="w-24 shrink-0">
                <ImageUpload
                  value={avatar}
                  onChange={setAvatar}
                  kind="avatar"
                  label={t.settings.changeAvatar}
                />
              </div>
              <div className="text-fg-muted text-sm">
                <Avatar name={displayName || user.username} src={avatar?.url} size="lg" />
                <p className="mt-2">@{user.username}</p>
              </div>
            </div>

            <Input
              label={t.auth.displayName}
              value={displayName}
              error={profileErrors.displayName}
              maxLength={40}
              required
              onChange={(event) => setDisplayName(event.target.value)}
            />

            <Textarea
              label={t.settings.bio}
              placeholder={t.settings.bioPlaceholder}
              value={bio}
              error={profileErrors.bio}
              maxLength={280}
              onChange={(event) => setBio(event.target.value)}
            />

            <Button type="submit" loading={savingProfile}>
              {t.common.save}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <CardTitle>{t.settings.appearance}</CardTitle>
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-1.5">
              <p className="text-fg-muted text-sm font-medium">{t.common.theme}</p>
              <ThemeToggle />
            </div>
            <div className="space-y-1.5">
              <p className="text-fg-muted text-sm font-medium">{t.common.language}</p>
              <LocaleSwitcher />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <form onSubmit={savePassword} className="space-y-4">
            <CardTitle>{t.settings.security}</CardTitle>

            <Input
              type="password"
              autoComplete="current-password"
              label={t.settings.currentPassword}
              value={passwords.currentPassword}
              error={passwordErrors.currentPassword}
              required
              onChange={(event) =>
                setPasswords((current) => ({ ...current, currentPassword: event.target.value }))
              }
            />
            <Input
              type="password"
              autoComplete="new-password"
              label={t.settings.newPassword}
              hint={t.auth.passwordHint}
              value={passwords.newPassword}
              error={passwordErrors.newPassword}
              required
              onChange={(event) =>
                setPasswords((current) => ({ ...current, newPassword: event.target.value }))
              }
            />

            <p className="text-fg-subtle text-xs">{t.settings.logoutEverywhere}</p>

            <Button type="submit" variant="secondary" loading={savingPassword}>
              {t.settings.changePassword}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
