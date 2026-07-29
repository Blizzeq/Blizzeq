// Live data for the profile assets.
//
// Everything the README shows about activity comes from here. The result is
// cached to data/github-cache.json and committed, so a build still produces
// correct-looking assets if the API is unreachable — the point of this rewrite
// was to stop depending on a service that can go down.

const USER = 'Blizzeq';
const API = 'https://api.github.com';

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
}

async function api(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'blizzeq-profile-build',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

async function graphql(query) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'blizzeq-profile-build',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`graphql → ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`graphql: ${json.errors[0].message}`);
  return json.data;
}

const CONTRIB_QUERY = `{
  user(login: "${USER}") {
    createdAt
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      contributionCalendar { totalContributions }
      commitContributionsByRepository(maxRepositories: 100) { repository { name isPrivate } }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
    }
  }
}`;

/**
 * Collect everything the cards need.
 * @param {string[]} repos repo names that get their own project card
 */
export async function fetchAll(repos) {
  const [contrib, langEntries] = await Promise.all([
    graphql(CONTRIB_QUERY),
    Promise.all(
      repos.map(async (name) => {
        try {
          return [name, await api(`/repos/${USER}/${name}/languages`)];
        } catch {
          return [name, {}];
        }
      })
    ),
  ]);

  const u = contrib.user;
  const cc = u.contributionsCollection;

  // Aggregate language bytes across the featured repos. This is a more honest
  // picture than a top-langs widget over every scratch repo on the account.
  const totals = {};
  for (const [, langs] of langEntries) {
    for (const [lang, bytes] of Object.entries(langs)) {
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }

  return {
    createdAt: u.createdAt,
    publicRepos: u.repositories.totalCount,
    contributions: cc.contributionCalendar.totalContributions,
    publicCommits: cc.totalCommitContributions,
    privateContributions: cc.restrictedContributionsCount,
    // Public repositories only, deliberately.
    //
    // This field returns whatever the token can see, so a personal token
    // counted 70 and the Actions token counted 19 — the same card showing a
    // different number depending on who ran the build. Counting public repos
    // makes it the same figure either way, and it is the honest one to publish
    // next to a public profile.
    activeRepos: cc.commitContributionsByRepository.filter((r) => !r.repository.isPrivate).length,
    languagesByRepo: Object.fromEntries(langEntries),
    languageTotals: totals,
  };
}

/** Years (one decimal) between `iso` and now — used for "on GitHub since". */
export function yearsSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor((ms / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
}

/** Compact display form: 4878 → "4.9k". */
export function compact(v) {
  if (v >= 1000) {
    const k = v / 1000;
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
  }
  return String(v);
}
