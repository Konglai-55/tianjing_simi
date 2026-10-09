import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";

process.loadEnvFile(".env.local");

const required = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

if (required.some((key) => !process.env[key])) {
  console.error("S3_TEST_FAILED=环境变量不完整");
  process.exit(1);
}

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

try {
  const result = await client.send(new ListBucketsCommand({}));
  const bucketExists = result.Buckets?.some(
    (bucket) => bucket.Name === process.env.S3_BUCKET,
  );
  console.log(
    `S3_CONNECTION_OK=${result.$metadata.httpStatusCode} BUCKET_FOUND=${Boolean(bucketExists)}`,
  );
} catch (error) {
  const status = error?.$metadata?.httpStatusCode ?? "";
  console.error(`S3_TEST_FAILED=${error.name} STATUS=${status} MESSAGE=${error.message}`);
  process.exit(1);
}
