#!/usr/bin/env bash
# Usage: ./infra/deploy.sh   (needs AWS credentials + SAM CLI)
# Optional env: DOMAIN_NAME CERTIFICATE_ARN HOSTED_ZONE_ID ORIGIN_SECRET ALERT_EMAIL
set -euo pipefail
cd "$(dirname "$0")/.."
STACK=${STACK:-helion}
[ -f .env ] && set -a && . ./.env && set +a
bun install && bun run build   # NITRO_PRESET defaults to aws-lambda

out() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text 2>/dev/null || true; }

# Reuse the origin secret already configured on the function; generate one on first deploy.
if [ -z "${ORIGIN_SECRET:-}" ]; then
  FN=$(aws cloudformation describe-stack-resource --stack-name "$STACK" --logical-resource-id SsrFunction --query StackResourceDetail.PhysicalResourceId --output text 2>/dev/null || true)
  [ -n "$FN" ] && ORIGIN_SECRET=$(aws lambda get-function-configuration --function-name "$FN" --query Environment.Variables.ORIGIN_SECRET --output text 2>/dev/null || true)
  { [ -z "${ORIGIN_SECRET:-}" ] || [ "$ORIGIN_SECRET" = None ]; } && ORIGIN_SECRET=$(openssl rand -hex 24)
fi

# 1) Upload new hashed assets BEFORE switching the HTML (no --delete: old HTML keeps working).
BUCKET=$(out AssetsBucketName)
sync_assets() {
  aws s3 sync .output/public/assets "s3://$1/assets" --cache-control "public,max-age=31536000,immutable"
  aws s3 sync .output/public "s3://$1" --exclude "assets/*" --cache-control "public,max-age=86400"
}
[ -n "$BUCKET" ] && [ "$BUCKET" != None ] && sync_assets "$BUCKET"

PARAMS="OriginSecret=$ORIGIN_SECRET "   # only pass non-empty values (sam rejects Key=)
for kv in SupabaseUrl=SUPABASE_URL SupabasePublishableKey=SUPABASE_PUBLISHABLE_KEY \
  DomainName=DOMAIN_NAME CertificateArn=CERTIFICATE_ARN HostedZoneId=HOSTED_ZONE_ID AlertEmail=ALERT_EMAIL; do
  var="${kv#*=}"; v="${!var:-}"; [ -n "$v" ] && PARAMS+="${kv%%=*}=$v "
done
sam deploy -t infra/template.yaml --stack-name "$STACK" --resolve-s3 \
  --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset \
  --tags Project=helion --parameter-overrides $PARAMS

BUCKET=$(out AssetsBucketName)
sync_assets "$BUCKET"   # first deploy / idempotent

# 2) Tag assets not in the current build as stale -> S3 lifecycle expires them after 30 days.
(cd .output/public && find . -type f | sed 's|^\./||' | sort) > /tmp/helion-current.txt
aws s3api list-objects-v2 --bucket "$BUCKET" --query 'Contents[].Key' --output text | tr '\t' '\n' | sort \
  | comm -23 - /tmp/helion-current.txt | while read -r k; do
    [ -n "$k" ] && aws s3api put-object-tagging --bucket "$BUCKET" --key "$k" --tagging 'TagSet=[{Key=stale,Value=true}]'
  done

# 3) Refresh cached HTML.
DIST=$(aws cloudformation describe-stack-resource --stack-name "$STACK" --logical-resource-id Distribution --query StackResourceDetail.PhysicalResourceId --output text)
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/" "/compendio*" >/dev/null
aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs" --output table
