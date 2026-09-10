export type UserRole = 'ADMIN' | 'FINANCE' | 'MANAGER' | 'EMPLOYEE';

export type OrganizationSummary = {
  id?: string;
  name: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string;
  organization?: OrganizationSummary;
};

export type LoginResponse = {
  accessToken: string;
  user: CurrentUser;
};
