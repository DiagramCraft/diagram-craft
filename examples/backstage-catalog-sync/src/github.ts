export interface GitHubRepo {
  name: string;
  fullName: string;
  defaultBranch: string;
  url: string;
  isPrivate: boolean;
}

export interface GitHubError extends Error {
  status?: number;
  response?: {
    status: number;
    data?: unknown;
  };
}

/**
 * Lists all repositories in a GitHub organization
 */
export const listRepos = async (org: string, token?: string): Promise<GitHubRepo[]> => {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `https://api.github.com/orgs/${org}/repos?per_page=${perPage}&page=${page}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'backstage-catalog-sync'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetchWithRetry(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Organization '${org}' not found or not accessible`);
      }
      if (response.status === 401) {
        throw new Error('GitHub authentication failed. Check your GITHUB_TOKEN.');
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Array<{
      name: string;
      full_name: string;
      default_branch: string;
      html_url: string;
      private: boolean;
    }>;

    if (data.length === 0) {
      break;
    }

    for (const repo of data) {
      repos.push({
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
        isPrivate: repo.private
      });
    }

    // Check if there are more pages
    const linkHeader = response.headers.get('Link');
    if (!linkHeader || !linkHeader.includes('rel="next"')) {
      break;
    }

    page++;
  }

  return repos;
};

/**
 * Fetches catalog-info.yaml content from a repository's default branch
 * Returns null if the file doesn't exist
 */
export const fetchCatalogInfo = async (
  repo: GitHubRepo,
  token?: string
): Promise<string | null> => {
  const url = `https://api.github.com/repos/${repo.fullName}/contents/catalog-info.yaml?ref=${repo.defaultBranch}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'backstage-catalog-sync'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetchWithRetry(url, { headers });

  if (response.status === 404) {
    // File doesn't exist - this is expected for many repos
    return null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(`Authentication failed for ${repo.fullName}. Check your GITHUB_TOKEN.`);
    }
    throw new Error(
      `Failed to fetch catalog-info.yaml from ${repo.fullName}: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    content?: string;
    encoding?: string;
    type?: string;
  };

  if (data.type !== 'file' || !data.content || data.encoding !== 'base64') {
    throw new Error(`Unexpected response format for catalog-info.yaml in ${repo.fullName}`);
  }

  // Decode base64 content
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return content;
};

/**
 * Fetches a URL with retry logic for rate limiting and transient errors
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');

        if (rateLimitRemaining === '0' && rateLimitReset) {
          const resetTime = Number.parseInt(rateLimitReset, 10) * 1000;
          const waitTime = Math.max(0, resetTime - Date.now()) + 1000; // Add 1 second buffer

          console.warn(
            `GitHub rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds...`
          );
          await sleep(waitTime);
          continue;
        }
      }

      // Handle server errors with exponential backoff
      if (response.status >= 500 && attempt < maxRetries - 1) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(
          `GitHub API error ${response.status}. Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(backoffTime);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Network errors - retry with exponential backoff
      if (attempt < maxRetries - 1) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(
          `Network error: ${lastError.message}. Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(backoffTime);
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
};

const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
