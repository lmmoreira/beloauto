// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GalleryGrid } from './GalleryGrid';

function items(count: number) {
  return Array.from({ length: count }, (_, i) => <div key={i} data-testid={`item-${i}`} />);
}

describe('GalleryGrid', () => {
  it('renders a grid layout container for layout: grid', () => {
    const { container } = render(
      <GalleryGrid maxVisible={6} layout="grid">
        {items(3)}
      </GalleryGrid>,
    );

    expect(container.firstElementChild?.className).toContain('grid');
  });

  it('renders a CSS-columns container for layout: masonry', () => {
    const { container } = render(
      <GalleryGrid maxVisible={6} layout="masonry">
        {items(3)}
      </GalleryGrid>,
    );

    expect(container.firstElementChild?.className).toContain('columns-2');
  });

  it('renders only maxVisible children and a "Ver mais" button when there are more', () => {
    render(
      <GalleryGrid maxVisible={2} layout="grid">
        {items(5)}
      </GalleryGrid>,
    );

    expect(screen.getByTestId('item-0')).toBeInTheDocument();
    expect(screen.getByTestId('item-1')).toBeInTheDocument();
    expect(screen.queryByTestId('item-2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver mais' })).toBeInTheDocument();
  });

  it('does not render "Ver mais" when children.length <= maxVisible', () => {
    render(
      <GalleryGrid maxVisible={6} layout="grid">
        {items(3)}
      </GalleryGrid>,
    );

    expect(screen.queryByRole('button', { name: 'Ver mais' })).not.toBeInTheDocument();
  });

  it('reveals all children and hides the button after clicking "Ver mais"', async () => {
    const user = userEvent.setup();
    render(
      <GalleryGrid maxVisible={2} layout="grid">
        {items(5)}
      </GalleryGrid>,
    );

    await user.click(screen.getByRole('button', { name: 'Ver mais' }));

    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`item-${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Ver mais' })).not.toBeInTheDocument();
  });
});
