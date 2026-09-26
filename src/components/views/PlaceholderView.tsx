'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { TKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/useT';
import { ViewHeader } from './ViewHeader';

/** Generic empty view used until a feature view is implemented. */
export function PlaceholderView({
  title,
  text,
  withDataLink = false,
}: {
  title: TKey;
  text: TKey;
  withDataLink?: boolean;
}) {
  const t = useT();
  return (
    <>
      <ViewHeader title={t(title)} />
      <Card>
        <EmptyState
          text={t(text)}
          action={
            withDataLink ? (
              <Button asChild variant="primary">
                <Link href="/workspace/data">{t('views.goToData')}</Link>
              </Button>
            ) : undefined
          }
        />
      </Card>
    </>
  );
}
