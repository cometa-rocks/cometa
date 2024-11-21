# Use the official Ubuntu image as the base image
FROM ubuntu:24.10

# Set the environment variables to prevent interaction during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update the package list and install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    software-properties-common \
    build-essential \
    curl procps supervisor \
    && apt-get clean

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean

# # Install OpenJDK (Java)
# RUN apt-get install -y openjdk-11-jre \
#     && apt-get clean

# # Set environment variables for Java
# ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
# ENV PATH="$JAVA_HOME/bin:$PATH"

# Verify installations
RUN node -v && npm -v 

# Install Appium
RUN npm i --location=global appium

# Install UIautomator2 driver to automation GUI application of Android
RUN appium driver install uiautomator2

# Set the default working directory
WORKDIR /app

# Make a logs directory
RUN mkdir -p /logs

# Copy the current directory contents into the container at /app
COPY . /app

# Expose the necessary Appium port
EXPOSE 4723

# Run ollama when the container launches
CMD ["supervisord", "-c", "/app/supervisor/supervisord.conf"]
