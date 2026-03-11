import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

// ─── Configuration OAuth2 Livelox ─────────────────────────────────────────────
// Créer une app sur https://api.livelox.com/developer
// et renseigner les valeurs ci-dessous.
const LIVELOX_CLIENT_ID     = 'VOTRE_CLIENT_ID';
const LIVELOX_CLIENT_SECRET = 'VOTRE_CLIENT_SECRET';
const LIVELOX_REDIRECT_URI  = 'ambitsyncmodern://oauth/livelox';

const LIVELOX_AUTH_URL  = 'https://api.livelox.com/auth/oauth2/authorize';
const LIVELOX_TOKEN_URL = 'https://api.livelox.com/auth/oauth2/token';
const LIVELOX_API_BASE  = 'https://api.livelox.com/api/v1';

const STORAGE_KEY = 'livelox_token';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;  // timestamp ms
}

// ─── Token storage ────────────────────────────────────────────────────────────

async function saveToken(data: TokenData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function loadToken(): Promise<TokenData | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await loadToken();
  return token !== null;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ─── URL d'autorisation OAuth2 ────────────────────────────────────────────────

/**
 * Retourne l'URL à ouvrir dans un WebView pour démarrer le flow OAuth2.
 * L'app doit détecter la redirection vers LIVELOX_REDIRECT_URI
 * et appeler handleOAuthCallback() avec le code extrait.
 */
export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LIVELOX_CLIENT_ID,
    redirect_uri: LIVELOX_REDIRECT_URI,
    scope: 'events:write',
  });
  return `${LIVELOX_AUTH_URL}?${params.toString()}`;
}

/**
 * Échange le code d'autorisation contre un token d'accès.
 * À appeler quand le WebView redirige vers LIVELOX_REDIRECT_URI?code=...
 */
export async function handleOAuthCallback(code: string): Promise<void> {
  const response = await fetch(LIVELOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: LIVELOX_REDIRECT_URI,
      client_id: LIVELOX_CLIENT_ID,
      client_secret: LIVELOX_CLIENT_SECRET,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`OAuth2 token exchange failed: HTTP ${response.status}`);
  }

  const json = await response.json();
  await saveToken({
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  });
}

// ─── Refresh automatique ──────────────────────────────────────────────────────

async function getValidToken(): Promise<string> {
  let token = await loadToken();
  if (!token) throw new Error('Non authentifié sur Livelox');

  // Rafraîchir si expiré (avec 60s de marge)
  if (Date.now() > token.expires_at - 60_000) {
    const response = await fetch(LIVELOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: LIVELOX_CLIENT_ID,
        client_secret: LIVELOX_CLIENT_SECRET,
      }).toString(),
    });
    if (!response.ok) {
      await logout();
      throw new Error('Session Livelox expirée, veuillez vous reconnecter');
    }
    const json = await response.json();
    token = {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? token.refresh_token,
      expires_at: Date.now() + json.expires_in * 1000,
    };
    await saveToken(token);
  }

  return token.access_token;
}

// ─── Upload GPX ───────────────────────────────────────────────────────────────

export interface LiveloxUploadResult {
  eventId: string;
  eventUrl: string;
}

/**
 * Upload un fichier GPX vers Livelox.
 * @param gpxPath   Chemin local du fichier GPX
 * @param eventName Nom de l'événement (ex: "Entraînement forêt de Marly")
 */
export async function uploadGpxToLivelox(
  gpxPath: string,
  eventName: string
): Promise<LiveloxUploadResult> {
  const accessToken = await getValidToken();
  const gpxContent = await RNFS.readFile(gpxPath, 'utf8');

  // 1. Créer l'événement
  const createRes = await fetch(`${LIVELOX_API_BASE}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: eventName }),
  });

  if (!createRes.ok) {
    throw new Error(`Livelox createEvent failed: HTTP ${createRes.status}`);
  }

  const { id: eventId } = await createRes.json();

  // 2. Uploader le GPX comme résultat
  const uploadRes = await fetch(`${LIVELOX_API_BASE}/events/${eventId}/results`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/gpx+xml',
    },
    body: gpxContent,
  });

  if (!uploadRes.ok) {
    throw new Error(`Livelox uploadResult failed: HTTP ${uploadRes.status}`);
  }

  return {
    eventId,
    eventUrl: `https://livelox.com/events/${eventId}`,
  };
}
