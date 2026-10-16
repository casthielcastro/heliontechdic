#!/usr/bin/env bash
# Usage: GEMINI_API_KEY=... ./infra/deploy.sh   (needs AWS credentials + SAM CLI)
set -euo pipefail
cd "$(dirname "$0")/.."
STACK=${STACK:-helion}
[ -f .env ] && set -a && . ./.env && set +a
bun install && bun run build   # NITRO_PRESET defaults to aws-lambda
sam deploy -t infra/template.yaml --stack-name "$STACK" --resolve-s3 \
  --capabilities CAPABILITY_IAM --no-confirm-changeset \
  --parameter-overrides GeminiApiKey="$GEMINI_API_KEY" \
    SupabaseUrl="${SUPABASE_URL:-}" SupabasePublishableKey="${SUPABASE_PUBLISHABLE_KEY:-}"
BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='AssetsBucketName'].OutputValue" --output text)
aws s3 sync .output/public "s3://$BUCKET" --delete --cache-control "public,max-age=31536000,immutable"
aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs" --output table
