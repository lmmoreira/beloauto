// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { GalleryImage } from '@beloauto/types';
import { GalleryGrid } from './GalleryGrid';

function makeImage(overrides?: Partial<GalleryImage>): GalleryImage {
  return { url: 'https://storage.example.com/photo.jpg', source: 'upload', ...overrides };
}

function makeImages(count: number): GalleryImage[] {
  return Array.from({ length: count }, (_, i) =>
    makeImage({ url: `https://storage.example.com/photo-${i}.jpg` }),
  );
}

describe('GalleryGrid', () => {
  it('renders a grid layout container for layout: grid', () => {
    const { container } = render(
      <GalleryGrid images={[makeImage()]} maxVisible={6} layout="grid" />,
    );

    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders a CSS-columns container for layout: masonry', () => {
    const { container } = render(
      <GalleryGrid images={[makeImage()]} maxVisible={6} layout="masonry" />,
    );

    expect(container.querySelector('.columns-2')).toBeInTheDocument();
  });

  it('renders only maxVisible images and a "Ver mais" button when there are more', () => {
    const { container } = render(
      <GalleryGrid images={makeImages(5)} maxVisible={2} layout="grid" />,
    );

    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Ver mais' })).toBeInTheDocument();
  });

  it('does not render "Ver mais" when images.length <= maxVisible', () => {
    render(<GalleryGrid images={makeImages(3)} maxVisible={6} layout="grid" />);

    expect(screen.queryByRole('button', { name: 'Ver mais' })).not.toBeInTheDocument();
  });

  it('reveals all images and hides the button after clicking "Ver mais"', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <GalleryGrid images={makeImages(5)} maxVisible={2} layout="grid" />,
    );

    await user.click(screen.getByRole('button', { name: 'Ver mais' }));

    expect(container.querySelectorAll('img')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Ver mais' })).not.toBeInTheDocument();
  });

  it('wraps each thumbnail in a link for progressive enhancement', () => {
    const image = makeImage({ url: 'https://storage.example.com/full.jpg' });
    render(<GalleryGrid images={[image]} maxVisible={6} layout="grid" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://storage.example.com/full.jpg');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('opens the lightbox with the full image when a thumbnail link is clicked', async () => {
    const user = userEvent.setup();
    const image = makeImage({ url: 'https://storage.example.com/full.jpg', caption: 'Antes' });
    const { container } = render(<GalleryGrid images={[image]} maxVisible={6} layout="grid" />);

    await user.click(screen.getByRole('link'));

    const dialog = container.querySelector('dialog');
    expect(dialog?.querySelector('img')).toHaveAttribute(
      'src',
      'https://storage.example.com/full.jpg',
    );
  });

  it('shows the caption inside the lightbox when the image has one', async () => {
    const user = userEvent.setup();
    const image = makeImage({ caption: 'Lavagem completa' });
    const { container } = render(<GalleryGrid images={[image]} maxVisible={6} layout="grid" />);

    await user.click(screen.getByRole('link'));

    expect(container.querySelector('dialog p')?.textContent).toBe('Lavagem completa');
  });

  it('closes the lightbox when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <GalleryGrid images={[makeImage()]} maxVisible={6} layout="grid" />,
    );

    await user.click(screen.getByRole('link'));
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    const dialog = container.querySelector('dialog');
    expect(dialog?.querySelector('img')).not.toBeInTheDocument();
  });

  it('renders the first image with priority (loading="eager") for LCP', () => {
    const { container } = render(
      <GalleryGrid images={makeImages(3)} maxVisible={6} layout="grid" />,
    );

    const imgs = container.querySelectorAll('img');
    expect(imgs[0]).toHaveAttribute('loading', 'eager');
    expect(imgs[1]).toHaveAttribute('loading', 'lazy');
    expect(imgs[2]).toHaveAttribute('loading', 'lazy');
  });
});
