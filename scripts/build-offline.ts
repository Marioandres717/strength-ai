import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const directory = resolve("dist/client")
function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(path, entry.name))
      : [join(path, entry.name)]
  )
}
const shellCandidates = ["_shell.html", "index.html"]
const shell = shellCandidates.find((name) => existsSync(join(directory, name)))
if (!shell) throw new Error("SPA shell was not emitted by TanStack Start.")
const assets = files(directory).filter(
  (file) => !file.endsWith("sw.js") && !file.endsWith(".map")
)
const version = createHash("sha256")
  .update(
    assets
      .map((file) => readFileSync(file))
      .reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0))
  )
  .digest("hex")
  .slice(0, 16)
const urls = assets.map(
  (file) => `/${relative(directory, file).replaceAll("\\", "/")}`
)
writeFileSync(
  join(directory, "offline-assets.json"),
  JSON.stringify({ version, shell: `/${shell}`, assets: urls })
)
writeFileSync(
  join(directory, "sw.js"),
  `
const CACHE=${JSON.stringify(`strength-ai-shell-${version}`)};
const ASSETS=${JSON.stringify(urls)};
const SHELL=${JSON.stringify(`/${shell}`)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)))});
// Waiting updates activate only on a later cold launch, never halfway through a workout.
// Old caches are deliberately retained: a tab can still reference chunks from its build.
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('message',event=>{if(event.data==='SHELL_STATUS')event.ports[0]?.postMessage({ready:true,version:${JSON.stringify(version)}})});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/_server')||url.pathname.startsWith('/api')||url.pathname==='/healthz')return;
 if(request.mode==='navigate'){
   event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match(SHELL)).then(response=>response||Response.error())));return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(response=>response||fetch(request)));
});
`
)
console.warn(`Offline shell ${version}: ${urls.length} precached assets.`)
