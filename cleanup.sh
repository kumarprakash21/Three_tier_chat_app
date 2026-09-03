#!/usr/bin/env bash

set -euo pipefail

CLUSTER_NAME="${KIND_CLUSTER_NAME:-kind}"

echo "This will delete the Kubernetes application, Ingress controller, and Kind cluster: ${CLUSTER_NAME}"
echo "All data stored inside this Kind cluster will be lost."
read -r -p "Continue? [y/N] " confirmation

if [[ "${confirmation}" != "y" && "${confirmation}" != "Y" ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

if kubectl config get-contexts "kind-${CLUSTER_NAME}" >/dev/null 2>&1; then
    kubectl delete namespace chatapp --ignore-not-found=true
    kubectl delete namespace ingress-nginx --ignore-not-found=true
fi

kind delete cluster --name "${CLUSTER_NAME}"

echo "Kubernetes cleanup completed."
echo "Docker Compose volumes were not removed."
