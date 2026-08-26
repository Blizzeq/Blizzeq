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

/** Collect the activity summary shown on the profile. */
export async function fetchAll() {
  const contrib = await graphql(CONTRIB_QUERY);

  const u = contrib.user;
  const cc = u.contributionsCollection;

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
