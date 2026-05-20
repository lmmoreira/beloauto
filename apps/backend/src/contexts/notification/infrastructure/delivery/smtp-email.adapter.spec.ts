import * as nodemailer from 'nodemailer';
import { SmtpEmailAdapter } from './smtp-email.adapter';
import { OutboundMessage } from '../../application/ports/notification-dispatcher.port';

jest.mock('nodemailer');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
(nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });

const message: OutboundMessage = {
  tenantId: 'aaaaaaaa-0000-4000-8000-000000000001',
  to: 'maria@lavacar.com.br',
  subject: 'Você foi convidado para a equipe Lava Car',
  templateKey: 'staff-invitation',
  data: {
    staffName: 'Maria',
    tenantName: 'Lava Car',
    activationLink: 'http://localhost:3000/lavacar/auth/staff',
  },
};

describe('SmtpEmailAdapter', () => {
  let adapter: SmtpEmailAdapter;

  beforeEach(() => {
    mockSendMail.mockClear();
    adapter = new SmtpEmailAdapter();
  });

  it('has channelType EMAIL', () => {
    expect(adapter.channelType).toBe('EMAIL');
  });

  it('calls sendMail with correct to, subject, and html body', async () => {
    await adapter.send(message);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0] as { to: string; subject: string; html: string };
    expect(call.to).toBe('maria@lavacar.com.br');
    expect(call.subject).toBe('Você foi convidado para a equipe Lava Car');
    expect(call.html).toContain('Lava Car');
    expect(call.html).toContain('http://localhost:3000/lavacar/auth/staff');
  });

  it('includes staff name in the rendered email body', async () => {
    await adapter.send(message);

    const call = mockSendMail.mock.calls[0][0] as { html: string };
    expect(call.html).toContain('Maria');
  });
});
