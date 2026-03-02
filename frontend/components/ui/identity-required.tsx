'use client';

import { Alert, Button, Stack, Text } from '@mantine/core';
import Link from 'next/link';

export function IdentityRequired({
  title = 'Sign in required',
  message = 'Use /profiles to quickly sign in with seeded users or add a development token override.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <Alert color="yellow" radius="md" className="max-w-2xl">
      <Stack gap={6}>
        <Text fw={600}>{title}</Text>
        <Text size="sm" c="dimmed">{message}</Text>
        <Button component={Link} href="/profiles" size="xs" variant="light" w="fit-content">
          Go to Profiles
        </Button>
      </Stack>
    </Alert>
  );
}
