import { z } from 'zod';

// WebAuthn Registration Schemas
export const registerOptionsSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(50),
});

export const registerVerifySchema = z.object({
    email: z.string().email(),
    username: z.string(),
    credential: z.object({
        id: z.string(),
        rawId: z.string(),
        response: z.object({
            clientDataJSON: z.string(),
            attestationObject: z.string(),
            transports: z.array(z.string()).optional(),
        }),
        type: z.literal('public-key'),
    }),
    deviceName: z.string().optional(),
});

// WebAuthn Login Schemas
export const loginOptionsSchema = z.object({
    email: z.string().email(),
});

export const loginVerifySchema = z.object({
    email: z.string().email(),
    credential: z.object({
        id: z.string(),
        rawId: z.string(),
        response: z.object({
            clientDataJSON: z.string(),
            authenticatorData: z.string(),
            signature: z.string(),
            userHandle: z.string().optional(),
        }),
        type: z.literal('public-key'),
    }),
});

// Session Schema
export const logoutSchema = z.object({
    // No body needed, uses session token from headers
});
