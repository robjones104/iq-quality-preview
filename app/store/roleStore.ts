import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_ROLE, ROLES, capabilitiesFor, type Role, type RoleCapabilities } from '@/lib/roles';

type RoleStore = {
  role: Role;
  setRole: (role: Role) => void;
};

export const useRoleStore = create<RoleStore>()(
  persist(
    (set) => ({
      role: DEFAULT_ROLE,
      setRole: (role) => set({ role }),
    }),
    {
      name: 'iq-quality-role',
      onRehydrateStorage: () => (state) => {
        // A persisted value for a role that no longer exists (e.g. the removed
        // App Manager) falls back to the default.
        if (state && !ROLES.includes(state.role)) state.role = DEFAULT_ROLE;
      },
    }
  )
);

/** Current role's capabilities. Convenience hook for gating UI. */
export function useCapabilities(): RoleCapabilities {
  const role = useRoleStore((s) => s.role);
  return capabilitiesFor(role);
}
