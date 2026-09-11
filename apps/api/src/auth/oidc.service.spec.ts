import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OidcService } from './oidc.service';

describe('OidcService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects SSO flow creation when OIDC is disabled', async () => {
    const config = new ConfigService({ OIDC_ENABLED: 'false' });
    const service = new OidcService(config);

    await expect(service.createAuthorizationRequest()).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates an authorization-code request with PKCE, state, and nonce', async () => {
    const config = new ConfigService({
      OIDC_ENABLED: 'true',
      OIDC_ISSUER_URL: 'https://identity.example.com',
      OIDC_CLIENT_ID: 'expenseflow-client',
      OIDC_REDIRECT_URI: 'http://localhost:4000/api/auth/sso/callback',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-flow-signing',
    });
    const service = new OidcService(config);

    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          issuer: 'https://identity.example.com',
          authorization_endpoint: 'https://identity.example.com/authorize',
          token_endpoint: 'https://identity.example.com/token',
          jwks_uri: 'https://identity.example.com/.well-known/jwks.json',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await service.createAuthorizationRequest();
    const url = new URL(result.authorizationUrl);

    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('expenseflow-client');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(result.flowCookie.split('.')).toHaveLength(2);
  });
});
