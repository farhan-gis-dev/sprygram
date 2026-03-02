'use client';

import { Button, Stack, Text } from '@mantine/core';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Stack align="center" py="xl" gap="xs" className="rounded-xl border border-border bg-panel px-6 text-center">
      <Text fw={700}>{title}</Text>
      <Text size="sm" c="dimmed" maw={420}>{description}</Text>
      {actionLabel && onAction ? (
        <Button variant="light" size="xs" onClick={onAction} mt="xs">{actionLabel}</Button>
      ) : null}
    </Stack>
  );
}