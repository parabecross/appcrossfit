import { LoginForm } from "@/components/auth/login-form";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-36 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-950/20 via-background to-background">
      <LoginForm />
      <InstallAppPrompt placement="auth" />
    </div>
  );
}
