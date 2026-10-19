import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { StartClient } from "@tanstack/react-start/client"

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  )
})

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting)
          window.dispatchEvent(new Event("strength-update-waiting"))
        registration.addEventListener("updatefound", () => {
          registration.installing?.addEventListener("statechange", () => {
            if (registration.waiting)
              window.dispatchEvent(new Event("strength-update-waiting"))
          })
        })
      })
      .catch(() => undefined)
  })
}
