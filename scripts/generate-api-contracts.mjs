import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaPath = path.join(root, 'openapi', 'w_craft.openapi.json');
const generatedDir = path.join(root, 'src', 'api', 'generated');
const contractsPath = path.join(generatedDir, 'contracts.ts');
const clientPath = path.join(generatedDir, 'client.ts');
const document = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

function refName(ref) {
  return ref.split('/').at(-1);
}

function propertyName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function schemaType(schema) {
  let output;
  if (schema.$ref) {
    output = refName(schema.$ref);
  } else if (schema.oneOf) {
    output = schema.oneOf.map(schemaType).join(' | ');
  } else if (schema.allOf) {
    output = schema.allOf.map(schemaType).join(' & ');
  } else if (schema.enum) {
    output = schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  } else if (schema.type === 'array') {
    output = `Array<${schemaType(schema.items ?? {})}>`;
  } else if (schema.type === 'object') {
    const entries = Object.entries(schema.properties ?? {});
    if (entries.length > 0) {
      const required = new Set(schema.required ?? []);
      const properties = entries.map(([name, value]) => {
        const optional = required.has(name) ? '' : '?';
        return `${propertyName(name)}${optional}: ${schemaType(value)};`;
      });
      output = `{ ${properties.join(' ')} }`;
    } else {
      output = 'Record<string, unknown>';
    }
  } else if (schema.type === 'integer' || schema.type === 'number') {
    output = 'number';
  } else if (schema.type === 'boolean') {
    output = 'boolean';
  } else if (schema.type === 'string') {
    output = schema.format === 'binary' ? 'File' : 'string';
  } else {
    output = 'unknown';
  }
  return schema.nullable ? `${output} | null` : output;
}

function renderSchema(name, schema) {
  if (schema.type === 'object' && schema.properties && !schema.allOf) {
    const required = new Set(schema.required ?? []);
    const lines = Object.entries(schema.properties).map(([property, value]) => {
      const optional = required.has(property) ? '' : '?';
      return `  ${propertyName(property)}${optional}: ${schemaType(value)};`;
    });
    return `export interface ${name} {\n${lines.join('\n')}\n}`;
  }
  return `export type ${name} = ${schemaType(schema)};`;
}

function buildContracts() {
  const constraints = document['x-contract-constraints'];
  const schemas = document.components.schemas;
  const renderedSchemas = Object.entries(schemas)
    .map(([name, schema]) => renderSchema(name, schema))
    .join('\n\n');
  return `// Generated from openapi/w_craft.openapi.json. Do not edit manually.\n\nexport type ProjectId = number | string;\n\nexport const API_CONSTRAINTS = ${JSON.stringify(constraints, null, 2)} as const;\n\n${renderedSchemas}\n`;
}

function operationPath(operationId) {
  for (const [apiPath, pathItem] of Object.entries(document.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (operation?.operationId === operationId) {
        return apiPath.startsWith('/') ? apiPath.slice(1) : apiPath;
      }
    }
  }
  throw new Error(`Missing OpenAPI operationId: ${operationId}`);
}

function buildClient() {
  const paths = {
    listTree: operationPath('listCharacterTree'),
    createTree: operationPath('createCharacterTreeNode'),
    renameTree: operationPath('renameCharacterTreeNode'),
    deleteTree: operationPath('deleteCharacterTreeNode'),
    getProject: operationPath('getProject'),
    createProject: operationPath('createProject'),
    updateProject: operationPath('updateProject'),
    createInvitation: operationPath('createProjectInvitation'),
  };
  return `// Generated from openapi/w_craft.openapi.json. Do not edit manually.\n\nimport type {AxiosInstance} from 'axios';\nimport type {\n  CharacterTreeCreateRequest,\n  CharacterTreeDeleteRequest,\n  CharacterTreeNode,\n  CharacterTreeRenameRequest,\n  CharacterTreeRenameResponse,\n  DeleteResponse,\n  ProjectId,\n  ProjectInvitationRequest,\n  ProjectInvitationResponse,\n  ProjectMutationRequest,\n  ProjectMutationResponse,\n} from './contracts';\n\nconst projectPath = (template: string, projectId: ProjectId) =>\n  template.replace('{projectId}', encodeURIComponent(String(projectId)));\n\nexport function createGeneratedApiClient(http: AxiosInstance) {\n  return {\n    async listCharacterTree(projectId: ProjectId): Promise<CharacterTreeNode[]> {\n      const response = await http.get<CharacterTreeNode[]>('${paths.listTree}', {params: {projectId}});\n      return response.data;\n    },\n    async createCharacterTreeNode(payload: CharacterTreeCreateRequest): Promise<void> {\n      await http.post<void>('${paths.createTree}', payload);\n    },\n    async renameCharacterTreeNode(payload: CharacterTreeRenameRequest): Promise<CharacterTreeRenameResponse> {\n      const response = await http.post<CharacterTreeRenameResponse>('${paths.renameTree}', payload);\n      return response.data;\n    },\n    async deleteCharacterTreeNode(payload: CharacterTreeDeleteRequest): Promise<DeleteResponse> {\n      const response = await http.post<DeleteResponse>('${paths.deleteTree}', payload);\n      return response.data;\n    },\n    async getProject(projectId: ProjectId): Promise<ProjectMutationResponse> {\n      const response = await http.get<ProjectMutationResponse>(projectPath('${paths.getProject}', projectId));\n      return response.data;\n    },\n    async createProject(payload: ProjectMutationRequest): Promise<ProjectMutationResponse> {\n      const response = await http.post<ProjectMutationResponse>('${paths.createProject}', payload);\n      return response.data;\n    },\n    async updateProject(projectId: ProjectId, payload: ProjectMutationRequest): Promise<ProjectMutationResponse> {\n      const response = await http.patch<ProjectMutationResponse>(projectPath('${paths.updateProject}', projectId), payload);\n      return response.data;\n    },\n    async createProjectInvitation(projectId: ProjectId, payload: ProjectInvitationRequest): Promise<ProjectInvitationResponse> {\n      const response = await http.post<ProjectInvitationResponse>(projectPath('${paths.createInvitation}', projectId), payload);\n      return response.data;\n    },\n  };\n}\n\nexport type GeneratedApiClient = ReturnType<typeof createGeneratedApiClient>;\n`;
}

const outputs = new Map([
  [contractsPath, buildContracts()],
  [clientPath, buildClient()],
]);
const checkOnly = process.argv.includes('--check');
let hasDrift = false;
for (const [outputPath, content] of outputs) {
  if (checkOnly) {
    const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    if (existing !== content) {
      hasDrift = true;
      process.stderr.write(`${path.relative(root, outputPath)} is out of date\n`);
    }
  } else {
    fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    fs.writeFileSync(outputPath, content, 'utf8');
  }
}
if (hasDrift) {
  process.exitCode = 1;
}
