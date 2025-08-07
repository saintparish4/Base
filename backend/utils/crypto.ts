import crypto from "crypto";
import { config } from "../config/environment";

const { algorithm, keyLength, ivLength, saltLength, tagLength } =
  config.encryption;

// GENERATE A RANDOM ENCRYPTION KEY
export function generateKey(): Buffer {
  return crypto.randomBytes(keyLength);
}

// GENERATE A RANDOM SALT
export function generateSalt(): Buffer {
  return crypto.randomBytes(saltLength);
}

// DERIVE KEY FROM PASSWORD USING PBKDF2
export function deriveKey(
  password: string,
  salt: Buffer,
  iterations = 100000
): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, algorithm);
}

// ENCRYPT DATA USING AES-256-GCM
export function encrypt(
  text: string,
  key: Buffer
): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv) as crypto.CipherGCM;
  cipher.setAAD(Buffer.from("base"));

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

// DECRYPT DATA USING AES-256-GCM
export function decrypt(
  encryptedData: { encrypted: string; iv: string; tag: string },
  key: Buffer
): string {
  const { encrypted, iv, tag } = encryptedData;

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, "hex")
  ) as crypto.DecipherGCM;
  decipher.setAAD(Buffer.from("base"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// HASH PASSWORD USING BCRYPT LIKE APPROACH
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = generateSalt();
  const hash = crypto.scryptSync(password, salt, 64);

  return {
    hash: hash.toString("hex"),
    salt: salt.toString("hex"),
  };
}

// VERIFY PASSWORD AGAINST HASH
export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  const hashBuffer = Buffer.from(hash, "hex");
  const saltBuffer = Buffer.from(salt, "hex");
  const derivedKey = crypto.scryptSync(password, saltBuffer, 64);

  return crypto.timingSafeEqual(hashBuffer, derivedKey);
}

// GENERATE A SECURE TOKEN
export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

// CREATE HMAC SIGNATURE
export function createHmacSignature(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

// VERIFY HMAC SIGNATURE
export function verifyHmacSignature(
  data: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmacSignature(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
