import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import type { SpinnerSize } from "./ui/spinner.ts";

type MMCConfig = {
  backendUrl: string;
  spinnerSize: SpinnerSize;
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const DEFAULT_SPINNER_SIZE: SpinnerSize = "tiny";
const CONFIG_PATH = join(homedir(), ".config", "molcrafts", "config.toml");

let appConfig: MMCConfig = {
  backendUrl: DEFAULT_BACKEND_URL,
  spinnerSize: DEFAULT_SPINNER_SIZE,
};
let configLoaded = false;

function extractBackendUrl(parsedConfig: any): string | null {
  const candidate = parsedConfig.backend?.backend_url;

  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  return null;
}

function extractSpinnerSize(parsedConfig: any): SpinnerSize | null {
  const candidate = parsedConfig.ui?.spinner_size ?? parsedConfig.ui?.spinnerSize;

  if (typeof candidate !== "string") return null;

  const normalized = candidate.trim().toLowerCase();
  if (normalized === "tiny" || normalized === "medium" || normalized === "large") {
    return normalized as SpinnerSize;
  }

  return null;
}

export async function initializeConfig(): Promise<MMCConfig> {
  if (configLoaded) return appConfig;

  try {
    const fileContent = await readFile(CONFIG_PATH, "utf-8");
    const parsed = Bun.TOML.parse(fileContent);
    const configuredUrl = extractBackendUrl(parsed);
    const spinnerSize = extractSpinnerSize(parsed);

    if (configuredUrl) {
      appConfig = { ...appConfig, backendUrl: configuredUrl };
    } else {
      console.warn(
        `[config] backend_url not found in ${CONFIG_PATH}, using default ${DEFAULT_BACKEND_URL}`,
      );
    }

    if (spinnerSize) {
      appConfig = { ...appConfig, spinnerSize };
    }

    configLoaded = true;
    return appConfig;
  } catch (error) {
    console.warn(
      `[config] Unable to read configuration at ${CONFIG_PATH}; using default: ${String(
        error,
      )}`,
    );
  }

  configLoaded = true;
  appConfig = { ...appConfig, backendUrl: DEFAULT_BACKEND_URL };
  return appConfig;
}

export function getBackendUrl(): string {
  return appConfig.backendUrl;
}

export function getConfig(): MMCConfig {
  return appConfig;
}
