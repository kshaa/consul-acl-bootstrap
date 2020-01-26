FROM node:12.14.1-alpine

WORKDIR /app/
COPY ./src /app/

RUN npm install && npx tsc
WORKDIR /app/dist/

CMD node main.js