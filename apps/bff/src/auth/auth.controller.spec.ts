import { AuthController } from './auth.controller';
import { GoogleProfile } from './strategies/google.strategy';
import { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController();
  });

  describe('handleGoogleCallback()', () => {
    it('returns the Google profile from req.user', () => {
      const profile: GoogleProfile = {
        googleOAuthId: 'google-sub-123',
        email: 'joao@lavacar.com.br',
        name: 'João Silva',
      };
      const req = { user: profile } as unknown as Request;

      const result = controller.handleGoogleCallback(req);

      expect(result).toEqual(profile);
    });
  });
});
