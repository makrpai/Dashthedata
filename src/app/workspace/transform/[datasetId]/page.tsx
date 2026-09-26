import { TransformView } from '@/components/transform/TransformView';

export default async function Page({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = await params;
  return <TransformView datasetId={datasetId} />;
}
