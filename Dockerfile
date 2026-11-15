# Build from repository root. Matching Debian bases keep the Rust binary's libc compatible.
FROM rust:1-bookworm AS parser
WORKDIR /build
COPY services/resume-parser/Cargo.toml services/resume-parser/Cargo.lock ./
COPY services/resume-parser/src ./src
RUN cargo build --locked --release && strip target/release/resume-parser

FROM node:22-bookworm-slim AS web
WORKDIR /app/web
ENV NEXT_TELEMETRY_DISABLED=1
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
ENV RESUME_PARSER_PATH=/usr/local/bin/resume-parser RESUME_UPLOAD_ENABLED=false
COPY --from=web --chown=node:node /app/web/.next/standalone ./
COPY --from=web --chown=node:node /app/web/.next/static ./.next/static
COPY --from=web --chown=node:node /app/web/public ./public
COPY --from=parser /build/target/release/resume-parser /usr/local/bin/resume-parser
USER node
EXPOSE 3000
# Static command, no upload-derived arguments. Host resource restrictions are also required.
CMD ["sh", "-c", "ulimit -c 0; exec node server.js"]
