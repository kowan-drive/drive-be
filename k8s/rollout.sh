#!/bin/bash

# MiniDrive Kubernetes Rollout Script
# This script helps perform rolling updates of the MiniDrive application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Parse command line arguments
ACTION="${1:-restart}"
IMAGE_TAG="${2:-latest}"

print_info "MiniDrive Rollout Script"
echo "Namespace: minidrive"
echo "Action: $ACTION"

case "$ACTION" in
    restart)
        print_step "Performing rolling restart..."
        kubectl rollout restart deployment/minidrive-app -n minidrive
        ;;
    
    update)
        if [ -z "$2" ]; then
            print_error "Please provide an image tag: ./rollout.sh update <image-tag>"
            echo "Example: ./rollout.sh update v1.2.0"
            exit 1
        fi
        
        print_step "Updating deployment with new image tag: $IMAGE_TAG"
        read -p "Docker registry (e.g., username/minidrive-app): " REGISTRY
        
        kubectl set image deployment/minidrive-app \
            app=$REGISTRY:$IMAGE_TAG \
            -n minidrive
        ;;
    
    status)
        print_step "Checking rollout status..."
        kubectl rollout status deployment/minidrive-app -n minidrive
        ;;
    
    history)
        print_step "Rollout history..."
        kubectl rollout history deployment/minidrive-app -n minidrive
        ;;
    
    undo)
        REVISION="${2:-0}"
        if [ "$REVISION" -eq "0" ]; then
            print_step "Rolling back to previous revision..."
            kubectl rollout undo deployment/minidrive-app -n minidrive
        else
            print_step "Rolling back to revision $REVISION..."
            kubectl rollout undo deployment/minidrive-app --to-revision=$REVISION -n minidrive
        fi
        ;;
    
    pause)
        print_step "Pausing rollout..."
        kubectl rollout pause deployment/minidrive-app -n minidrive
        print_info "Rollout paused. Resume with: ./rollout.sh resume"
        ;;
    
    resume)
        print_step "Resuming rollout..."
        kubectl rollout resume deployment/minidrive-app -n minidrive
        ;;
    
    scale)
        if [ -z "$2" ]; then
            print_error "Please provide number of replicas: ./rollout.sh scale <replicas>"
            echo "Example: ./rollout.sh scale 3"
            exit 1
        fi
        
        print_step "Scaling deployment to $IMAGE_TAG replicas..."
        kubectl scale deployment/minidrive-app --replicas=$IMAGE_TAG -n minidrive
        ;;
    
    *)
        print_error "Unknown action: $ACTION"
        echo ""
        echo "Usage: $0 <action> [options]"
        echo ""
        echo "Actions:"
        echo "  restart              - Perform rolling restart"
        echo "  update <tag>         - Update to new image version"
        echo "  status               - Check rollout status"
        echo "  history              - View rollout history"
        echo "  undo [revision]      - Rollback to previous or specific revision"
        echo "  pause                - Pause ongoing rollout"
        echo "  resume               - Resume paused rollout"
        echo "  scale <replicas>     - Scale deployment"
        echo ""
        echo "Examples:"
        echo "  $0 restart"
        echo "  $0 update v1.2.0"
        echo "  $0 undo"
        echo "  $0 undo 3"
        echo "  $0 scale 5"
        exit 1
        ;;
esac

# Monitor the rollout
if [ "$ACTION" != "history" ] && [ "$ACTION" != "pause" ] && [ "$ACTION" != "scale" ]; then
    echo ""
    print_step "Monitoring rollout progress..."
    kubectl rollout status deployment/minidrive-app -n minidrive
    
    echo ""
    print_info "Rollout completed successfully!"
    
    echo ""
    print_info "Current pods:"
    kubectl get pods -n minidrive -l app=minidrive
    
    echo ""
    print_info "To view logs, run:"
    echo "  kubectl logs -f deployment/minidrive-app -n minidrive"
fi

if [ "$ACTION" = "scale" ]; then
    echo ""
    print_info "Scaling in progress..."
    kubectl get pods -n minidrive -l app=minidrive -w
fi
