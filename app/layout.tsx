import NextTopLoader from 'nextjs-toploader';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlobalProvider } from "@/lib/context/GlobalContext";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { ConfirmProvider } from "@/lib/ConfirmProvider";
import { FloatingDialogProvider } from "@/lib/FloatingDialog";
import GlobalLoading from "@/loading";
import { SidebarProvider } from "@/lib/sidebar/SidebarProvider";
import AppSideBarControler from "@/lib/sidebar/AppSideBarControler";
import { Toaster } from "sonner";
import RouteGuard from '@/lib/SignupUpdateGuard';
import GlobalLoaderController from '@/lib/context/GlobalLoaderController';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VitaHatchery",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`  font-sans antialiased`}
      >
        <NextTopLoader color="#2563eb" showSpinner={false} />
        <GlobalProvider>
          <RouteGuard />
          <GlobalLoaderController />

          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false} // Prevents the OS from overriding your light default
            disableTransitionOnChange
          >
            <ConfirmProvider>
              <FloatingDialogProvider>
                {/* <GlobalLoading /> */}

                <SidebarProvider>
                  <div className="flex h-screen">
                    <AppSideBarControler />
                    <main className="flex-1 overflow-y-auto w-full ">
                      {children}
                      </main>
                  </div>
                </SidebarProvider>
              </FloatingDialogProvider>

            </ConfirmProvider>
            <Toaster position='top-center' />
          </ThemeProvider>
        </GlobalProvider>
      </body>
    </html>
  );
}
