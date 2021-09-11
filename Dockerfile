FROM node:14

# Install server dependencies
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production=false

# Install client dependencies
WORKDIR /usr/src/app/src/client
COPY src/client/package*.json ./
RUN npm install --production=false

# Copy source code
WORKDIR /usr/src/app
COPY . ./

# Build server
RUN npm run build

# Build client
WORKDIR /usr/src/app/src/client
ENV REACT_APP_SUBDIRECTORY=/stocks
ENV REACT_APP_DEMO_ID=1xdqDkII7q
ENV REACT_APP_DOMAIN=chenaaron.com
RUN echo "$REACT_APP_SUBDIRECTORY, $REACT_APP_DEMO_ID, $REACT_APP_DOMAIN"
RUN npm run build

# Start server
EXPOSE 5000
WORKDIR /usr/src/app
CMD ["npm", "start"]