import { ToastProvider } from "@/components/backoffice/Toast";

// Wraps both the login page and the signed-in shell so every back-office screen can toast.
export default function BackofficeRootLayout({ children }: LayoutProps<"/backoffice">) {
  return <ToastProvider>{children}</ToastProvider>;
}
