import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

type MMCConfig = {
  backendUrl: string;
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const CONFIG_PATH = join(homedir(), ".config", "molcrafts", "config.toml");

let appConfig: MMCConfig = { backendUrl: DEFAULT_BACKEND_URL };
let configLoaded = false;

function extractBackendUrl(parsedConfig: any): string | null {
  const candidate = parsedConfig.backend?.backend_url;

  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  return null;
}

export async function initializeConfig(): Promise<MMCConfig> {
  if (configLoaded) return appConfig;

  try {
    const fileContent = await readFile(CONFIG_PATH, "utf-8");
    const parsed = Bun.TOML.parse(fileContent);
    const configuredUrl = extractBackendUrl(parsed);

    if (configuredUrl) {
      appConfig = { ...appConfig, backendUrl: configuredUrl };
      configLoaded = true;
      return appConfig;
    }

    console.warn(
      `[config] backend_url not found in ${CONFIG_PATH}, using default ${DEFAULT_BACKEND_URL}`,
    );
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
