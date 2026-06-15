// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAttachmentSignedUrl } from '@/lib/api/bookings';
import { PhotoUpload } from './PhotoUpload';

vi.mock('@/lib/api/bookings', () => ({
  createAttachmentSignedUrl: vi.fn(),
}));

function makeFile(name: string, type: string): File {
  return new File(['fake-image-content'], name, { type });
}

describe('PhotoUpload', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.mocked(createAttachmentSignedUrl).mockReset();
  });

  it('renders the file input with a pt-BR label', () => {
    render(<PhotoUpload slug="lavacar-beloauto" value={[]} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Fotos do veículo (opcional)')).toBeInTheDocument();
  });

  it('uploads a selected photo and calls onChange with the resulting filePath', async () => {
    const user = userEvent.setup();
    vi.mocked(createAttachmentSignedUrl).mockResolvedValue({
      signedUrl: 'https://storage.example.com/upload?sig=abc',
      filePath: 'tenants/tenant-1/uploads/photo.jpg',
      expiresAt: '2026-06-15T12:00:00.000Z',
    });
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    const onChange = vi.fn();

    render(<PhotoUpload slug="lavacar-beloauto" value={[]} onChange={onChange} />);

    await user.upload(
      screen.getByLabelText('Fotos do veículo (opcional)'),
      makeFile('photo.jpg', 'image/jpeg'),
    );

    expect(await screen.findByText('Enviada')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(['tenants/tenant-1/uploads/photo.jpg']);
    expect(fetchSpy).toHaveBeenCalledWith('https://storage.example.com/upload?sig=abc', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: expect.any(File),
    });
  });

  it('shows an error status when the PUT upload fails', async () => {
    const user = userEvent.setup();
    vi.mocked(createAttachmentSignedUrl).mockResolvedValue({
      signedUrl: 'https://storage.example.com/upload?sig=abc',
      filePath: 'tenants/tenant-1/uploads/photo.jpg',
      expiresAt: '2026-06-15T12:00:00.000Z',
    });
    fetchSpy.mockResolvedValue(new Response(null, { status: 500 }));

    render(<PhotoUpload slug="lavacar-beloauto" value={[]} onChange={vi.fn()} />);

    await user.upload(
      screen.getByLabelText('Fotos do veículo (opcional)'),
      makeFile('photo.jpg', 'image/jpeg'),
    );

    expect(await screen.findByText('Erro ao enviar')).toBeInTheDocument();
  });

  it('shows an error status for unsupported file types without requesting a signed URL', async () => {
    const user = userEvent.setup();
    render(<PhotoUpload slug="lavacar-beloauto" value={[]} onChange={vi.fn()} />);

    await user.upload(
      screen.getByLabelText('Fotos do veículo (opcional)'),
      makeFile('photo.gif', 'image/gif'),
    );

    expect(await screen.findByText('Erro ao enviar')).toBeInTheDocument();
    expect(createAttachmentSignedUrl).not.toHaveBeenCalled();
  });
});
