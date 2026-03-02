'use client';

import { Center, Loader, Stack, Text } from '@mantine/core';
import { useSpryAccountManager } from 'spry-apps-dropdown';

export default function OidcCallbackPage() {
  useSpryAccountManager();

  return (
    <Center h="100vh">
      <Stack align="center" gap="sm">
        <Loader />
        <Text size="sm" c="dimmed">Completing Sprylogin authentication...</Text>
      </Stack>
    </Center>
  );
}
