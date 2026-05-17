const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const MAX_TEXT_LENGTH = 3800;

const hits = new Map();

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/telegram/send') {
      return json({ ok: false, error: 'Not found' }, 404);
    }

    if (!env.TELEGRAM_BOT_TOKEN) {
      return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }, 500);
    }

    if (env.CLIENT_SECRET) {
      const provided = request.headers.get('X-Client-Secret') || '';
      if (provided !== env.CLIENT_SECRET) {
        return json({ ok: false, error: 'Unauthorized' }, 401);
      }
    }

    const key = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Client-Secret') || 'anonymous';
    if (!allowRequest(key)) {
      return json({ ok: false, error: 'Rate limit exceeded' }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const chatId = String(payload.chatId || env.TELEGRAM_CHAT_ID || '').trim();
    const text = String(payload.text || '').trim().slice(0, MAX_TEXT_LENGTH);

    if (!chatId) {
      return json({ ok: false, error: 'chatId or TELEGRAM_CHAT_ID is required' }, 400);
    }
    if (!text) {
      return json({ ok: false, error: 'text is required' }, 400);
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    const telegramBody = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok || telegramBody.ok === false) {
      return json({
        ok: false,
        error: telegramBody.description || `Telegram API error ${telegramResponse.status}`,
      }, 502);
    }

    return json({ ok: true, result: telegramBody.result });
  },
};

function allowRequest(key) {
  const now = Date.now();
  const entry = hits.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  hits.set(key, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

function json(body, status = 200) {
  return corsResponse(JSON.stringify(body), status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
}

function corsResponse(body, status, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      ...headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Client-Secret',
    },
  });
}
