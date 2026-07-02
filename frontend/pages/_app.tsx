import type { AppProps } from "next/app";
import "../styles/globals.css";
import { StoreProvider } from "../lib/store";
import { Toaster } from "sonner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2000,
          style: {
            background: "#2f6fed",
            color: "#fff",
            border: "none",
          },
        }}
      />
    </StoreProvider>
  );
}
