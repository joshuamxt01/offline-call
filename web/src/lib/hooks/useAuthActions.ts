"use client";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/store/auth";
import { getOrCreateIdentity, createFreshIdentity } from "@/lib/crypto/e2ee";

export function useAuthActions() {
  const router = useRouter();
  const { setSession, clear, refreshToken } = useAuthStore();

  async function login(emailOrUsername: string, password: string) {
    const identity = await getOrCreateIdentity();
    const result = await authApi.login({
      emailOrUsername,
      password,
      platform: "web",
      identityPub: identity.publicKey,
      deviceName: browserName(),
    });
    setSession(result);
    router.replace("/chats");
    return result;
  }

  async function register(username: string, email: string, password: string) {
    const identity = await createFreshIdentity();
    const result = await authApi.register({
      username,
      email,
      password,
      platform: "web",
      identityPub: identity.publicKey,
      deviceName: browserName(),
    });
    setSession(result);
    router.replace("/chats");
    return result;
  }

  async function logout() {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    clear();
    router.replace("/login");
  }

  return { login, register, logout };
}

function browserName(): string {
  if (typeof navigator === "undefined") return "Web";
  const ua = navigator.userAgent;
  const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Web";
  const os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
