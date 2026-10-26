import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import tsconfigPaths from "vite-tsconfig-paths"

import { tanstackStart } from "@tanstack/react-start/plugin/vite"

import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig({
  // Keep the prerender server and its fetch client on the same loopback address
  // in containers where localhost resolves to both IPv4 and IPv6.
  preview: { host: "127.0.0.1" },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
      router: {
        routeFileIgnorePattern: "\\.test\\.",
      },
    }),
    viteReact(),
  ],
})

export default config
