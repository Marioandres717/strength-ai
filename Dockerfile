FROM node:24-bookworm-slim

WORKDIR /app

# better-sqlite3 has a native component. Building inside the target architecture
# keeps this image portable across Windows/x86_64 and Apple Silicon hosts.
RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The repository's prepare hook installs local Git hooks, which are irrelevant
# (and unavailable) in an image build. Rebuild the one native runtime module.
RUN pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm rebuild better-sqlite3

COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
