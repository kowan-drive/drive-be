#!/usr/bin/env bun
import { writeFile, mkdir, readFile, writeFile as writeFileFs } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const [, , type, rawName] = process.argv;

if (type !== 'module' || !rawName) {
  console.error('Usage: bun generate module <modulename>');
  process.exit(1);
}

// File/dir name: underscores, code: camelCase
const fileName = rawName.trim().replace(/\s+/g, '_').toLowerCase();
const camelCase = (str: string): string =>
  str
    .replace(/(?:^|\s|_)([a-z])/g, (_: string, c: string) => c.toUpperCase())
    .replace(/^(.)/, (m: string) => m.toLowerCase());
const pascalCase = (str: string): string =>
  str.replace(/(?:^|\s|_)([a-z])/g, (_: string, c: string) => c.toUpperCase());

const moduleDir = join('src', 'modules', fileName);
if (existsSync(moduleDir)) {
  console.error(`Module directory ${moduleDir} already exists.`);
  process.exit(1);
}

const camel = camelCase(rawName);
const pascal = pascalCase(rawName);

async function main() {
  await mkdir(moduleDir, { recursive: true });

  // routes file
  const routes = `import { successResponse } from "@/common/response";
import { authenticatedRoute } from "@/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import prisma from "prisma/prisma";
import { ${camel}Schema } from "./${fileName}.schema";
import { ${pascal}Service } from "./${fileName}.service";

const app = new Hono<authenticatedRoute>();
const ${camel}Service = new ${pascal}Service(prisma);

app.get("/",
    zValidator("json", ${camel}Schema),
    async (c) => {
        const responseData = await ${camel}Service.dummyService();

        return successResponse(c, {
            dummy: responseData,
        }, "Successfully fetched ${fileName} data", 200);
    });

export default app;
`;

  // service file
  const service = `import { PrismaClient } from "prisma/generated/prisma";

export class ${pascal}Service {
    constructor(
        private readonly prisma: PrismaClient
    ) { }

    async dummyService() {
        return true;
    }
}
`;

  // schema file
  const schema = `import { z } from "zod";

export const ${camel}Schema = z.object({
    // Fill This Later
})

export type ${pascal}Schema = z.infer<typeof ${camel}Schema>;
`;

  await writeFile(join(moduleDir, `${fileName}.routes.ts`), routes);
  await writeFile(join(moduleDir, `${fileName}.service.ts`), service);
  await writeFile(join(moduleDir, `${fileName}.schema.ts`), schema);

  // Update app.ts
  const appPath = join('src', 'app.ts');
  let appContent = await readFile(appPath, 'utf8');
  const importLine = `import ${camel} from "@/modules/${fileName}/${fileName}.routes";`;
  const routeLine = `app.route("/${fileName}", ${camel});`;

  if (!appContent.includes(importLine)) {
    // Insert import after last import
    appContent = appContent.replace(/(import [^;]+;)(?![\s\S]*import )/, `$1\n${importLine}`);
  }
  if (!appContent.includes(routeLine)) {
    // Insert route before export default
    appContent = appContent.replace(
      /(app = new Hono\(\);[\s\S]*?)(export default app;)/,
      `$1${routeLine}\n\n$2`,
    );
  }
  await writeFileFs(appPath, appContent);

  console.log(`Module '${fileName}' created in ${moduleDir}`);
  console.log(`Route registered in src/app.ts as '/${fileName}'`);
}

main();
