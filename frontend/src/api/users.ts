import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";

import { api, type Envelope, type Paginated } from "@/api/client";
import type { Role, User } from "@/types/auth";

export interface UserCreate {
  email: string;
  password: string;
  full_name?: string;
  role?: Role;
  env_id?: string;
}

export interface UserUpdate {
  password?: string;
  full_name?: string;
  role?: Role;
  is_active?: boolean;
  env_id?: string;
}

export function useUsers(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["users", "list", page] as const,
    queryFn: async () => {
      const res = await api.get<Envelope<Paginated<User>>>("/users", {
        params: { page, page_size: pageSize },
      });
      return res.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["users", "list"] });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (body: UserCreate) => {
      const res = await api.post<Envelope<User>>("/users", body);
      return res.data.data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UserUpdate }) => {
      const res = await api.patch<Envelope<User>>(`/users/${id}`, body);
      return res.data.data;
    },
    onSuccess: () => invalidate(),
  });
}
