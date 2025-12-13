import type {
  GenerateAuthenticationOptionsOpts,
  GenerateRegistrationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/types';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import prisma from '../../../prisma/prisma';
import { generateSessionToken } from '../../lib/encryption';
import { ENV } from '../../lib/env';

const challenges = new Map<string, string>();

interface RegistrationOptions {
  email: string;
  username: string;
}

interface RegistrationVerification {
  email: string;
  username: string;
  credential: RegistrationResponseJSON;
  deviceName?: string;
}

interface LoginOptions {
  email: string;
}

interface LoginVerification {
  email: string;
  credential: AuthenticationResponseJSON;
}

export async function generateRegistration(options: RegistrationOptions) {
  const { email, username } = options;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error('User already exists');

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) throw new Error('Username already taken');

  const opts: GenerateRegistrationOptionsOpts = {
    rpName: ENV.WEBAUTHN_RP_NAME,
    rpID: ENV.WEBAUTHN_RP_ID,
    userName: email,
    userDisplayName: username,
    timeout: 60000,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  };

  const registrationOptions = await generateRegistrationOptions(opts);
  challenges.set(email, registrationOptions.challenge);
  return registrationOptions;
}

export async function verifyRegistration(verification: RegistrationVerification) {
  const { email, username, credential, deviceName } = verification;

  const expectedChallenge = challenges.get(email);
  if (!expectedChallenge) throw new Error('Challenge not found or expired');

  const opts: VerifyRegistrationResponseOpts = {
    response: credential,
    expectedChallenge,
    expectedOrigin: ENV.WEBAUTHN_ORIGIN,
    expectedRPID: ENV.WEBAUTHN_RP_ID,
  };

  let verification_result;
  try {
    verification_result = await verifyRegistrationResponse(opts);
  } catch (error) {
    console.error('WebAuthn verification error:', error);
    throw new Error('WebAuthn verification failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }

  if (!verification_result.verified || !verification_result.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const registrationInfo = verification_result.registrationInfo;
  if (!registrationInfo.credential) {
    console.error('No credential in registrationInfo:', registrationInfo);
    throw new Error('Invalid registration info structure');
  }

  const { id: credentialID, publicKey: credentialPublicKey, counter } = registrationInfo.credential;

  if (!credentialID || !credentialPublicKey) {
    console.error('Missing credential data');
    throw new Error('Invalid credential data received from WebAuthn');
  }

  const storedCredentialIdBase64 = typeof credentialID === 'string' ? isoBase64URL.toBase64(credentialID) : Buffer.from(credentialID).toString('base64');

  const user = await prisma.user.create({
    data: {
      email,
      username,
      tier: 'FREE',
      credentials: {
        create: {
          credentialId: storedCredentialIdBase64,
          publicKey: Buffer.from(credentialPublicKey).toString('base64'),
          counter: BigInt(counter),
          transports: credential.response.transports || [],
          deviceName: deviceName || 'Unknown Device',
        },
      },
    },
    include: { credentials: true },
  });

  challenges.delete(email);

  return {
    user: { id: user.id, email: user.email, username: user.username, tier: user.tier },
  };
}

export async function generateAuthentication(options: LoginOptions) {
  const { email } = options;

  const user = await prisma.user.findUnique({ where: { email }, include: { credentials: true } });
  if (!user || user.credentials.length === 0) throw new Error('User not found or no credentials registered');

  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: ENV.WEBAUTHN_RP_ID,
    timeout: 60000,
    allowCredentials: [],
    userVerification: 'preferred',
  };

  const authenticationOptions = await generateAuthenticationOptions(opts);
  challenges.set(email, authenticationOptions.challenge);
  return authenticationOptions;
}

export async function verifyAuthentication(verification: LoginVerification) {
  const { email, credential } = verification;

  const expectedChallenge = challenges.get(email);
  if (!expectedChallenge) throw new Error('Challenge not found or expired');

  const user = await prisma.user.findUnique({ where: { email }, include: { credentials: true } });
  if (!user) throw new Error('User not found');

  if (!credential || !credential.rawId) {
    console.error('Missing credential.rawId in request body:', credential);
    throw new Error('Invalid credential data: rawId missing');
  }

  let credentialIdBase64: string;
  try {
    credentialIdBase64 = isoBase64URL.toBase64(credential.rawId);
  } catch (err) {
    console.error('Failed to convert rawId to base64:', err, 'rawId:', credential.rawId);
    throw new Error('Invalid rawId format');
  }

  const userCredential = user.credentials.find((cred) => cred.credentialId === credentialIdBase64);
  if (!userCredential) {
    console.error('Credential not found. Looking for (base64):', credentialIdBase64);
    throw new Error('Credential not found');
  }

  if (userCredential.counter === null || userCredential.counter === undefined) {
    console.error('Stored credential missing counter:', userCredential);
    throw new Error('Stored credential missing counter');
  }

  const opts: VerifyAuthenticationResponseOpts = {
    response: credential,
    expectedChallenge,
    expectedOrigin: ENV.WEBAUTHN_ORIGIN,
    expectedRPID: ENV.WEBAUTHN_RP_ID,
    credential: {
      id: typeof userCredential.credentialId === 'string' ? Buffer.from(userCredential.credentialId, 'base64') : Buffer.from(userCredential.credentialId),
      publicKey: typeof userCredential.publicKey === 'string' ? Buffer.from(userCredential.publicKey, 'base64') : Buffer.from(userCredential.publicKey),
      counter: typeof userCredential.counter === 'bigint' ? Number(userCredential.counter) : Number(userCredential.counter),
      credentialID: typeof userCredential.credentialId === 'string' ? Buffer.from(userCredential.credentialId, 'base64') : Buffer.from(userCredential.credentialId),
      credentialPublicKey: typeof userCredential.publicKey === 'string' ? Buffer.from(userCredential.publicKey, 'base64') : Buffer.from(userCredential.publicKey),
    },
  };

  let verification_result;
  try {
    verification_result = await verifyAuthenticationResponse(opts);
  } catch (err) {
    console.error('verifyAuthenticationResponse threw error:', err);
    throw err;
  }

  if (!verification_result.verified) {
    throw new Error('Authentication verification failed');
  }

  await prisma.credential.update({ where: { id: userCredential.id }, data: { counter: BigInt(verification_result.authenticationInfo.newCounter), lastUsed: new Date() } });

  const sessionToken = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ENV.SESSION_EXPIRY_HOURS);

  const session = await prisma.session.create({ data: { token: sessionToken, userId: user.id, expiresAt } });

  challenges.delete(email);

  return {
    session: { token: session.token, expiresAt: session.expiresAt },
    user: { id: user.id, email: user.email, username: user.username, tier: user.tier, storageUsed: user.storageUsed },
  };
}

export async function logout(sessionToken: string) {
  await prisma.session.delete({ where: { token: sessionToken } });
  return { success: true };
}

export async function getUserFromSession(sessionToken: string) {
  const session = await prisma.session.findUnique({ where: { token: sessionToken }, include: { user: true } });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}
