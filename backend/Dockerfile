FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS runtime
RUN apk add --no-cache ca-certificates libstdc++ \
    && addgroup -g 1000 node \
    && adduser -D -u 1000 -G node node
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/docker-entrypoint.sh /usr/local/bin/
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node
EXPOSE 5000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
