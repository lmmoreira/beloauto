// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ContactModuleData, HotsiteBusinessInfoResponse } from '@beloauto/types';
import { ContactModule } from './ContactModule';

function makeBusiness(
  overrides?: Partial<HotsiteBusinessInfoResponse>,
): HotsiteBusinessInfoResponse {
  return {
    phone: '11987654321',
    email: 'contato@beloauto.com.br',
    address: {
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310100',
    },
    ...overrides,
  };
}

function makeData(overrides?: Partial<ContactModuleData>): ContactModuleData {
  return {
    showAddress: true,
    showPhone: true,
    showWhatsapp: true,
    showEmail: true,
    showMap: true,
    socialLinks: { whatsapp: '11987654321' },
    ...overrides,
  };
}

describe('ContactModule', () => {
  it('renders the default title when none is provided', () => {
    render(<ContactModule data={makeData()} business={makeBusiness()} slug="tenant" />);

    expect(screen.getByRole('heading', { name: 'Fale conosco' })).toBeInTheDocument();
  });

  it('renders a custom title when provided', () => {
    render(
      <ContactModule
        data={makeData({ title: 'Contato' })}
        business={makeBusiness()}
        slug="tenant"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Contato' })).toBeInTheDocument();
  });

  it('renders no <iframe> when showMap is false', () => {
    const { container } = render(
      <ContactModule data={makeData({ showMap: false })} business={makeBusiness()} slug="tenant" />,
    );

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('renders no <iframe> when showMap is true but business.address is null', () => {
    const { container } = render(
      <ContactModule
        data={makeData({ showMap: true })}
        business={makeBusiness({ address: null })}
        slug="tenant"
      />,
    );

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('renders no WhatsApp link when showWhatsapp is false', () => {
    render(
      <ContactModule
        data={makeData({ showWhatsapp: false })}
        business={makeBusiness()}
        slug="tenant"
      />,
    );

    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
  });

  it('renders the WhatsApp link to wa.me with the digits-only number, opening in a new tab', () => {
    render(
      <ContactModule
        data={makeData({ socialLinks: { whatsapp: '(11) 98765-4321' } })}
        business={makeBusiness()}
        slug="tenant"
      />,
    );

    const link = screen.getByRole('link', { name: 'WhatsApp' });
    expect(link).toHaveAttribute('href', 'https://wa.me/11987654321');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders no address block when showAddress is false', () => {
    render(
      <ContactModule
        data={makeData({ showAddress: false })}
        business={makeBusiness()}
        slug="tenant"
      />,
    );

    expect(screen.queryByText(/Av\. Paulista/)).not.toBeInTheDocument();
  });

  it('renders no address block when showAddress is true but business.address is null', () => {
    render(
      <ContactModule
        data={makeData({ showAddress: true })}
        business={makeBusiness({ address: null })}
        slug="tenant"
      />,
    );

    expect(screen.queryByText(/Av\. Paulista/)).not.toBeInTheDocument();
  });

  it('renders no phone when showPhone is true but business.phone is null', () => {
    render(
      <ContactModule
        data={makeData({ showPhone: true })}
        business={makeBusiness({ phone: null })}
        slug="tenant"
      />,
    );

    expect(screen.queryByText('11987654321')).not.toBeInTheDocument();
  });

  it('renders no email when showEmail is true but business.email is null', () => {
    render(
      <ContactModule
        data={makeData({ showEmail: true })}
        business={makeBusiness({ email: null })}
        slug="tenant"
      />,
    );

    expect(screen.queryByText('contato@beloauto.com.br')).not.toBeInTheDocument();
  });

  it('renders Instagram and Facebook links when present in socialLinks', () => {
    render(
      <ContactModule
        data={makeData({
          socialLinks: {
            instagram: 'https://instagram.com/beloauto',
            facebook: 'https://facebook.com/beloauto',
          },
        })}
        business={makeBusiness()}
        slug="tenant"
      />,
    );

    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/beloauto',
    );
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
      'href',
      'https://facebook.com/beloauto',
    );
  });
});
