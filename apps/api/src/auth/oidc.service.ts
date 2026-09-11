import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify,
} from 'node:crypto';

type OidcDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

type OidcState = {
  state: string;
  nonce: string;
  verifier: string;
  expiresAt: number;
};

type IdTokenHeader = {
  alg?: string;
  kid?: string;
};

type IdTokenClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
};

type JsonWebKeyWithKid = {
  [key: string]: string | undefined;
  kid?: string;
  alg?: string;
  use?: string;
  kty?: string;
  n?: string;
  e?: string;
};

@Injectable()
export class OidcService {
  constructor(private readonly config: ConfigService) {}

  enabled() {
    return this.config.get<string>('OIDC_ENABLED', 'false').toLowerCase() === 'true';
  }

  async createAuthorizationRequest() {
    this.assertEnabled();
    const discovery = await this.discovery();
    const state = randomBytes(24).toString('base64url');
    const nonce = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const redirectUri = this.redirectUri();

    const authorizationUrl = new URL(discovery.authorization_endpoint);
    authorizationUrl.searchParams.set('client_id', this.clientId());
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid email profile');
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('nonce', nonce);
    authorizationUrl.searchParams.set('code_challenge', challenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');

    // The verifier and nonce stay server-protected in a signed HttpOnly cookie instead
    // of being exposed to application JavaScript during the provider round trip.
    const flowCookie = this.signFlowState({
      state,
      nonce,
      verifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return { authorizationUrl: authorizationUrl.toString(), flowCookie };
  }

  async exchangeCallback(code: string, returnedState: string, flowCookie: string) {
    this.assertEnabled();
    const flow = this.verifyFlowState(flowCookie);

    if (flow.state !== returnedState) {
      throw new UnauthorizedException('SSO state validation failed');
    }

    const discovery = await this.discovery();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      code_verifier: flow.verifier,
    });
    const clientSecret = this.config.get<string>('OIDC_CLIENT_SECRET');
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      throw new UnauthorizedException('SSO authorization code exchange failed');
    }

    const tokenResponse = (await response.json()) as { id_token?: string };
    if (!tokenResponse.id_token) {
      throw new UnauthorizedException('Identity provider did not return an ID token');
    }

    return this.verifyIdToken(tokenResponse.id_token, discovery, flow.nonce);
  }

  private async verifyIdToken(token: string, discovery: OidcDiscovery, nonce: string) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid ID token');
    }

    const header = this.decodeJson<IdTokenHeader>(parts[0]);
    const claims = this.decodeJson<IdTokenClaims>(parts[1]);

    // Keeping the accepted algorithm explicit prevents algorithm-confusion and
    // downgrade behavior. RS256 is broadly supported by enterprise OIDC providers.
    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException('Unsupported ID token signing algorithm');
    }

    const jwksResponse = await fetch(discovery.jwks_uri);
    if (!jwksResponse.ok) {
      throw new ServiceUnavailableException('Unable to load identity provider signing keys');
    }
    const jwks = (await jwksResponse.json()) as { keys?: JsonWebKeyWithKid[] };
    const key = jwks.keys?.find((candidate) => candidate.kid === header.kid);
    if (!key) {
      throw new UnauthorizedException('ID token signing key was not found');
    }

    const publicKey = createPublicKey({ key, format: 'jwk' });
    const signatureValid = verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      publicKey,
      Buffer.from(parts[2], 'base64url'),
    );
    if (!signatureValid) {
      throw new UnauthorizedException('ID token signature is invalid');
    }

    const issuer = this.issuer();
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== issuer || !audience.includes(this.clientId())) {
      throw new UnauthorizedException('ID token issuer or audience is invalid');
    }
    if (!claims.exp || claims.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('ID token has expired');
    }
    if (claims.nonce !== nonce) {
      throw new UnauthorizedException('ID token nonce validation failed');
    }
    if (!claims.email || claims.email_verified === false) {
      throw new UnauthorizedException('A verified email address is required for SSO');
    }

    return { email: claims.email.toLowerCase() };
  }

  private signFlowState(state: OidcState) {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const signature = createHmac('sha256', this.flowSecret()).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyFlowState(cookie: string) {
    const [payload, signature] = cookie.split('.');
    if (!payload || !signature) {
      throw new BadRequestException('SSO flow cookie is invalid');
    }

    const expected = createHmac('sha256', this.flowSecret()).update(payload).digest('base64url');
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('SSO flow cookie signature is invalid');
    }

    const state = this.decodeJson<OidcState>(payload);
    if (state.expiresAt <= Date.now()) {
      throw new UnauthorizedException('SSO login request has expired');
    }
    return state;
  }

  private async discovery(): Promise<OidcDiscovery> {
    const url = `${this.issuer().replace(/\/$/, '')}/.well-known/openid-configuration`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new ServiceUnavailableException('Unable to load OIDC provider configuration');
    }
    const discovery = (await response.json()) as OidcDiscovery;
    if (
      discovery.issuer !== this.issuer() ||
      !discovery.authorization_endpoint ||
      !discovery.token_endpoint ||
      !discovery.jwks_uri
    ) {
      throw new ServiceUnavailableException('OIDC provider configuration is incomplete');
    }
    return discovery;
  }

  private decodeJson<T>(value: string) {
    try {
      return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('Invalid encoded OIDC data');
    }
  }

  private assertEnabled() {
    if (!this.enabled()) {
      throw new BadRequestException('SSO is not enabled');
    }
  }

  private issuer() {
    return this.config.getOrThrow<string>('OIDC_ISSUER_URL').replace(/\/$/, '');
  }

  private clientId() {
    return this.config.getOrThrow<string>('OIDC_CLIENT_ID');
  }

  private redirectUri() {
    return this.config.get<string>(
      'OIDC_REDIRECT_URI',
      'http://localhost:4000/api/auth/sso/callback',
    );
  }

  private flowSecret() {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }
}
