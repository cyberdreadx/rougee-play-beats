// Agora RTC Token Builder for Deno
// Based on Agora's token generation algorithm

import { HmacSha256 } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const VERSION = "007";
const VERSION_LENGTH = 3;

export enum Role {
  PUBLISHER = 1,
  SUBSCRIBER = 2,
}

function pack32(value: number): Uint8Array {
  const buffer = new Uint8Array(4);
  buffer[0] = (value >> 0) & 0xFF;
  buffer[1] = (value >> 8) & 0xFF;
  buffer[2] = (value >> 16) & 0xFF;
  buffer[3] = (value >> 24) & 0xFF;
  return buffer;
}

function pack16(value: number): Uint8Array {
  const buffer = new Uint8Array(2);
  buffer[0] = (value >> 0) & 0xFF;
  buffer[1] = (value >> 8) & 0xFF;
  return buffer;
}

function packString(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  const length = pack16(encoded.length);
  const result = new Uint8Array(length.length + encoded.length);
  result.set(length, 0);
  result.set(encoded, length.length);
  return result;
}

function packMapUint32(map: Map<number, number>): Uint8Array {
  const buffers: Uint8Array[] = [];
  buffers.push(pack16(map.size));
  
  for (const [key, value] of map.entries()) {
    buffers.push(pack16(key));
    buffers.push(pack32(value));
  }
  
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

async function hmacSign(key: string, message: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return new Uint8Array(signature);
}

function base64Encode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  // Make URL-safe
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function buildTokenWithUid(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string | number,
  role: Role,
  privilegeExpiredTs: number
): Promise<string> {
  // Convert uid to number if it's a string (for web compatibility)
  const uidNum = typeof uid === 'string' ? parseInt(uid, 10) || 0 : uid;
  
  // Create privilege map
  const privileges = new Map<number, number>();
  privileges.set(1, privilegeExpiredTs); // Join channel privilege
  if (role === Role.PUBLISHER) {
    privileges.set(2, privilegeExpiredTs); // Publish audio stream
    privileges.set(3, privilegeExpiredTs); // Publish video stream
    privileges.set(4, privilegeExpiredTs); // Publish data stream
  }
  
  // Build message
  const messageBuffers: Uint8Array[] = [];
  messageBuffers.push(new TextEncoder().encode(appId));
  messageBuffers.push(new TextEncoder().encode(channelName));
  messageBuffers.push(pack32(uidNum));
  messageBuffers.push(packMapUint32(privileges));
  
  const messageLength = messageBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const message = new Uint8Array(messageLength);
  let offset = 0;
  for (const buf of messageBuffers) {
    message.set(buf, offset);
    offset += buf.length;
  }
  
  // Sign message
  const signature = await hmacSign(appCertificate, message);
  
  // Build token content
  const contentBuffers: Uint8Array[] = [];
  contentBuffers.push(packString(appId));
  contentBuffers.push(packString(channelName));
  contentBuffers.push(pack32(uidNum));
  contentBuffers.push(signature);
  contentBuffers.push(packMapUint32(privileges));
  
  const contentLength = contentBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const content = new Uint8Array(contentLength);
  offset = 0;
  for (const buf of contentBuffers) {
    content.set(buf, offset);
    offset += buf.length;
  }
  
  // Encode token
  const version = VERSION;
  const encodedContent = base64Encode(content);
  
  return `${version}${appId}${encodedContent}`;
}

