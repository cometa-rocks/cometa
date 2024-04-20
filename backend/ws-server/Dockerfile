# Use Node.js version 14 as the base image
FROM node:14

# Set the working directory inside the container
WORKDIR /home/node/app

# chown folder permissions
RUN chown -R node:node /home/node/app

# npm settings
RUN mkdir -p npm
RUN touch ./npm/test
RUN chown -R node:node ./npm
RUN chmod -R 755 ./npm

# pm2 settings
RUN mkdir -p /.pm2/logs
RUN touch /.pm2/test
RUN chown -R node:node /.pm2
RUN chmod -R 777 /.pm2

# Switch to non-root user
USER node

# Copy application files and package.json with proper ownership
COPY --chown=node:node app/ /home/node/app/app/
COPY --chown=node:node package.json /home/node/app/

# Install dependencies
RUN npm install

# Change ownership to non-root 'node' user for all app directories and set permissions

RUN chmod -R 755 /home/node/app/node_modules

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["npm", "run", "server-start"]
