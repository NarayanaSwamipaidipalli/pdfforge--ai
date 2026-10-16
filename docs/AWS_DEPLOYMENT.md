# PDFForge AI – AWS Cloud Enterprise Deployment Guide
## Production Setup on AWS EKS, Aurora Serverless, ElastiCache, S3 & CloudFront

---

### 1. Prerequisites & Tooling Setup

Ensure your workstation or deployment bastion has the following installed:
- AWS CLI v2 (`aws --version >= 2.15`)
- Terraform v1.7+ (`terraform --version`)
- kubectl (`kubectl version --client`)
- Helm v3 (`helm version`)
- Docker Desktop or Finch

Authenticate with your AWS account:
```bash
aws configure
aws sts get-caller-identity
```

---

### 2. Infrastructure as Code (Terraform Provisioning)

Navigate to the terraform configuration:
```bash
cd infrastructure/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

This provisions:
- AWS VPC with public & private subnets across 3 Availability Zones.
- S3 Bucket `pdfforge-enterprise-documents` with KMS Customer Managed Key and 24h expiration rules.
- EKS Cluster `pdfforge-production-eks` (Kubernetes v1.30).
- Amazon Aurora PostgreSQL 16 cluster with `pgvector` support.
- Amazon ElastiCache Redis cluster for Celery queues and job pub/sub.

---

### 3. Container Image Build & ECR Push

Authenticate Docker to Amazon ECR:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
```

Build and push the microservice images:
```bash
# 1. API Gateway
docker build -t pdfforge-api:v1.0.0 ./apps/api
docker tag pdfforge-api:v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/pdfforge-api:v1.0.0
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/pdfforge-api:v1.0.0

# 2. PDF Processing Worker
docker build -t pdfforge-worker:v1.0.0 ./services/pdf-worker
docker tag pdfforge-worker:v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/pdfforge-worker:v1.0.0
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/pdfforge-worker:v1.0.0

# 3. Web Frontend
docker build -t pdfforge-web:v1.0.0 ./apps/web
docker tag pdfforge-web:v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/pdfforge-web:v1.0.0
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/pdfforge-web:v1.0.0
```

---

### 4. Kubernetes Deployment & Ingress

Update kubeconfig to connect to EKS:
```bash
aws eks update-kubeconfig --region us-east-1 --name pdfforge-production-eks
kubectl create namespace pdfforge-production
```

Apply Kubernetes secrets and configurations:
```bash
kubectl apply -f infrastructure/k8s/api-deployment.yaml
kubectl apply -f infrastructure/k8s/worker-deployment.yaml
kubectl apply -f infrastructure/k8s/ingress.yaml
```

Verify pod statuses:
```bash
kubectl get pods -n pdfforge-production
kubectl get hpa -n pdfforge-production
```

---

### 5. Database Migration & Vector Extension

Run Prisma migrations from an admin pod:
```bash
kubectl run prisma-migrate --rm -i --tty \
  --namespace pdfforge-production \
  --image 123456789012.dkr.ecr.us-east-1.amazonaws.com/pdfforge-api:v1.0.0 \
  -- npx prisma migrate deploy
```

---

### 6. CloudFront CDN & Domain Routing

Route Route53 alias records (`pdfforge.ai` and `*.pdfforge.ai`) to the AWS ALB Ingress controller or CloudFront distribution with Origin Access Identity (OAI) for S3 downloads.
