#!/bin/bash

# Path to the Redis certificates directory
CERT_DIR="/share/certs"

# Certificate file names
CA_CERT="$CERT_DIR/ca-cert.pem"
REDIS_KEY="$CERT_DIR/redis-key.pem"
REDIS_CERT="$CERT_DIR/redis-cert.pem"
REDIS_CSR="$CERT_DIR/redis.csr"

# Check if the certificates already exist
if [ -f "$CA_CERT" ] && [ -f "$REDIS_KEY" ] && [ -f "$REDIS_CERT" ]; then
    echo "Certificates already exist at $CERT_DIR"
  
else

    echo "Certificates files not found. Generating new certificates and redis secret key..."

    # Install OpenSSL if not already installed
    apt update && apt install openssl -y


    # Create the certs directory if it doesn't exist
    mkdir -p $CERT_DIR

    # Change to the certs directory
    cd $CERT_DIR

    # Create a CA certificate
    openssl genrsa -out ca-key.pem 4096
    openssl req -new -x509 -key ca-key.pem -sha256 -days 3650 -out ca-cert.pem -subj "/C=AU/ST=State/L=City/O=Organization/OU=OrgUnit/CN=example.com" || exit 1

    # Create a private key for the Redis server
    openssl genrsa -out redis-key.pem 2048 || exit 1

    # Create a certificate signing request (CSR) for the Redis server
    openssl req -new -key redis-key.pem -out redis.csr -subj "/C=AU/ST=State/L=City/O=Organization/OU=OrgUnit/CN=redis.example.com" || exit 1

    # Create the server certificate signed by your CA
    openssl x509 -req -in redis.csr -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out redis-cert.pem -days 3650 || exit 1

    echo "Certificates generated and saved to $CERT_DIR."

fi


echo "Certificate file names"
echo $CA_CERT
echo $REDIS_KEY
echo $REDIS_CERT
echo $REDIS_CSR
redis-server /usr/local/etc/redis/redis.conf

