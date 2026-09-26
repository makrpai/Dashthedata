import { notFound } from 'next/navigation';
import { ComponentGallery } from '@/components/dev/ComponentGallery';

export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_DEV_UI !== 'true') notFound();
  return <ComponentGallery />;
}
