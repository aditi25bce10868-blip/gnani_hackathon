// One way to call the BharatConnect server (the Cloudflare Worker): auth header,
// timeout, and plain-language errors. Translate, listen and speak all use it.

export interface ServerConfig {
  readonly baseUrl: string;
  readonly appToken: string;
  readonly timeoutMs?: number;
}

/** Why a server call failed — lets callers pick a notice without parsing text. */
export type ServerErrorKind = 'network' | 'timeout' | 'rate_limited' | 'credits' | 'auth' | 'audio' | 'other';

/** An error whose message is fit to show a person as-is. */
export class ServerError extends Error {
  constructor(
    message: string,
    readonly kind: ServerErrorKind = 'other',
  ) {
    super(message);
  }
}

/** The server has no engine for this language — callers fall back. */
export class UnsupportedLanguageError extends ServerError {}

const DEFAULT_TIMEOUT_MS = 20_000;

export async function postJson(
  cfg: ServerConfig,
  path: string,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(`${cfg.baseUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-token': cfg.appToken },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch (e) {
    const aborted = typeof e === 'object' && e !== null && 'name' in e && e.name === 'AbortError';
    throw new ServerError(
      aborted ? 'That took too long. Try again.' : "Couldn't reach the server. Check your connection.",
      aborted ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.ok) {
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      throw new ServerError('The server sent back an unreadable answer. Try again.');
    }
  }

  let code = '';
  try {
    code = String(((await res.json()) as { error?: unknown }).error ?? '');
  } catch {
    // body was not JSON; the status alone decides.
  }
  if (res.status === 401) throw new ServerError('The server did not accept this app (check the app token).', 'auth');
  if (res.status === 402) throw new ServerError('Speech credits are used up for now.', 'credits');
  if (res.status === 429) throw new ServerError('Too many requests right now. Wait a minute and try again.', 'rate_limited');
  if (res.status === 400 && code === 'unsupported_language') throw new UnsupportedLanguageError('Language not supported by the server.');
  if (res.status === 400 && (code === 'bad_audio' || code === 'too_long')) {
    throw new ServerError("That recording couldn't be read. Try a shorter one.", 'audio');
  }
  throw new ServerError('The server had a problem. Try again.');
}
