export type GithubRelease = {
  id: number;
  tag_name: string;
  html_url: string;
  published_at: string | null;
};

export class GithubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = 'GithubApiError';
  }
}

export type GithubFetch = typeof fetch;

export const parseRepository = (value: unknown): { owner: string; repo: string } => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('The configured GitHub repository field is empty');
  }

  const trimmed = value.trim();
  let parts: string[];
  if (trimmed.includes('://')) {
    const url = new URL(trimmed);
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
      throw new Error('The repository URL must point to github.com');
    }
    parts = url.pathname.split('/').filter(Boolean);
  } else {
    parts = trimmed.split('/').filter(Boolean);
  }

  if (parts.length !== 2) {
    throw new Error('The GitHub repository must be in owner/repo form');
  }

  const [owner, rawRepo] = parts;
  const repo = rawRepo?.replace(/\.git$/, '');
  if (!owner || !repo || owner.includes(' ') || repo.includes(' ')) {
    throw new Error('The GitHub repository contains an invalid owner or repository name');
  }
  return { owner, repo };
};

export const fetchLatestRelease = async (
  repository: { owner: string; repo: string },
  options: { token?: string; fetchImpl?: GithubFetch } = {}
): Promise<GithubRelease> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/releases/latest`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'arch-register-external-entity-field-example',
        'x-github-api-version': '2026-03-10',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
      }
    }
  );

  if (!response.ok) {
    throw new GithubApiError(
      `GitHub returned HTTP ${response.status} for ${repository.owner}/${repository.repo}`,
      response.status,
      response.status === 408 || response.status === 429 || response.status >= 500
    );
  }

  const body: unknown = await response.json();
  const releaseBody =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  if (
    releaseBody === null ||
    typeof releaseBody['id'] !== 'number' ||
    typeof releaseBody['tag_name'] !== 'string' ||
    typeof releaseBody['html_url'] !== 'string' ||
    (releaseBody['published_at'] !== null && typeof releaseBody['published_at'] !== 'string')
  ) {
    throw new GithubApiError(
      'GitHub returned an unexpected latest release response',
      response.status,
      false
    );
  }

  return {
    id: releaseBody['id'],
    tag_name: releaseBody['tag_name'],
    html_url: releaseBody['html_url'],
    published_at: releaseBody['published_at']
  };
};
