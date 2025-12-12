import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
    GenerateRegistrationOptionsOpts,
    VerifyRegistrationResponseOpts,
    GenerateAuthenticationOptionsOpts,
    VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import type {
    RegistrationResponseJSON,
    AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import prisma from '../../../prisma/prisma';
import { ENV } from '../../lib/env';
import { generateSessionToken } from '../../lib/encryption';

// Temporary storage for challenges (in production, use Redis)
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

/**
 * Generate WebAuthn registration options
 */
export async function generateRegistration(options: RegistrationOptions) {
    const { email, username } = options;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new Error('User already exists');
    }

    // Check if username is taken
    const existingUsername = await prisma.user.findUnique({
        where: { username },
    });

    if (existingUsername) {
        throw new Error('Username already taken');
    }

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

    // Store challenge temporarily
    challenges.set(email, registrationOptions.challenge);

    return registrationOptions;
}

/**
 * Verify WebAuthn registration response
 */
export async function verifyRegistration(verification: RegistrationVerification) {
    const { email, username, credential, deviceName } = verification;

    const expectedChallenge = challenges.get(email);
    if (!expectedChallenge) {
        throw new Error('Challenge not found or expired');
    }

    const opts: VerifyRegistrationResponseOpts = {
        response: credential,
        expectedChallenge,
        expectedOrigin: ENV.WEBAUTHN_ORIGIN,
        expectedRPID: ENV.WEBAUTHN_RP_ID,
    };

    const verification_result = await verifyRegistrationResponse(opts);

    if (!verification_result.verified || !verification_result.registrationInfo) {
        throw new Error('Registration verification failed');
    }

    const { id, publicKey, counter } =
        verification_result.registrationInfo.credential;

    // Create user and credential in database
    const user = await prisma.user.create({
        data: {
            email,
            username,
            tier: 'FREE',
            credentials: {
                create: {
                    credentialId: id,
                    publicKey: Buffer.from(publicKey).toString('base64'),
                    counter: BigInt(counter),
                    transports: credential.response.transports || [],
                    deviceName: deviceName || 'Unknown Device',
                },
            },
        },
        include: {
            credentials: true,
        },
    });

    // Clean up challenge
    challenges.delete(email);

    return {
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            tier: user.tier,
        },
    };
}

/**
 * Generate WebAuthn authentication options
 */
export async function generateAuthentication(options: LoginOptions) {
    const { email } = options;

    // Find user
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            credentials: true,
        },
    });

    if (!user || user.credentials.length === 0) {
        throw new Error('User not found or no credentials registered');
    }

    const opts: GenerateAuthenticationOptionsOpts = {
        rpID: ENV.WEBAUTHN_RP_ID,
        timeout: 60000,
        allowCredentials: user.credentials.map((cred) => ({
            id: cred.credentialId,
            type: 'public-key',
            transports: cred.transports as AuthenticatorTransport[],
        })),
        userVerification: 'preferred',
    };

    const authenticationOptions = await generateAuthenticationOptions(opts);

    // Store challenge temporarily
    challenges.set(email, authenticationOptions.challenge);

    return authenticationOptions;
}

/**
 * Verify WebAuthn authentication response and create session
 */
export async function verifyAuthentication(verification: LoginVerification) {
    const { email, credential } = verification;

    const expectedChallenge = challenges.get(email);
    if (!expectedChallenge) {
        throw new Error('Challenge not found or expired');
    }

    // Find user and credential
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            credentials: true,
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    const credentialId = credential.id;
    const userCredential = user.credentials.find(
        (cred) => cred.credentialId === credentialId,
    );

    if (!userCredential) {
        throw new Error('Credential not found');
    }

    const opts: VerifyAuthenticationResponseOpts = {
        response: credential,
        expectedChallenge,
        expectedOrigin: ENV.WEBAUTHN_ORIGIN,
        expectedRPID: ENV.WEBAUTHN_RP_ID,
        credential: {
            id: userCredential.credentialId,
            publicKey: Buffer.from(userCredential.publicKey, 'base64'),
            counter: Number(userCredential.counter),
            transports: userCredential.transports as AuthenticatorTransport[],
        },
    };

    const verification_result = await verifyAuthenticationResponse(opts);

    if (!verification_result.verified) {
        throw new Error('Authentication verification failed');
    }

        // Update credential counter
        await prisma.credential.update({
            where: { id: userCredential.id },
            data: {
                counter: BigInt(verification_result.authenticationInfo.newCounter),
                lastUsed: new Date(),
            },
        });

        // Create session
        const sessionToken = generateSessionToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + ENV.SESSION_EXPIRY_HOURS);

        const session = await prisma.session.create({
            data: {
                token: sessionToken,
                userId: user.id,
                expiresAt,
            },
        });

        // Clean up challenge
        challenges.delete(email);

        return {
            session: {
                token: session.token,
                expiresAt: session.expiresAt,
            },
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                tier: user.tier,
                storageUsed: Number(user.storageUsed),
            },
        };
}

/**
 * Logout user by deleting session
 */
export async function logout(sessionToken: string) {
    await prisma.session.delete({
        where: { token: sessionToken },
    });

    return { success: true };
}

/**
 * Get user from session token
 */
export async function getUserFromSession(sessionToken: string) {
    const session = await prisma.session.findUnique({
        where: { token: sessionToken },
        include: { user: true },
    });

    if (!session) {
        return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { id: session.id } });
        return null;
    }

    return session.user;
}
