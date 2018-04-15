FROM node:8

RUN mkdir -p /opt/app

EXPOSE 4000

WORKDIR /opt
COPY yarn.lock package.json ./
RUN yarn install
ENV PATH /opt/node_modules/.bin:$PATH

WORKDIR /opt/app
COPY . /opt/app

CMD ["yarn", "start"]  
