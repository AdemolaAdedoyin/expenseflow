import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the capabilities required by an endpoint. The guard resolves those
 * capabilities from the authenticated user's role, so controllers do not need
 * to know which concrete roles currently provide a capability.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
