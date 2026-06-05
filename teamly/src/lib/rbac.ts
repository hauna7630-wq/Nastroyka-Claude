// Role-based access control matrix (workspace-scoped). Pure + testable.

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export type Action =
  | 'page.read'
  | 'page.write'
  | 'page.delete'
  | 'comment.create'
  | 'space.manage'
  | 'workspace.manage'
  | 'member.manage';

const MATRIX: Record<Role, ReadonlySet<Action>> = {
  viewer: new Set<Action>(['page.read', 'comment.create']),
  editor: new Set<Action>(['page.read', 'page.write', 'page.delete', 'comment.create']),
  admin: new Set<Action>([
    'page.read',
    'page.write',
    'page.delete',
    'comment.create',
    'space.manage',
    'member.manage',
  ]),
  owner: new Set<Action>([
    'page.read',
    'page.write',
    'page.delete',
    'comment.create',
    'space.manage',
    'member.manage',
    'workspace.manage',
  ]),
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].has(action);
}

export class ForbiddenError extends Error {
  constructor(role: Role, action: Action) {
    super(`Forbidden: role "${role}" cannot perform "${action}"`);
    this.name = 'ForbiddenError';
  }
}

export function authorize(role: Role, action: Action): void {
  if (!can(role, action)) throw new ForbiddenError(role, action);
}
