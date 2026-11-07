import axios from "axios";
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15000,
});
export type Profile = {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  roles: string[];
};
export async function csrf() {
  const { data } = await api.get<{ token: string; headerName: string }>(
    "/auth/csrf",
  );
  return { [data.headerName]: data.token };
}
export async function login(email: string, password: string) {
  await api.post("/auth/login", new URLSearchParams({ email, password }), {
    headers: await csrf(),
  });
  return (await api.get<Profile>("/auth/me")).data;
}
export async function logout() {
  await api.post("/auth/logout", null, { headers: await csrf() });
}
export function message(error: unknown) {
  return axios.isAxiosError(error)
    ? (error.response?.data?.message ??
        "Cannot reach the server. Check the backend and try again.")
    : "Something went wrong. Please try again.";
}
