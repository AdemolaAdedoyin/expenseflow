import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, department: true, managerId: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }
}
