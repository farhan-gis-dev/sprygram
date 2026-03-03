'use client';

import { Button, Divider, Group, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMantineColorScheme } from '@mantine/core';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { sprygramApi } from '@/lib/api-client';
import type { SprygramProfile } from '@/lib/api-types';
import { LoadingState } from '@/components/ui/loading-state';
import { useApiAuth } from '@/lib/use-api-auth';
import { useDevAuth } from '@/lib/dev-auth-context';

const SETTINGS_KEY = 'sprygram.settings.preferences';

type LocalPreferences = {
  autoplayVideos: boolean;
  dataSaver: boolean;
  hideLikeCounts: boolean;
  allowStoryReplies: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyMessages: boolean;
  showSensitiveContent: boolean;
  highQualityUploads: boolean;
  downloadOverWifiOnly: boolean;
  allowMentions: boolean;
  allowMessageRequests: boolean;
  showSuggestedPosts: boolean;
  quietMode: boolean;
  showKeyboardHints: boolean;
  professionalMode: boolean;
  insightsEmails: boolean;
  filteredWords: string;
  customStatus: string;
};

const defaultPreferences: LocalPreferences = {
  autoplayVideos: true,
  dataSaver: false,
  hideLikeCounts: false,
  allowStoryReplies: true,
  notifyLikes: true,
  notifyComments: true,
  notifyFollows: true,
  notifyMessages: true,
  showSensitiveContent: false,
  highQualityUploads: true,
  downloadOverWifiOnly: false,
  allowMentions: true,
  allowMessageRequests: true,
  showSuggestedPosts: true,
  quietMode: false,
  showKeyboardHints: true,
  professionalMode: false,
  insightsEmails: false,
  filteredWords: '',
  customStatus: '',
};

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-panel p-5">
      <Stack gap="sm">
        <div>
          <Text fw={700} size="lg">{title}</Text>
          <Text size="sm" c="dimmed">{description}</Text>
        </div>
        {children}
      </Stack>
    </div>
  );
}

export default function SettingsPage() {
  const auth = useApiAuth();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { isReady, activeIdentity } = useDevAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<SprygramProfile | null>(null);
  const [preferences, setPreferences] = useState<LocalPreferences>(defaultPreferences);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<LocalPreferences>;
      setPreferences((previous) => ({ ...previous, ...parsed }));
    } catch {
      setPreferences(defaultPreferences);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (!isReady || !auth.token) return;
    setLoading(true);
    sprygramApi.getMyProfile(auth)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [isReady, activeIdentity?.id, auth.token, auth.workspaceId]);

  const togglePreference = <K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]) => {
    setPreferences((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const togglePrivacy = async (checked: boolean) => {
    setSavingPrivacy(true);
    try {
      const updated = await sprygramApi.updateMyProfile({ isPrivate: checked }, auth);
      setProfile(updated);
      notifications.show({
        color: 'teal',
        title: 'Privacy updated',
        message: checked ? 'Your account is now private.' : 'Your account is now public.',
      });
    } catch (error: any) {
      notifications.show({ color: 'red', title: 'Update failed', message: error.message || 'Unable to update privacy.' });
    } finally {
      setSavingPrivacy(false);
    }
  };

  const copyDiagnostics = async () => {
    const snapshot = {
      username: profile?.username || null,
      colorScheme,
      preferences,
      generatedAt: new Date().toISOString(),
    };
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    notifications.show({ color: 'teal', title: 'Copied', message: 'Settings snapshot copied to clipboard.' });
  };

  if (!isReady || loading) {
    return <LoadingState message="Loading settings..." />;
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 py-6">
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-border bg-panel p-5">
          <Stack gap="sm">
            <Text fw={800} size="xl">Settings</Text>
            <Text size="sm" c="dimmed">
              Spryworkspace still owns global account settings. These controls are for Sprygram behavior and presentation.
            </Text>
            <Divider my="xs" />
            <Button component={Link} href="/activity" variant="subtle" justify="flex-start">Your Activity</Button>
            <Button component={Link} href="/saved" variant="subtle" justify="flex-start">Saved</Button>
            <Button component={Link} href="/messages" variant="subtle" justify="flex-start">Messages</Button>
            <Button component={Link} href="/profiles" variant="subtle" justify="flex-start">Profiles</Button>
          </Stack>
        </aside>

        <Stack gap="md">
          <SettingsCard
            title="How you use Sprygram"
            description="Daily behavior, posting controls, and playback settings for your own browsing experience."
          >
            <Switch
              checked={preferences.autoplayVideos}
              onChange={(event) => togglePreference('autoplayVideos', event.currentTarget.checked)}
              label="Autoplay videos"
            />
            <Switch
              checked={preferences.hideLikeCounts}
              onChange={(event) => togglePreference('hideLikeCounts', event.currentTarget.checked)}
              label="Hide like counts in your own view"
            />
            <Switch
              checked={preferences.quietMode}
              onChange={(event) => togglePreference('quietMode', event.currentTarget.checked)}
              label="Quiet mode for fewer interruptions"
            />
            <TextInput
              label="Status note"
              value={preferences.customStatus}
              onChange={(event) => togglePreference('customStatus', event.currentTarget.value)}
              placeholder="Optional note shown only on this device"
            />
          </SettingsCard>

          <SettingsCard
            title="Who can see your content"
            description="Privacy controls for your posts, stories, and account visibility."
          >
            <Switch
              checked={Boolean(profile?.isPrivate)}
              onChange={(event) => void togglePrivacy(event.currentTarget.checked)}
              label="Private account"
              disabled={savingPrivacy}
            />
            <Switch
              checked={preferences.allowStoryReplies}
              onChange={(event) => togglePreference('allowStoryReplies', event.currentTarget.checked)}
              label="Allow story replies by default"
            />
            <Switch
              checked={preferences.allowMessageRequests}
              onChange={(event) => togglePreference('allowMessageRequests', event.currentTarget.checked)}
              label="Allow message requests"
            />
          </SettingsCard>

          <SettingsCard
            title="How others can interact with you"
            description="Control mentions, comments, and incoming contact patterns."
          >
            <Switch
              checked={preferences.allowMentions}
              onChange={(event) => togglePreference('allowMentions', event.currentTarget.checked)}
              label="Allow mentions and tags"
            />
            <Switch
              checked={preferences.notifyComments}
              onChange={(event) => togglePreference('notifyComments', event.currentTarget.checked)}
              label="Comment notifications"
            />
            <Switch
              checked={preferences.notifyMessages}
              onChange={(event) => togglePreference('notifyMessages', event.currentTarget.checked)}
              label="Direct message notifications"
            />
            <Textarea
              label="Hidden words"
              minRows={3}
              value={preferences.filteredWords}
              onChange={(event) => togglePreference('filteredWords', event.currentTarget.value)}
              placeholder="Add comma-separated words to mute in your own browsing experience"
            />
          </SettingsCard>

          <SettingsCard
            title="What you see"
            description="Adjust feed and explore behavior on this device."
          >
            <Switch
              checked={preferences.showSuggestedPosts}
              onChange={(event) => togglePreference('showSuggestedPosts', event.currentTarget.checked)}
              label="Show suggested posts"
            />
            <Switch
              checked={preferences.showSensitiveContent}
              onChange={(event) => togglePreference('showSensitiveContent', event.currentTarget.checked)}
              label="Reduce sensitive content"
            />
            <Switch
              checked={preferences.notifyLikes}
              onChange={(event) => togglePreference('notifyLikes', event.currentTarget.checked)}
              label="Like notifications"
            />
            <Switch
              checked={preferences.notifyFollows}
              onChange={(event) => togglePreference('notifyFollows', event.currentTarget.checked)}
              label="Follow notifications"
            />
          </SettingsCard>

          <SettingsCard
            title="Your app and media"
            description="Media quality, storage preferences, and interface behavior for this browser."
          >
            <Switch
              checked={colorScheme === 'dark'}
              onChange={(event) => setColorScheme(event.currentTarget.checked ? 'dark' : 'light')}
              label="Dark mode"
            />
            <Switch
              checked={preferences.dataSaver}
              onChange={(event) => togglePreference('dataSaver', event.currentTarget.checked)}
              label="Use less bandwidth"
            />
            <Switch
              checked={preferences.highQualityUploads}
              onChange={(event) => togglePreference('highQualityUploads', event.currentTarget.checked)}
              label="Upload highest available quality"
            />
            <Switch
              checked={preferences.downloadOverWifiOnly}
              onChange={(event) => togglePreference('downloadOverWifiOnly', event.currentTarget.checked)}
              label="Prefer Wi-Fi for heavier media"
            />
            <Switch
              checked={preferences.showKeyboardHints}
              onChange={(event) => togglePreference('showKeyboardHints', event.currentTarget.checked)}
              label="Show keyboard hints on reels"
            />
          </SettingsCard>

          <SettingsCard
            title="Family Center"
            description="Relationship and supervision tools are not wired to backend records yet, but the entry point is ready."
          >
            <Group>
              <Button variant="default" onClick={() => notifications.show({ color: 'blue', title: 'Family Center', message: 'Family supervision tools will be connected once the backend policy module is added.' })}>
                Open Family Center
              </Button>
            </Group>
          </SettingsCard>

          <SettingsCard
            title="For professionals"
            description="Creator and business toggles for people who publish frequently."
          >
            <Switch
              checked={preferences.professionalMode}
              onChange={(event) => togglePreference('professionalMode', event.currentTarget.checked)}
              label="Professional dashboard mode"
            />
            <Switch
              checked={preferences.insightsEmails}
              onChange={(event) => togglePreference('insightsEmails', event.currentTarget.checked)}
              label="Receive insights summaries"
            />
          </SettingsCard>

          <SettingsCard
            title="More info and support"
            description="Diagnostics, reporting, and support shortcuts."
          >
            <Group>
              <Button variant="default" onClick={() => notifications.show({ color: 'orange', title: 'Report a Problem', message: 'A local report stub was created. Backend support ticket wiring can be added next.' })}>
                Report a Problem
              </Button>
              <Button variant="light" onClick={() => void copyDiagnostics()}>
                Copy diagnostics
              </Button>
            </Group>
          </SettingsCard>
        </Stack>
      </div>
    </div>
  );
}
