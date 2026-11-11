import type { StorybookConfig } from "@storybook/react-vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import tsconfigPaths from "vite-tsconfig-paths"
import type { Plugin } from "vite"

// The app's Start plugin normally replaces server functions in the client build.
// Storybook uses a separate Vite config, so keep those calls local and inert.
function serverFunctionStubs(): Plugin {
  return {
    name: "storybook-server-function-stubs",
    enforce: "pre",
    resolveId(source) {
      if (source === "@tanstack/react-start") return "\0storybook-start"
      const match = /(?:^|\/)functions\/([\w]+)$/.exec(source)
      return match ? `\0storybook-server:${match[1]}` : undefined
    },
    load(id) {
      if (id === "\0storybook-start")
        return "export const createClientOnlyFn = (fn) => fn"
      if (!id.startsWith("\0storybook-server:")) return
      const name = id.slice("\0storybook-server:".length)
      if (name === "generatePlan")
        return "export const generatePlanFn = () => new Promise(() => {})"
      return `export const ${name}Fn = async () => { throw new Error("Server calls are disabled in Storybook") }`
    },
  }
}
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],

  framework: {
    name: "@storybook/react-vite",
    options: { builder: { viteConfigPath: ".storybook/vite.config.ts" } },
  },

  viteFinal: (config) =>
    Promise.resolve({
      ...config,
      plugins: [
        serverFunctionStubs(),
        ...(config.plugins ?? []),
        react(),
        tailwindcss(),
        tsconfigPaths({ projects: ["./tsconfig.json"] }),
      ],
    }),

  addons: [
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
  ],
}
export default config
