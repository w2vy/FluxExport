# Step 1: Use an official Node.js image as the base
FROM node:20

# Step 2: Set the working directory in the container
WORKDIR /app

# Step 3: Copy package.json and package-lock.json
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: install live-server locally
RUN npm install -g live-server

# Step 6: Copy the rest of the application code
COPY . .

# Step 7: Build the TypeScript code
RUN npm run build

# Step 8: Expose the application's port (if applicable)
EXPOSE 8080

# Step 9: Specify the command to run the app
CMD ["live-server", "--host=0.0.0.0", "--port=8080", "dist"]

