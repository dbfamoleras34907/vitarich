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
import InternetErrorToast from '@/components/InternetErrorToast';
import RouteGuard from '@/lib/SignupUpdateGuard';
import GlobalLoaderController from '@/lib/context/GlobalLoaderController';
import DefaultFarm from './utils/DefaultFarm';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vita FMS",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full overflow-hidden print:h-auto print:overflow-visible"
    >
      <body
        className="h-full overflow-hidden font-sans antialiased print:h-auto print:overflow-visible"
      >
        <NextTopLoader color="#00754A" showSpinner={false} />
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
                  <div className="flex h-dvh overflow-hidden bg-background print:h-auto print:overflow-visible">
                    <AppSideBarControler />
                    <main className="h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto print:h-auto print:overflow-visible">
                        {children}
                    </main>
                  </div>
                </SidebarProvider>
                <DefaultFarm/>
              </FloatingDialogProvider>

            </ConfirmProvider>
            <InternetErrorToast />
            <Toaster position='top-center' />
          </ThemeProvider>
        </GlobalProvider>


      </body>
    </html>
  );
}
