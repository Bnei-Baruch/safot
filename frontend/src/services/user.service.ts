import { httpService } from './http.service';
import { User } from '../types/frontend-types';

class UserService {
  async getUsers(search?: string): Promise<User[]> {
    const url = search ? `/users?search=${encodeURIComponent(search)}` : '/users';
    return httpService.get<User[]>(url);
  }

  async getAvailableRoles(): Promise<string[]> {
    return httpService.get<string[]>('/roles');
  }

  async updateUserRoles(userId: string, roles: string[]): Promise<void> {
    return httpService.put(`/users/${userId}/roles`, { roles });
  }
}

export const userService = new UserService();
