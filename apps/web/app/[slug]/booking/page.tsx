import type { Metadata } from 'next';
import { fetchManifest } from '@/lib/api/platform';
import { fetchServices } from '@/lib/api/services';
import { BookingForm } from '@/components/booking/BookingForm';
import { Unavailable } from '@/components/hotsite/Unavailable';

export const revalidate = 300;

interface BookingPageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const manifest = await fetchManifest(slug);

  if (!manifest.isPublished) {
    return { title: 'Em breve — BeloAuto' };
  }

  return { title: 'Agendar serviço' };
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug } = await params;
  const manifest = await fetchManifest(slug);

  if (!manifest.isPublished) {
    return <Unavailable />;
  }

  const services = await fetchServices(slug);

  return <BookingForm slug={slug} services={services} />;
}
