import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Provider } from "./Provider";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "QueryFi",
  description: "RAG powered finance assistant built with Next.js, Node/express, FastAPI and MongoDB.",
};

// Dark is the default; drop it before first paint if the user saved light mode (see ThemeToggle)
const THEME_SCRIPT = `(function(){try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${poppins.variable} bg-surface text-ink antialiased`}
      >
        <Provider>
            {children}
        </Provider>
      </body>
    </html>
  );
}
