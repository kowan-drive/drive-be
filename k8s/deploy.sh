#!/bin/bash

# MiniDrive Kubernetes Deployment Script
# This script helps deploy the MiniDrive backend to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if we have cluster access
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
    exit 1
fi

print_info "Starting MiniDrive deployment..."

# Create namespace
print_info "Creating namespace..."
kubectl apply -f 00-namespace.yaml

# Check if secrets exist
if kubectl get secret minidrive-secrets -n minidrive &> /dev/null; then
    print_warning "Secret 'minidrive-secrets' already exists. Skipping secret creation."
    print_warning "To update secrets, delete the existing secret first or update it manually."
else
    print_info "Creating secrets..."
    print_warning "IMPORTANT: Please update the secrets in 01-secret.yaml with your actual values!"
    print_warning "The default values are NOT secure for production use."
    read -p "Press Enter to continue or Ctrl+C to cancel..."
    kubectl apply -f 01-secret.yaml
fi

# Apply ConfigMap
print_info "Creating ConfigMap..."
print_warning "Please ensure you've updated the domains in 02-configmap.yaml"
read -p "Press Enter to continue or Ctrl+C to cancel..."
kubectl apply -f 02-configmap.yaml

# Create PVCs
print_info "Creating Persistent Volume Claims..."
kubectl apply -f 03-postgres-pvc.yaml
kubectl apply -f 04-minio-pvc.yaml

# Deploy PostgreSQL
print_info "Deploying PostgreSQL..."
kubectl apply -f 05-postgres-deployment.yaml

print_info "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n minidrive --timeout=180s || {
    print_error "PostgreSQL failed to start. Check logs with: kubectl logs -l app=postgres -n minidrive"
    exit 1
}

# Deploy MinIO
print_info "Deploying MinIO..."
kubectl apply -f 06-minio-deployment.yaml

print_info "Waiting for MinIO to be ready..."
kubectl wait --for=condition=ready pod -l app=minio -n minidrive --timeout=180s || {
    print_error "MinIO failed to start. Check logs with: kubectl logs -l app=minio -n minidrive"
    exit 1
}

# Initialize MinIO bucket
print_info "Initializing MinIO bucket..."
kubectl apply -f 07-minio-init-job.yaml

print_info "Waiting for MinIO initialization to complete..."
kubectl wait --for=condition=complete job/minio-init -n minidrive --timeout=120s || {
    print_error "MinIO initialization failed. Check logs with: kubectl logs job/minio-init -n minidrive"
    exit 1
}

# Deploy Application
print_info "Deploying MiniDrive application..."
print_warning "Please ensure you've updated the Docker image in 08-app-deployment.yaml"
read -p "Press Enter to continue or Ctrl+C to cancel..."
kubectl apply -f 08-app-deployment.yaml

print_info "Waiting for application to be ready..."
kubectl wait --for=condition=ready pod -l app=minidrive -n minidrive --timeout=300s || {
    print_error "Application failed to start. Check logs with: kubectl logs -l app=minidrive -n minidrive"
    exit 1
}

# Deploy Ingress
print_info "Deploying Ingress..."
print_warning "Please ensure you've configured your domain in 09-ingress.yaml"
read -p "Press Enter to continue or Ctrl+C to cancel..."
kubectl apply -f 09-ingress.yaml

print_info "Deployment complete!"
echo ""
print_info "Checking deployment status..."
kubectl get all -n minidrive

echo ""
print_info "Get your ingress details:"
kubectl get ingress -n minidrive

echo ""
print_info "To view logs, run:"
echo "  kubectl logs -f deployment/minidrive-app -n minidrive"

echo ""
print_info "To check pod status, run:"
echo "  kubectl get pods -n minidrive"

echo ""
print_warning "Don't forget to:"
echo "  1. Point your DNS to the ingress IP"
echo "  2. Configure TLS/SSL certificates"
echo "  3. Update all placeholder secrets with secure values"
