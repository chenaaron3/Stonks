FROM node:14

# Install server dependencies
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

# Install client dependencies
WORKDIR /usr/src/app/client
COPY client/package*.json ./
RUN npm install

# Copy source code
WORKDIR /usr/src/app
COPY . ./

# Build client
WORKDIR /usr/src/app/client
RUN npm run build

# Start server
EXPOSE 5000
WORKDIR /usr/src/app
CMD ["npm", "start"]