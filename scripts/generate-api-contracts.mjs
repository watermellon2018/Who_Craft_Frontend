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
    getCreditSummary: operationPath('getCreditSummary'),
    listCreditHistory: operationPath('listCreditHistory'),
    createCreditDemoTopUp: operationPath('createCreditDemoTopUp'),
    createCreditTransfer: operationPath('createCreditTransfer'),
  };
  return `// Generated from openapi/w_craft.openapi.json. Do not edit manually.

import type {AxiosInstance} from 'axios';
import type {
  CharacterTreeCreateRequest,
  CharacterTreeNode,
  CharacterTreeUpdateRequest,
  CreditDemoTopUpRequest,
  CreditHistoryPage,
  CreditMutationResponse,
  CreditOperationType,
  CreditSummary,
  CreditTransferRequest,
  CreditTransferResponse,
  ProjectId,
  ProjectInvitationRequest,
  ProjectInvitationResponse,
  ProjectMutationRequest,
  ProjectMutationResponse,
} from './contracts';

const projectPath = (template: string, projectId: ProjectId) =>
  template.replace('{projectId}', encodeURIComponent(String(projectId)));

const treeNodePath = (template: string, projectId: ProjectId, nodeId: string) =>
  projectPath(template, projectId).replace('{nodeId}', encodeURIComponent(String(nodeId)));

export function createGeneratedApiClient(http: AxiosInstance) {
  return {
    async getCreditSummary(): Promise<CreditSummary> {
      const response = await http.get<CreditSummary>('${paths.getCreditSummary}');
      return response.data;
    },
    async listCreditHistory(params: {limit?: number; offset?: number; operationType?: CreditOperationType} = {}): Promise<CreditHistoryPage> {
      const response = await http.get<CreditHistoryPage>('${paths.listCreditHistory}', {params});
      return response.data;
    },
    async createCreditDemoTopUp(payload: CreditDemoTopUpRequest, idempotencyKey: string): Promise<CreditMutationResponse> {
      const response = await http.post<CreditMutationResponse>('${paths.createCreditDemoTopUp}', payload, {
        headers: {'Idempotency-Key': idempotencyKey},
      });
      return response.data;
    },
    async createCreditTransfer(payload: CreditTransferRequest, idempotencyKey: string): Promise<CreditTransferResponse> {
      const response = await http.post<CreditTransferResponse>('${paths.createCreditTransfer}', payload, {
        headers: {'Idempotency-Key': idempotencyKey},
      });
      return response.data;
    },
    async listCharacterTree(projectId: ProjectId): Promise<CharacterTreeNode[]> {
      const response = await http.get<CharacterTreeNode[]>(projectPath('${paths.listTree}', projectId));
      return response.data;
    },
    async createCharacterTreeNode(projectId: ProjectId, payload: CharacterTreeCreateRequest): Promise<CharacterTreeNode> {
      const response = await http.post<CharacterTreeNode>(projectPath('${paths.createTree}', projectId), payload);
      return response.data;
    },
    async renameCharacterTreeNode(projectId: ProjectId, nodeId: string, payload: CharacterTreeUpdateRequest): Promise<CharacterTreeNode> {
      const response = await http.patch<CharacterTreeNode>(treeNodePath('${paths.renameTree}', projectId, nodeId), payload);
      return response.data;
    },
    async deleteCharacterTreeNode(projectId: ProjectId, nodeId: string): Promise<void> {
      await http.delete(treeNodePath('${paths.deleteTree}', projectId, nodeId));
    },
    async getProject(projectId: ProjectId): Promise<ProjectMutationResponse> {
      const response = await http.get<ProjectMutationResponse>(projectPath('${paths.getProject}', projectId));
      return response.data;
    },
    async createProject(payload: ProjectMutationRequest): Promise<ProjectMutationResponse> {
      const response = await http.post<ProjectMutationResponse>('${paths.createProject}', payload);
      return response.data;
    },
    async updateProject(projectId: ProjectId, payload: ProjectMutationRequest): Promise<ProjectMutationResponse> {
      const response = await http.patch<ProjectMutationResponse>(projectPath('${paths.updateProject}', projectId), payload);
      return response.data;
    },
    async createProjectInvitation(projectId: ProjectId, payload: ProjectInvitationRequest): Promise<ProjectInvitationResponse> {
      const response = await http.post<ProjectInvitationResponse>(projectPath('${paths.createInvitation}', projectId), payload);
      return response.data;
    },
  };
}

export type GeneratedApiClient = ReturnType<typeof createGeneratedApiClient>;
`;
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
