import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to one or more roles. The JwtAuthGuard must be applied
 * upstream (so req.user is set).
 *
 * Example:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('MANAGING_PARTNER', 'PARTNER')
 *   @Post(':id/archive')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
