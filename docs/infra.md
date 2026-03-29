# Infrastructure Setup

Both options create the same resources:

- **S3 bucket** — private, SSE-AES256 at rest, auto-abort incomplete multipart uploads after 1 day
- **IAM user** `nodeo-backend` with minimal S3 permissions (Put/Get/Delete/Head/List on this bucket only)
- **Access key** for the IAM user

## Option A: CloudFormation

```bash
aws cloudformation deploy \
  --template-file infra/cloudformation.yaml \
  --stack-name nodeo-s3 \
  --parameter-overrides BucketName=your-bucket-name \
  --capabilities CAPABILITY_NAMED_IAM
```

Get outputs:

```bash
aws cloudformation describe-stacks --stack-name nodeo-s3 \
  --query 'Stacks[0].Outputs' --output table
```

**Note:** CloudFormation only exposes `SecretAccessKey` on initial creation. If you missed it, generate a new key manually:

```bash
aws iam create-access-key --user-name nodeo-backend
```

To delete old keys if needed:

```bash
aws iam list-access-keys --user-name nodeo-backend
aws iam delete-access-key --user-name nodeo-backend --access-key-id OLD_KEY_ID
```

Get your region:

```bash
aws configure get region
```

## Option B: Terraform

```bash
cd infra
terraform init
terraform plan -var="bucket_name=your-bucket-name"
terraform apply -var="bucket_name=your-bucket-name"
```

Get credentials for `.env`:

```bash
terraform output -raw env_snippet
```

## Filling `.env`

After provisioning, add these to your `.env`:

```env
S3_BUCKET=your-bucket-name
S3_REGION=eu-central-1
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=secret...
```

## Teardown

CloudFormation:

```bash
# Empty the bucket first (required before stack deletion)
aws s3 rm s3://your-bucket-name --recursive
aws cloudformation delete-stack --stack-name nodeo-s3
```

Terraform:

```bash
cd infra
terraform destroy -var="bucket_name=your-bucket-name"
```
