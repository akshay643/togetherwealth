export const DEMO_SESSION_COOKIE = "tw_demo_session";
export const DEMO_EMAIL = "alex@demo.togetherwealth.app";
export const DEMO_PASSWORD = "demo-password-123";

export function isDemoLogin(email: string, password: string) {
  return (
    email.trim().toLowerCase() === DEMO_EMAIL &&
    password === DEMO_PASSWORD
  );
}

export function demoEnabled() {
  return process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED !== "false";
}
