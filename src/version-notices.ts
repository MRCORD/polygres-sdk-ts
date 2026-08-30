import {
  SDK_NOTICE_ID_HEADER,
  SDK_NOTICE_RECOMMENDED_VERSION_HEADER,
  SDK_NOTICE_SEVERITY_HEADER,
  SDK_NOTICE_URL_HEADER,
} from './version';

const NOTICE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SEMVER_RE =
  /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})(?:-([0-9A-Za-z-]{1,16}(?:\.[0-9A-Za-z-]{1,16}){0,4}))?(?:\+[0-9A-Za-z-]{1,16}(?:\.[0-9A-Za-z-]{1,16}){0,4})?$/;
const SEVERITIES = new Set(['info', 'warning', 'critical']);
const MAX_URL_LENGTH = 2048;
const MAX_SEEN_NOTICES = 128;
const CENTRAL_NOTICE_URL = 'https://api.polygres.com/v1/sdk/notices';
const CENTRAL_NOTICE_TIMEOUT_MS = 2000;
const CENTRAL_NOTICE_REFRESH_MS = 10 * 60 * 60 * 1000;
const CENTRAL_NOTICE_RETRY_MS = 10 * 60 * 1000;

export interface PolygresVersionNotice {
  id: string;
  current_version: string;
  recommended_version: string;
  severity: 'info' | 'warning' | 'critical';
  url: string | null;
  deprecation_at: Date | null;
  sunset_at: Date | null;
  message: string;
}

const seenNoticeIds = new Set<string>();
let centralNoticeNextCheck = 0;
let centralNoticeEtag: string | null = null;
let centralNoticeInProgress = false;

export function parseVersionNotice(
  headers: Record<string, string>,
  currentVersion: string
): PolygresVersionNotice | null {
  const getHeader = (name: string) => {
    const target = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === target) return v;
    }
    return undefined;
  };

  const noticeId = getHeader(SDK_NOTICE_ID_HEADER);
  const recommended = getHeader(SDK_NOTICE_RECOMMENDED_VERSION_HEADER);
  const severity = getHeader(SDK_NOTICE_SEVERITY_HEADER) || 'info';

  if (!noticeId || !recommended) return null;
  if (!NOTICE_ID_RE.test(noticeId)) return null;
  if (!SEVERITIES.has(severity)) return null;

  const comparison = compareSemver(recommended, currentVersion);
  if (comparison === null || comparison <= 0) return null;

  const url = getHeader(SDK_NOTICE_URL_HEADER) || null;
  if (url !== null && !isSafeNoticeUrl(url)) return null;

  let message = `Polygres SDK ${recommended} is available; you are using ${currentVersion}.`;
  const sunsetHeader = getHeader('Sunset');
  const sunsetDate = sunsetHeader ? new Date(sunsetHeader) : null;
  if (sunsetDate && !Number.isNaN(sunsetDate.getTime())) {
    message += ` Support for this API resource is expected to end ${sunsetDate.toISOString().split('T')[0]}.`;
  }
  if (url) {
    message += ` See ${url}`;
  }

  const deprecationHeader = getHeader('Deprecation');
  const deprecationDate = deprecationHeader ? new Date(deprecationHeader) : null;

  return {
    id: noticeId,
    current_version: currentVersion,
    recommended_version: recommended,
    severity: severity as 'info' | 'warning' | 'critical',
    url,
    deprecation_at: deprecationDate && !Number.isNaN(deprecationDate.getTime()) ? deprecationDate : null,
    sunset_at: sunsetDate && !Number.isNaN(sunsetDate.getTime()) ? sunsetDate : null,
    message,
  };
}

export function emitVersionNotice(
  headers: Record<string, string>,
  currentVersion: string
): void {
  const notice = parseVersionNotice(headers, currentVersion);
  if (!notice) return;
  if (seenNoticeIds.has(notice.id)) return;
  if (seenNoticeIds.size >= MAX_SEEN_NOTICES) return;
  seenNoticeIds.add(notice.id);

  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[PolygresVersionWarning] ${notice.message}`);
  }
}

export function checkCentralVersionNotices(currentVersion: string): void {
  const now = Date.now();
  if (now < centralNoticeNextCheck || centralNoticeInProgress) {
    return;
  }
  centralNoticeInProgress = true;

  const headers: Record<string, string> = {
    'User-Agent': `polygres-ts/${currentVersion}`,
  };
  if (centralNoticeEtag) {
    headers['If-None-Match'] = centralNoticeEtag;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), CENTRAL_NOTICE_TIMEOUT_MS)
    : null;

  const url = `${CENTRAL_NOTICE_URL}?version=${encodeURIComponent(currentVersion)}&channel=${encodeURIComponent(releaseChannel(currentVersion))}`;

  fetch(url, {
    headers,
    signal: controller?.signal,
  })
    .then(async (res) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (res.status === 304) {
        centralNoticeNextCheck = Date.now() + CENTRAL_NOTICE_REFRESH_MS;
        return;
      }
      if (!res.ok) {
        centralNoticeNextCheck = Date.now() + CENTRAL_NOTICE_RETRY_MS;
        return;
      }
      const etag = res.headers.get('ETag');
      if (etag) centralNoticeEtag = etag;
      const data = await res.json();
      if (data && Array.isArray(data.notices)) {
        for (const item of data.notices.slice(0, MAX_SEEN_NOTICES)) {
          if (item && typeof item === 'object') {
            const h: Record<string, string> = {
              [SDK_NOTICE_ID_HEADER]: item.id,
              [SDK_NOTICE_RECOMMENDED_VERSION_HEADER]: item.recommended_version,
              [SDK_NOTICE_SEVERITY_HEADER]: item.severity || 'info',
            };
            if (item.url) h[SDK_NOTICE_URL_HEADER] = item.url;
            emitVersionNotice(h, currentVersion);
          }
        }
      }
      centralNoticeNextCheck = Date.now() + CENTRAL_NOTICE_REFRESH_MS;
    })
    .catch(() => {
      if (timeoutId) clearTimeout(timeoutId);
      centralNoticeNextCheck = Date.now() + CENTRAL_NOTICE_RETRY_MS;
    })
    .finally(() => {
      centralNoticeInProgress = false;
    });
}

function releaseChannel(version: string): string {
  const match = SEMVER_RE.exec(version);
  if (!match || !match[4]) return 'stable';
  const label = match[4].split('.')[0].toLowerCase();
  for (const ch of ['preview', 'alpha', 'beta', 'rc']) {
    if (label.startsWith(ch)) return ch;
  }
  return 'preview';
}

function parseSemver(value: string): [number, number, number, string[]] | null {
  const match = SEMVER_RE.exec(value);
  if (!match) return null;
  const pre = match[4] ? match[4].split('.') : [];
  return [Number(match[1]), Number(match[2]), Number(match[3]), pre];
}

export function compareSemver(left: string, right: string): number | null {
  const l = parseSemver(left);
  const r = parseSemver(right);
  if (!l || !r) return null;

  for (let i = 0; i < 3; i++) {
    if (l[i] !== r[i]) {
      return l[i] < r[i] ? -1 : 1;
    }
  }

  const lPre = l[3];
  const rPre = r[3];
  if (lPre.length === 0 && rPre.length === 0) return 0;
  if (lPre.length === 0) return 1;
  if (rPre.length === 0) return -1;

  const minLen = Math.min(lPre.length, rPre.length);
  for (let i = 0; i < minLen; i++) {
    const lp = lPre[i];
    const rp = rPre[i];
    if (lp === rp) continue;
    const lIsNum = /^\d+$/.test(lp);
    const rIsNum = /^\d+$/.test(rp);
    if (lIsNum && rIsNum) {
      return Number(lp) < Number(rp) ? -1 : 1;
    }
    if (lIsNum !== rIsNum) {
      return lIsNum ? -1 : 1;
    }
    return lp < rp ? -1 : 1;
  }
  return lPre.length < rPre.length ? -1 : (lPre.length > rPre.length ? 1 : 0);
}

function isSafeNoticeUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH) return false;
  if (!/^[\x00-\x7F]*$/.test(value)) return false;
  if (/[<>"\\']/.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && Boolean(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}
