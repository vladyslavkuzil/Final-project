import type { AppProps } from "next/app";
import "../styles/globals.css";
import { StoreProvider } from "../lib/store";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider>
      <Component {...pageProps} />
    </StoreProvider>
  );
}
