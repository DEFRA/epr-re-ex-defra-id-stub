#!/bin/bash
set -e

# S3 buckets
#aws s3 mb s3://my-bucket

# SQS queues
#aws sqs create-queue --queue-name my-queue

# DynamoDB table for temporary (ephemeral) registrations
table_name="${AWS_DYNAMODB_REGISTRATIONS_TABLE_NAME:-epr-re-ex-defra-id-stub-registrations}"

if aws dynamodb describe-table --table-name "$table_name" >/dev/null 2>&1; then
  echo "Table '$table_name' already exists"
else
  aws dynamodb create-table \
    --table-name "$table_name" \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST

  echo "Created table '$table_name'"
fi

aws dynamodb update-time-to-live \
  --table-name "$table_name" \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt" >/dev/null

echo "Enabled TTL on '$table_name' using expiresAt"
