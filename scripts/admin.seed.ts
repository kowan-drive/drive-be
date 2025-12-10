import { config } from 'dotenv';
import prisma from '~/prisma/prisma';
import { auth } from '~/src/lib/auth';

config();

export async function main() {
  await auth.api
    .signUpEmail({
      body: {
        name: 'Super Admin',
        email: process.env.ADMIN_EMAIL || 'admin',
        password: process.env.ADMIN_PASSWORD || 'dummy123',
      },
    })
    .then(async (response) => {
      await prisma.user.update({
        where: { id: response.user.id },
        data: {
          role: 'ADMIN',
        },
      });
    })
    .catch((error) => {
      if (error.status === 409) {
        console.error('User already exists, skipping creation.');
      } else {
        console.error('Error creating admin user:', error);
      }
    });
}

main();
