'use client';

import { Group, Stack, Text, TextInput } from '@mantine/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { sprygramApi } from '@/lib/api-client';
import type { SearchAccountResult } from '@/lib/api-types';
import { useApiAuth } from '@/lib/use-api-auth';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

export default function SearchPage() {
  const auth = useApiAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchAccountResult[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await sprygramApi.searchAccounts(trimmed, 30, auth);
        if (!cancelled) {
          setResults(response.items || []);
        }
      } catch (error: any) {
        if (!cancelled) {
          notifications.show({ color: 'red', title: 'Search error', message: error.message });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, auth.workspaceId]);

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 py-6">
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={700} size="xl">Search</Text>
          <Text size="sm" c="dimmed">Find creators and profiles.</Text>
        </Stack>

        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search"
          leftSection={<IconSearch size={16} />}
        />

        {loading ? <Text size="sm" c="dimmed">Searching...</Text> : null}

        <Stack gap={4}>
          {results.map((result) => (
            <Link key={result.userId} href={`/u/${encodeURIComponent(result.username)}`} className="rounded-lg border border-border bg-panel p-3 hover:bg-gray-50">
              <Group wrap="nowrap">
                <ProfileAvatar size={42} src={result.avatarUrl} name={result.displayName || result.username} />
                <Stack gap={0} className="min-w-0">
                  <Text fw={700} size="sm" lineClamp={1}>{result.username}</Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>{result.displayName || 'Sprygram user'}</Text>
                </Stack>
              </Group>
            </Link>
          ))}
        </Stack>
      </Stack>
    </div>
  );
}
