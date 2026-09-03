#!/bin/bash

set -euo pipefail

kind create cluster --config config.yml

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/kind/deploy.yaml

kubectl wait \
  --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

kubectl wait \
  --namespace ingress-nginx \
  --for=condition=complete job/ingress-nginx-admission-create \
  --timeout=120s

kubectl wait \
  --namespace ingress-nginx \
  --for=condition=complete job/ingress-nginx-admission-patch \
  --timeout=120s

echo "Waiting for the Ingress admission webhook endpoint..."
until kubectl get endpoints ingress-nginx-controller-admission \
  --namespace ingress-nginx \
  -o jsonpath='{.subsets[0].addresses[0].ip}' | grep -q .; do
  sleep 2
done

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml -n chatapp
kubectl apply -f k8s/uploads-pvc.yaml \
  -f k8s/deployment.yaml \
  -f k8s/service.yaml \
  -f k8s/ingress.yaml \
  -n chatapp
