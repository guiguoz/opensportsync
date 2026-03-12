import RNFS from 'react-native-fs';
import * as Keychain from 'react-native-keychain';

// ─── Configuration OAuth2 Livelox ─────────────────────────────────────────────
import { LIVELOX_CLIENT_ID } from '../config/secrets';

const LIVELOX_REDIRECT_URI = 'opensportsync://oauth/livelox';
const LIVELOX_AUTH_URL     = 'https://api.livelox.com/oauth2/authorize';
const LIVELOX_TOKEN_URL    = 'https://api.livelox.com/oauth2/token';
const LIVELOX_API_BASE     = 'https://api.livelox.com';

const KC_TOKEN   = 'opensportsync_livelox_token';
const KC_PKCE    = 'opensportsync_livelox_pkce';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenData {
  access_token:  string;
  refresh_token: string;
  expires_at:    number;  // timestamp ms
}

export interface LiveloxImportResult {
  viewerUrl: string;
}

// ─── Token storage ────────────────────────────────────────────────────────────

async function saveToken(data: TokenData): Promise<void> {
  await Keychain.setGenericPassword('livelox', JSON.stringify(data), { service: KC_TOKEN });
}

async function loadToken(): Promise<TokenData | null> {
  const creds = await Keychain.getGenericPassword({ service: KC_TOKEN });
  return creds ? JSON.parse(creds.password) : null;
}

export async function isAuthenticated(): Promise<boolean> {
  return (await loadToken()) !== null;
}

export async function logout(): Promise<void> {
  await Promise.all([
    Keychain.resetGenericPassword({ service: KC_TOKEN }),
    Keychain.resetGenericPassword({ service: KC_PKCE }),
  ]);
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let v = '';
  for (let i = 0; i < 64; i++) {
    v += chars[Math.floor(Math.random() * chars.length)];
  }
  return v;
}

// ─── PKCE S256 ────────────────────────────────────────────────────────────────

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── URL d'autorisation OAuth2 (PKCE S256) ────────────────────────────────────

/**
 * Génère l'URL d'autorisation Livelox et stocke le code_verifier PKCE (Keychain).
 * Ouvrir cette URL dans le navigateur système (Linking.openURL).
 * L'app recevra le callback via le deep link opensportsync://oauth/livelox?code=...
 */
export async function getAuthorizationUrl(): Promise<string> {
  const verifier  = generateVerifier();
  const challenge = await sha256Base64Url(verifier);
  await Keychain.setGenericPassword('pkce', verifier, { service: KC_PKCE });

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             LIVELOX_CLIENT_ID,
    redirect_uri:          LIVELOX_REDIRECT_URI,
    scope:                 'routes.import',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });
  return `${LIVELOX_AUTH_URL}?${params.toString()}`;
}

// ─── Échange du code contre un token ──────────────────────────────────────────

/**
 * Appelé par App.tsx quand le deep link opensportsync://oauth/livelox?code=... est reçu.
 */
export async function handleOAuthCallback(code: string): Promise<void> {
  const creds = await Keychain.getGenericPassword({ service: KC_PKCE });
  const verifier = creds ? creds.password : null;
  if (!verifier) throw new Error('PKCE verifier introuvable');

  const response = await fetch(LIVELOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  LIVELOX_REDIRECT_URI,
      client_id:     LIVELOX_CLIENT_ID,
      code_verifier: verifier,
    }).toString(),
  });

  await Keychain.resetGenericPassword({ service: KC_PKCE });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OAuth2 token exchange failed: HTTP ${response.status} — ${body}`);
  }

  const json = await response.json();
  await saveToken({
    access_token:  json.access_token,
    refresh_token: json.refresh_token,
    expires_at:    Date.now() + json.expires_in * 1000,
  });
}

// ─── Refresh automatique ──────────────────────────────────────────────────────

async function getValidToken(): Promise<string> {
  let token = await loadToken();
  if (!token) throw new Error('Non authentifié sur Livelox');

  if (Date.now() > token.expires_at - 60_000) {
    const response = await fetch(LIVELOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: token.refresh_token,
        client_id:     LIVELOX_CLIENT_ID,
      }).toString(),
    });
    if (!response.ok) {
      await logout();
      throw new Error('Session Livelox expirée, veuillez vous reconnecter');
    }
    const json = await response.json();
    token = {
      access_token:  json.access_token,
      refresh_token: json.refresh_token ?? token.refresh_token,
      expires_at:    Date.now() + json.expires_in * 1000,
    };
    await saveToken(token);
  }

  return token.access_token;
}

// ─── Import GPX via Route Integration API ─────────────────────────────────────

function generateId(): string {
  return `oss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Importe un fichier GPX vers Livelox via /importableRoutes.
 * Retourne l'URL du viewer Livelox une fois le traitement terminé.
 */
export async function uploadGpxToLivelox(gpxPath: string): Promise<LiveloxImportResult> {
  const accessToken = await getValidToken();
  const gpxContent  = await RNFS.readFile(gpxPath, 'base64');
  const importId    = generateId();

  // 1. Soumettre le GPX
  const postRes = await fetch(`${LIVELOX_API_BASE}/importableRoutes`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id:          importId,
      data:        gpxContent,
      deviceModel: 'Suunto Ambit',
    }),
  });

  if (!postRes.ok) {
    const body = await postRes.text();
    throw new Error(`Livelox import failed: HTTP ${postRes.status} — ${body}`);
  }

  // 2. Poller jusqu'à traitement (max 10× 2s = 20s)
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const getRes = await fetch(`${LIVELOX_API_BASE}/importableRoutes/${importId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!getRes.ok) continue;

    const status = await getRes.json();
    if (status.status === 'imported') {
      const viewerUrl = status.viewerUrl ?? `https://livelox.com/viewer?routeId=${importId}`;
      return { viewerUrl };
    }
    if (status.status === 'error') {
      throw new Error(`Livelox processing error: ${status.errorMessage ?? 'unknown'}`);
    }
    // status === 'pending' → continuer à poller
  }

  throw new Error('Livelox timeout: traitement non terminé après 20 secondes');
}
