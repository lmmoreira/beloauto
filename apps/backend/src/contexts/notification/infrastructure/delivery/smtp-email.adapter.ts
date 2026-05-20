import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppLogger } from '../../../../shared/observability/app-logger';
import {
  DeliveryChannelType,
  IDeliveryChannel,
} from '../../application/ports/delivery-channel.port';
import { OutboundMessage } from '../../application/ports/notification-dispatcher.port';

@Injectable()
export class SmtpEmailAdapter implements IDeliveryChannel {
  readonly channelType: DeliveryChannelType = 'EMAIL';

  private readonly logger = new AppLogger(SmtpEmailAdapter.name);

  private readonly transporter = nodemailer.createTransport({
    host: process.env['SMTP_HOST'] ?? 'localhost',
    port: Number(process.env['SMTP_PORT'] ?? 1025),
    secure: false,
    ignoreTLS: true,
  });

  async send(message: OutboundMessage): Promise<void> {
    const html = this.render(message);

    await this.transporter.sendMail({
      from: process.env['SMTP_FROM'] ?? 'noreply@beloauto.com.br',
      to: message.to,
      subject: message.subject,
      html,
    });

    this.logger.log('Email sent', {
      tenantId: message.tenantId,
      to: message.to,
      templateKey: message.templateKey,
    });
  }

  private render(message: OutboundMessage): string {
    if (message.templateKey === 'staff-invitation') {
      const { tenantName, activationLink, staffName } = message.data as {
        tenantName: string;
        activationLink: string;
        staffName: string;
      };
      return `
        <p>Olá, ${staffName}!</p>
        <p>Você foi convidado para integrar a equipe de <strong>${tenantName}</strong> na plataforma BeloAuto.</p>
        <p><a href="${activationLink}">Clique aqui para aceitar o convite e acessar sua conta.</a></p>
        <p>Se você não esperava este convite, por favor ignore este e-mail.</p>
      `;
    }
    return `<p>${message.subject}</p>`;
  }
}
