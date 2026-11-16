import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import CustomToolRunner from './CustomToolRunner';

export const revalidate = 60;

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let tool: any = null;
  try {
    const { data } = await createPublicClient().from('tools').select('slug,name,description,credit_cost').eq('slug', slug).eq('enabled', true).maybeSingle();
    tool = data;
  } catch {
    tool = null;
  }
  if (!tool) notFound();
  return <CustomToolRunner slug={tool.slug} title={tool.name} description={tool.description || null} creditCost={tool.credit_cost} />;
}
