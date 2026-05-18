import { GoogleStrategy, GoogleProfile } from './google.strategy';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(() => {
    process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
    process.env['GOOGLE_CLIENT_SECRET'] = 'test-client-secret';
    process.env['GOOGLE_CALLBACK_URL'] = 'http://localhost:3002/v1/auth/google/callback';
    strategy = new GoogleStrategy();
  });

  it('validate() resolves the Google profile with correct mapped fields', (done) => {
    const profile = {
      id: 'google-sub-123',
      displayName: 'João Silva',
      emails: [{ value: 'joao@lavacar.com.br' }],
    };

    strategy.validate('access-token', 'refresh-token', profile as never, (err, user) => {
      expect(err).toBeNull();
      expect(user).toEqual<GoogleProfile>({
        googleOAuthId: 'google-sub-123',
        email: 'joao@lavacar.com.br',
        name: 'João Silva',
      });
      done();
    });
  });

  it('validate() calls done with error when profile has no emails', (done) => {
    const profile = {
      id: 'google-sub-456',
      displayName: 'No Email User',
      emails: [],
    };

    strategy.validate('access-token', 'refresh-token', profile as never, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('validate() calls done with error when emails array is absent', (done) => {
    const profile = {
      id: 'google-sub-789',
      displayName: 'No Emails Field',
    };

    strategy.validate('access-token', 'refresh-token', profile as never, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });
});
