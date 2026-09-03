#!/bin/bash

set -euo pipefail

kind create cluster --config config.yml

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/kind/deploy.yaml

kubectl wait \
  --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

echo "Waiting for the Ingress admission webhook endpoint..."
webhook_ready=false
for attempt in {1..60}; do
  if kubectl get endpoints ingress-nginx-controller-admission \
    --namespace ingress-nginx \
    -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | grep -q .; then
    webhook_ready=true
    break
  fi
  sleep 2
done

if [[ "${webhook_ready}" != "true" ]]; then
  echo "Ingress admission webhook did not become ready in time."
  kubectl get pods,services,endpoints -n ingress-nginx
  exit 1
fi

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml -n chatapp
kubectl apply -f k8s/uploads-pvc.yaml \
  -f k8s/deployment.yaml \
  -f k8s/service.yaml \
  -f k8s/ingress.yaml \
  -n chatapp
