import type { NonprofitDataProvider } from "./types";
import { MockProvider } from "./mock-provider";

// Switch provider via NEXT_PUBLIC_DATA_PROVIDER env var.
// Supported values: "mock" (default) | "propublica" | "irs"
function createProvider(): NonprofitDataProvider {
  const name = process.env.NEXT_PUBLIC_DATA_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return new MockProvider();
    // Placeholder — swap in a real ProPublicaProvider here:
    // case "propublica":
    //   return new ProPublicaProvider();
    default:
      return new MockProvider();
  }
}

export const dataProvider: NonprofitDataProvider = createProvider();
export type { NonprofitDataProvider } from "./types";
