import { useCallback } from "react";
import {
  deleteUser,
  getUsers,
  registerUser,
  updateUser,
  updateUserStatus
} from "../services/api";

export function useUsers() {
  const fetchUsers = useCallback(() => getUsers(), []);
  const createUser = useCallback((data) => registerUser(data), []);
  const editUser = useCallback((id, data) => updateUser(id, data), []);
  const editUserStatus = useCallback((id, data) => updateUserStatus(id, data), []);
  const removeUser = useCallback((id) => deleteUser(id), []);

  return {
    fetchUsers,
    createUser,
    editUser,
    editUserStatus,
    removeUser
  };
}

export default useUsers;
