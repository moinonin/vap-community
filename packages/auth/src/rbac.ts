/**
 * RBAC Authorization (VAE Sprint 14)
 *
 * Role-based access control: admin, operator, reviewer, consumer, publisher.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const RoleSchema = z.enum(['ADMIN', 'OPERATOR', 'REVIEWER', 'CONSUMER', 'PUBLISHER']);
export type Role = z.infer<typeof RoleSchema>;

export const PermissionSchema = z.object({
  resource: z.string().min(1), // e.g., 'proofs', 'sessions', 'policies'
  action: z.enum(['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'REVOKE', 'EXPORT']),
  scope: z.enum(['OWN', 'TEAM', 'GLOBAL']).default('GLOBAL'),
});

export type Permission = z.infer<typeof PermissionSchema>;

export const RolePermissionSchema = z.object({
  role: RoleSchema,
  permissions: z.array(PermissionSchema),
});

export type RolePermission = z.infer<typeof RolePermissionSchema>;

export const UserContextSchema = z.object({
  principalId: z.string().min(1),
  roles: z.array(RoleSchema),
  scopes: z.array(z.string()).default([]),
  teamId: z.string().optional(),
  ownedResources: z.array(z.string()).default([]),
});

export type UserContext = z.infer<typeof UserContextSchema>;

export const AuthorizationRequestSchema = z.object({
  user: UserContextSchema,
  resource: z.string().min(1),
  action: z.enum(['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'REVOKE', 'EXPORT']),
  scope: z.enum(['OWN', 'TEAM', 'GLOBAL']).default('GLOBAL'),
  resourceId: z.string().optional(),
});

export type AuthorizationRequest = z.infer<typeof AuthorizationRequestSchema>;

export const AuthorizationResultSchema = z.object({
  allowed: z.boolean(),
  role: RoleSchema.optional(),
  permission: PermissionSchema.optional(),
  deniedReason: z.string().optional(),
});

export type AuthorizationResult = z.infer<typeof AuthorizationResultSchema>;

export interface RBAC {
  defineRolePermissions(rolePermissions: RolePermission[]): void;
  authorize(request: AuthorizationRequest): AuthorizationResult;
  hasPermission(user: UserContext, resource: string, action: string): boolean;
  getPermissionsForRole(role: Role): Permission[];
  listRoles(): Role[];
}

// ─── Default Role Permissions ─────────────────────────────────────────────────

const DEFAULT_PERMISSIONS: RolePermission[] = [
  {
    role: 'ADMIN',
    permissions: [
      { resource: '*', action: 'CREATE', scope: 'GLOBAL' },
      { resource: '*', action: 'READ', scope: 'GLOBAL' },
      { resource: '*', action: 'UPDATE', scope: 'GLOBAL' },
      { resource: '*', action: 'DELETE', scope: 'GLOBAL' },
      { resource: '*', action: 'APPROVE', scope: 'GLOBAL' },
      { resource: '*', action: 'REVOKE', scope: 'GLOBAL' },
      { resource: '*', action: 'EXPORT', scope: 'GLOBAL' },
    ],
  },
  {
    role: 'OPERATOR',
    permissions: [
      { resource: '*', action: 'CREATE', scope: 'GLOBAL' },
      { resource: '*', action: 'READ', scope: 'GLOBAL' },
      { resource: '*', action: 'UPDATE', scope: 'GLOBAL' },
      { resource: 'proofs', action: 'REVOKE', scope: 'GLOBAL' },
      { resource: '*', action: 'EXPORT', scope: 'GLOBAL' },
    ],
  },
  {
    role: 'REVIEWER',
    permissions: [
      { resource: '*', action: 'READ', scope: 'GLOBAL' },
      { resource: 'proofs', action: 'APPROVE', scope: 'GLOBAL' },
      { resource: 'sessions', action: 'READ', scope: 'GLOBAL' },
      { resource: 'evidence', action: 'READ', scope: 'GLOBAL' },
    ],
  },
  {
    role: 'PUBLISHER',
    permissions: [
      { resource: 'proofs', action: 'CREATE', scope: 'OWN' },
      { resource: 'proofs', action: 'READ', scope: 'TEAM' },
      { resource: 'sessions', action: 'CREATE', scope: 'OWN' },
      { resource: 'sessions', action: 'READ', scope: 'TEAM' },
      { resource: 'evidence', action: 'CREATE', scope: 'OWN' },
      { resource: 'evidence', action: 'READ', scope: 'TEAM' },
      { resource: 'content', action: 'CREATE', scope: 'OWN' },
      { resource: 'content', action: 'READ', scope: 'TEAM' },
      { resource: '*', action: 'EXPORT', scope: 'OWN' },
    ],
  },
  {
    role: 'CONSUMER',
    permissions: [
      { resource: 'proofs', action: 'READ', scope: 'GLOBAL' },
      { resource: 'content', action: 'READ', scope: 'GLOBAL' },
      { resource: 'sessions', action: 'READ', scope: 'OWN' },
    ],
  },
];

// ─── In-Memory RBAC ───────────────────────────────────────────────────────────

export class RBACEngine implements RBAC {
  private rolePermissions = new Map<Role, Permission[]>();

  defineRolePermissions(rolePermissions: RolePermission[]): void {
    for (const rp of rolePermissions) {
      this.rolePermissions.set(rp.role, rp.permissions);
    }
  }

  authorize(request: AuthorizationRequest): AuthorizationResult {
    const { user, resource, action, scope, resourceId } = request;

    for (const role of user.roles) {
      const permissions = this.rolePermissions.get(role);
      if (!permissions) continue;

      for (const perm of permissions) {
        // Check if permission matches
        const resourceMatch = perm.resource === '*' || perm.resource === resource;
        const actionMatch = perm.action === action;
        const scopeMatch = this.checkScope(perm.scope, scope, user, resourceId);

        if (resourceMatch && actionMatch && scopeMatch) {
          return {
            allowed: true,
            role,
            permission: perm,
          };
        }
      }
    }

    return {
      allowed: false,
      deniedReason: `No permission for ${action} on ${resource}`,
    };
  }

  hasPermission(user: UserContext, resource: string, action: string): boolean {
    const request: AuthorizationRequest = {
      user,
      resource,
      action: action as any,
      scope: 'GLOBAL',
    };
    return this.authorize(request).allowed;
  }

  getPermissionsForRole(role: Role): Permission[] {
    return this.rolePermissions.get(role) || [];
  }

  listRoles(): Role[] {
    return Array.from(this.rolePermissions.keys());
  }

  private checkScope(
    permScope: string,
    requestScope: string,
    user: UserContext,
    resourceId?: string
  ): boolean {
    if (permScope === 'GLOBAL') return true;
    if (permScope === 'TEAM' && user.teamId) return requestScope !== 'OWN';
    if (permScope === 'OWN') {
      if (requestScope === 'OWN' && resourceId) {
        return user.ownedResources.includes(resourceId);
      }
      if (requestScope === 'TEAM') return !!user.teamId;
      return true;
    }
    return false;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _rbac: RBAC | null = null;

export function getRBAC(): RBAC {
  if (!_rbac) {
    _rbac = new RBACEngine();
    _rbac.defineRolePermissions(DEFAULT_PERMISSIONS);
  }
  return _rbac;
}

export function setRBAC(rbac: RBAC): void {
  _rbac = rbac;
}
