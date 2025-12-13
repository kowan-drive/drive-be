#!/usr/bin/env bun
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile, writeFile as writeFileFs } from 'fs/promises';
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

const camel = camelCase(rawName);
const pascal = pascalCase(rawName);

const moduleDir = join('src', 'modules', `${pascal}Module`);
if (existsSync(moduleDir)) {
  console.error(`Module directory ${moduleDir} already exists.`);
  process.exit(1);
}

async function main() {
  await mkdir(moduleDir, { recursive: true });

  // routes file
  const routes = `import Elysia from "elysia";
import { successResponse } from "~/src/lib/response";
import { ${camel}Schema } from "./${fileName}.schema";
import { ${pascal}Service } from "./${fileName}.service";

export const ${camel}Route = new Elysia({ prefix: '/${fileName}', tags: ['${pascal}'] })
    .get('/', async () => {
        const data = await ${pascal}Service.dummyService();
        return successResponse({
            data,
            message: 'Successfully fetched ${fileName} data',
        });
    }, {
        query: ${camel}Schema
    });
`;

  // service file
  const service = `import prisma from "~/prisma/prisma";

export class ${pascal}Service {
    static async dummyService() {
        return true;
    }
}
`;

  // schema file
  const schema = `import { t } from "elysia";

export const ${camel}Schema = t.Object({
    // Fill This Later
});

export type ${pascal}Schema = typeof ${camel}Schema.static;
`;

  await writeFile(join(moduleDir, `${fileName}.route.ts`), routes);
  await writeFile(join(moduleDir, `${fileName}.service.ts`), service);
  await writeFile(join(moduleDir, `${fileName}.schema.ts`), schema);

  // Update app.ts
  const appPath = join('src', 'app.ts');
  let appContent = await readFile(appPath, 'utf8');
  const importLine = `import { ${camel}Route } from "./modules/${pascal}Module/${fileName}.route";`;

  if (!appContent.includes(importLine)) {
    // Insert import after last import
    const lastImportMatch = appContent.match(/(import[^;]+;)(?![\s\S]*import)/);
    if (lastImportMatch) {
      appContent = appContent.replace(lastImportMatch[0], `${lastImportMatch[0]}\n${importLine}`);
    }
  }

  // Add .use() call before the final export
  const useStatement = `    .use(${camel}Route)`;
  if (!appContent.includes(useStatement)) {
    // Find the last .use() call and add after it
    const lastUseMatch = appContent.match(/(\.use\([^)]+\))(?![\s\S]*\.use\()/);
    if (lastUseMatch) {
      appContent = appContent.replace(lastUseMatch[0], `${lastUseMatch[0]}\n${useStatement}`);
    }
  }

  await writeFileFs(appPath, appContent);

  console.log(`Module '${pascal}Module' created in ${moduleDir}`);
  console.log(`Route registered in src/app.ts with prefix '/${fileName}'`);
}

main();
