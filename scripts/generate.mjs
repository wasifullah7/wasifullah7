/**
 * Builds the neofetch-style profile card as two SVGs, one per colour scheme.
 *
 * The portrait is fixed (scripts/portrait.txt, generated once from a photo).
 * Everything on the right is pulled live from the GitHub GraphQL API, so the
 * numbers stay honest without anyone editing a file.
 *
 * Run: GITHUB_TOKEN=... node scripts/generate.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const USER = "wasifullah7";

const THEMES = {
  dark: {
    file: "dark_mode.svg",
    bg: "#0d1117",
    border: "#30363d",
    art: "#8b949e",
    key: "#e05d44",
    value: "#c9d1d9",
    dim: "#6e7681",
    title: "#e6edf3",
    good: "#3fb950",
  },
  light: {
    file: "light_mode.svg",
    bg: "#ffffff",
    border: "#d0d7de",
    art: "#57606a",
    key: "#cf4520",
    value: "#1f2328",
    dim: "#6e7781",
    title: "#1f2328",
    good: "#1a7f37",
  },
  site: {
    file: "site_card.svg",
    bg: "transparent",
    border: "var(--rule)",
    art: "var(--faint)",
    key: "var(--accent)",
    value: "var(--ink)",
    dim: "var(--faint)",
    title: "var(--ink)",
    good: "var(--accent)",
  },
};

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

async function graphql(query, token) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": USER,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function collectStats(token) {
  const data = await graphql(
    `{
      user(login: "${USER}") {
        followers { totalCount }
        following { totalCount }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
        }
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          totalCount
          nodes {
            stargazerCount
            primaryLanguage { name }
            languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name } }
            }
          }
        }
      }
    }`,
    token,
  );

  const user = data.user;
  const repos = user.repositories.nodes ?? [];

  const stars = repos.reduce((sum, r) => sum + (r.stargazerCount ?? 0), 0);

  // Rank languages by bytes written across owned, non-fork repositories.
  const bytes = new Map();
  for (const repo of repos) {
    for (const edge of repo.languages?.edges ?? []) {
      bytes.set(edge.node.name, (bytes.get(edge.node.name) ?? 0) + edge.size);
    }
  }
  // Markup, styling and notebook formats inflate byte counts and say
  // nothing about what someone actually builds, so they are excluded.
  const NOT_A_LANGUAGE = new Set([
    "HTML", "CSS", "SCSS", "Sass", "Less", "Jupyter Notebook",
    "Dockerfile", "Shell", "Makefile", "Batchfile", "Vim Script",
    "Roff", "TeX", "Procfile", "Mako",
  ]);
  const topLanguages = [...bytes.entries()]
    .filter(([name]) => !NOT_A_LANGUAGE.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const totalBytes = [...bytes.values()].reduce((a, b) => a + b, 0);

  return {
    repos: user.repositories.totalCount,
    stars,
    followers: user.followers.totalCount,
    commits: user.contributionsCollection.totalCommitContributions,
    prs: user.contributionsCollection.totalPullRequestContributions,
    issues: user.contributionsCollection.totalIssueContributions,
    topLanguages,
    totalBytes,
  };
}

/** Static facts. Edit these here, not in the SVG. */
const PROFILE = {
  handle: `${USER}@github`,
  rows: [
    ["Role", "Voice AI & Full-Stack AI Engineer"],
    ["Company", "RTC League, Lahore"],
    ["Focus", "Real-time voice agents, computer vision"],
    ["Shipping since", "2023 · clients in the UK, EU and US"],
    null,
    ["Voice", "LiveKit, SIP telephony, vLLM, WebRTC"],
    ["Vision", "RF-DETR, SAM2, PaddleOCR, PyTorch"],
    ["Retrieval", "RAG, pgvector, Qdrant, Pinecone"],
    ["Backend", "Python, FastAPI, Node.js, PostgreSQL"],
    ["Infra", "AWS, Docker, Terraform, Kubernetes"],
    null,
    ["Portfolio", "wasif-ullah-portfolio.vercel.app"],
    ["Writing", "medium.com/@wasifullahdev"],
    ["LinkedIn", "linkedin.com/in/wasifullahdev"],
    ["Email", "wasif.wwez@gmail.com"],
  ],
};

function buildSvg(theme, stats, art) {
  const t = THEMES[theme];
  const withArt = true;
  const artLines = art.split("\n");

  const CHAR_W = 8.4;
  const LINE_H = 19;
  const PAD = 26;
  const ART_COLS = withArt ? Math.max(...artLines.map((l) => l.length)) : 0;
  const RIGHT_X = withArt ? PAD + ART_COLS * CHAR_W + 34 : PAD;

  // Build the right-hand readout.
  const right = [];
  right.push({ kind: "title", text: PROFILE.handle });

  for (const row of PROFILE.rows) {
    if (!row) {
      right.push({ kind: "gap" });
      continue;
    }
    right.push({ kind: "kv", key: row[0], value: row[1] });
  }

  right.push({ kind: "gap" });
  right.push({ kind: "rule", text: "GitHub" });
  right.push({ kind: "kv", key: "Repositories", value: String(stats.repos) });
  right.push({ kind: "kv", key: "Stars", value: String(stats.stars) });
  right.push({ kind: "kv", key: "Followers", value: String(stats.followers) });
  right.push({
    kind: "kv",
    key: "Contributions",
    value: [
      `${stats.commits} commit${stats.commits === 1 ? "" : "s"}`,
      `${stats.prs} pull request${stats.prs === 1 ? "" : "s"}`,
      `${stats.issues} issue${stats.issues === 1 ? "" : "s"}`,
    ].join(" · "),
  });
  right.push({
    kind: "kv",
    key: "Code written",
    value: `${(stats.totalBytes / 1_000_000).toFixed(1)} MB across ${stats.repos} repositories`,
  });
  // Deliberately no auto-ranked language row. Byte counts only see the repos
  // on this account, which under-represents Python badly, and they surface
  // misdetections. The stack rows above are the accurate picture.

  const rowCount = Math.max(artLines.length, right.length);
  const height = PAD * 2 + rowCount * LINE_H + 10;

  const keyWidth = Math.max(
    ...right.filter((r) => r.kind === "kv").map((r) => r.key.length),
    13,
  );
  const valueX = RIGHT_X + (keyWidth + 3) * CHAR_W;
  const longestValue = Math.max(
    ...right.filter((r) => r.kind === "kv").map((r) => r.value.length),
    30,
  );
  const width = Math.ceil(
    Math.max(withArt ? 980 : 560, valueX + (longestValue + 2) * CHAR_W + PAD),
  );

  const artSvg = !withArt ? "" : artLines
    .map(
      (line, i) =>
        `<text x="${PAD}" y="${PAD + (i + 1) * LINE_H}" fill="${t.art}">${esc(line)}</text>`,
    )
    .join("\n    ");

  const rightSvg = right
    .map((item, i) => {
      const y = PAD + (i + 1) * LINE_H;
      if (item.kind === "gap") return "";
      if (item.kind === "title") {
        const rule = "─".repeat(Math.max(4, 46 - item.text.length));
        return `<text x="${RIGHT_X}" y="${y}"><tspan fill="${t.title}" font-weight="700">${esc(item.text)}</tspan><tspan fill="${t.border}"> ${rule}</tspan></text>`;
      }
      if (item.kind === "rule") {
        return `<text x="${RIGHT_X}" y="${y}"><tspan fill="${t.border}">── </tspan><tspan fill="${t.title}" font-weight="700">${esc(item.text)}</tspan><tspan fill="${t.border}"> ${"─".repeat(40)}</tspan></text>`;
      }
      const dots = ".".repeat(Math.max(2, keyWidth + 2 - item.key.length));
      return `<text x="${RIGHT_X}" y="${y}"><tspan fill="${t.key}">${esc(item.key)}</tspan><tspan fill="${t.dim}">${dots}</tspan></text><text x="${valueX}" y="${y}" fill="${t.value}">${esc(item.value)}</text>`;
    })
    .filter(Boolean)
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Profile card for Wasif Ullah">
  ${t.bg === "transparent" ? "" : `<rect width="${width}" height="${height}" rx="10" fill="${t.bg}" stroke="${t.border}"/>`}
  <g font-family="${t.bg === "transparent" ? "var(--font-jetbrains), ui-monospace, monospace" : "SFMono-Regular, ui-monospace, 'JetBrains Mono', Consolas, monospace"}" font-size="13.5" xml:space="preserve" style="font-variant-ligatures:none;font-feature-settings:&quot;liga&quot; 0,&quot;calt&quot; 0,&quot;dlig&quot; 0">
    ${artSvg}
    ${rightSvg}
  </g>
</svg>
`;
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}

const art = readFileSync(join(here, "portrait.txt"), "utf8").replace(/\s+$/, "");
const stats = await collectStats(token);

const SITE_CARD_PATH =
  process.env.SITE_CARD_PATH ??
  "C:/Users/Dell/OneDrive/Desktop/portfolio/src/content/github-card.svg";

for (const theme of Object.keys(THEMES)) {
  const svg = buildSvg(theme, stats, art);

  if (theme === "site") {
    // Only written when the portfolio checkout is present, so CI never fails
    // on a path that only exists on the author's machine.
    try {
      writeFileSync(SITE_CARD_PATH, svg);
      console.log("wrote the site card to the portfolio");
    } catch {
      console.log("portfolio checkout not found, skipped the site card");
    }
    continue;
  }

  writeFileSync(join(here, "..", THEMES[theme].file), svg);
  console.log(`wrote ${THEMES[theme].file}`);
}

console.log(
  `repos ${stats.repos} · stars ${stats.stars} · followers ${stats.followers} · commits ${stats.commits}`,
);
console.log(`languages: ${stats.topLanguages.join(", ")}`);
