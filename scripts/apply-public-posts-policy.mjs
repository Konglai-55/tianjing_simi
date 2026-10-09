import {
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";

process.loadEnvFile(".env.local");

const required = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
if (required.some((key) => !process.env[key])) {
  throw new Error("对象存储环境变量不完整");
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

let policy = { Version: "2012-10-17", Statement: [] };
try {
  const existing = await client.send(
    new GetBucketPolicyCommand({ Bucket: process.env.S3_BUCKET }),
  );
  if (existing.Policy) policy = JSON.parse(existing.Policy);
} catch (error) {
  if (error.$metadata?.httpStatusCode !== 404) throw error;
}

policy.Statement = Array.isArray(policy.Statement) ? policy.Statement : [];
const statement = {
  Sid: "PublicReadWebsitePosts",
  Effect: "Allow",
  Principal: "*",
  Action: "s3:GetObject",
  Resource: `arn:aws:s3:::${process.env.S3_BUCKET}/posts/*`,
};
const existingIndex = policy.Statement.findIndex(
  (item) => item.Sid === statement.Sid,
);
if (existingIndex >= 0) policy.Statement[existingIndex] = statement;
else policy.Statement.push(statement);

const result = await client.send(
  new PutBucketPolicyCommand({
    Bucket: process.env.S3_BUCKET,
    Policy: JSON.stringify(policy),
  }),
);
console.log(`POLICY_UPDATED=${result.$metadata.httpStatusCode}`);
