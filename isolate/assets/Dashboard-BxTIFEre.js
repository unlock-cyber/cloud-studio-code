const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-Dvly7gtl.js","assets/index-BK-Z6Y1V.js","assets/framer-motion-BXbfwMjo.js","assets/react-vendor-DVxV5ELH.js","assets/radix-ui-Dp4gMc_0.js","assets/index-B92BElgy.css"])))=>i.map(i=>d[i]);
import{c as $,u as Re,a as de,d as h,e as me,f as ze,_ as Me,L as C,T as _e}from"./index-BK-Z6Y1V.js";import{j as e}from"./framer-motion-BXbfwMjo.js";import{d as Le,e as Fe,r}from"./react-vendor-DVxV5ELH.js";import{api as i}from"./api-IosdPhoJ.js";import{c as m,b as we,B as c}from"./button-DNUXPv4z.js";import{B as Oe}from"./BetaBadge-DPET0E_X.js";import{f as pe,P as ue,D as Be,a as Ue,b as $e,c as E,F as qe,d as He,C as Je,e as Ye,g as Ze,h as Ge,i as L,j as F,k as O,l as B,m as xe,n as U}from"./clientHelpers-CCVu0_zo.js";import{I as he}from"./input-pEiRYjcv.js";import{n as Qe,I as Ke,o as Ve,C as We,T as Xe,D as et,p as tt,A as st,P as at,O as nt}from"./radix-ui-Dp4gMc_0.js";import{B as rt}from"./badge-kQM0bNWk.js";import{u as ot,b as ge,s as fe}from"./guestContext-B-VkchM8.js";import{T as lt}from"./ThemeToggle-1d73mDbX.js";import{S as je}from"./square-terminal-CL2c8OKF.js";import{H as it,C as ct}from"./hard-drive-BGkfT9oL.js";import{T as dt}from"./trash-2-_ZoKsApt.js";import"./charts-CmOhng9k.js";const mt=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]],pt=$("ellipsis-vertical",mt);const ut=[["path",{d:"m10 17 5-5-5-5",key:"1bsop3"}],["path",{d:"M15 12H3",key:"6jk70r"}],["path",{d:"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",key:"u53s6r"}]],ye=$("log-in",ut);const xt=[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]],ht=$("upload",xt);function be({className:s,...a}){return e.jsx("div",{"data-slot":"card",className:m("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",s),...a})}function ve({className:s,...a}){return e.jsx("div",{"data-slot":"card-content",className:m("px-6",s),...a})}function gt({className:s,value:a,...d}){return e.jsx(Qe,{"data-slot":"progress",className:m("bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",s),...d,children:e.jsx(Ke,{"data-slot":"progress-indicator",className:"bg-primary h-full w-full flex-1 transition-all",style:{transform:`translateX(-${100-(a||0)}%)`}})})}function ft({...s}){return e.jsx(Ve,{"data-slot":"alert-dialog",...s})}function jt({...s}){return e.jsx(at,{"data-slot":"alert-dialog-portal",...s})}function yt({className:s,...a}){return e.jsx(nt,{"data-slot":"alert-dialog-overlay",className:m("data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",s),...a})}function bt({className:s,...a}){return e.jsxs(jt,{children:[e.jsx(yt,{}),e.jsx(We,{"data-slot":"alert-dialog-content",className:m("bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",s),...a})]})}function vt({className:s,...a}){return e.jsx("div",{"data-slot":"alert-dialog-header",className:m("flex flex-col gap-2 text-center sm:text-left",s),...a})}function Nt({className:s,...a}){return e.jsx("div",{"data-slot":"alert-dialog-footer",className:m("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",s),...a})}function wt({className:s,...a}){return e.jsx(Xe,{"data-slot":"alert-dialog-title",className:m("text-lg font-semibold",s),...a})}function kt({className:s,...a}){return e.jsx(et,{"data-slot":"alert-dialog-description",className:m("text-muted-foreground text-sm",s),...a})}function Ct({className:s,...a}){return e.jsx(st,{className:m(we(),s),...a})}function Et({className:s,...a}){return e.jsx(tt,{className:m(we({variant:"outline"}),s),...a})}const Tt=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Web App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <h1>Hello from Cloud Studio Code</h1>
    <p>Edit <code>index.html</code>, <code>style.css</code> and <code>script.js</code>, then hit <b>Run</b>.</p>
  </header>
  <main>
    <button id="btn">Click me</button>
    <p id="out"></p>
  </main>
  <script src="script.js"><\/script>
</body>
</html>
`,Ne=`:root {
  --bg: #0f172a;
  --card: #1e293b;
  --accent: #38bdf8;
  --text: #e2e8f0;
}
* { box-sizing: border-box; margin: 0; }
body {
  font-family: system-ui, sans-serif;
  background: linear-gradient(160deg, #0f172a, #1e293b);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1rem;
}
header { text-align: center; margin-bottom: 2rem; }
h1 { color: var(--accent); margin-bottom: 0.5rem; }
main {
  background: var(--card);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  text-align: center;
}
button {
  background: var(--accent);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  color: #0f172a;
  cursor: pointer;
  transition: transform 0.15s;
}
button:hover { transform: scale(1.05); }
#out { margin-top: 1rem; font-size: 1.1rem; }
`,Dt=`const btn = document.getElementById("btn");
const out = document.getElementById("out");
let count = 0;
btn.addEventListener("click", () => {
  count++;
  out.textContent = \`Clicked \${count} time\${count === 1 ? "" : "s"}\`;
  console.log("count is now", count);
});
console.log("script.js loaded");
`,At=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React App</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin><\/script>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="App.jsx"><\/script>
</body>
</html>
`,St=`function App() {
  const [count, setCount] = React.useState(0);
  return (
    <div className="card">
      <h1>React is live</h1>
      <p>Edit App.jsx and hit Run — the preview reloads.</p>
      <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
`,p={blank:{label:"Blank Project",language:"blank",entryFile:"README.md",files:[{path:"README.md",content:`# Blank Project

Start creating files. Runnable types: .py .js .ts .c .cpp .java .sh .sql — plus live preview for web projects.
`}]},web:{label:"HTML / CSS / JS",language:"html",entryFile:"index.html",files:[{path:"index.html",content:Tt},{path:"style.css",content:Ne},{path:"script.js",content:Dt}]},react:{label:"React (live preview)",language:"html",entryFile:"index.html",files:[{path:"index.html",content:At},{path:"App.jsx",content:St},{path:"style.css",content:Ne}]},ts:{label:"TypeScript",language:"ts",entryFile:"main.ts",files:[{path:"main.ts",content:`interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello \${user.name}, you are \${user.age}\`;
}

const users: User[] = [
  { name: "Ada", age: 36 },
  { name: "Alan", age: 41 },
];

for (const u of users) {
  console.log(greet(u));
}
`}]},python:{label:"Python",language:"python",entryFile:"main.py",files:[{path:"main.py",content:`import sys

print("Python", sys.version.split()[0])


def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


for i in range(10):
    print(f"fib({i}) = {fib(i)}")
`}]},c:{label:"C",language:"c",entryFile:"main.c",files:[{path:"main.c",content:`#include <stdio.h>

int main(void) {
    printf("Hello from C\\n");
    for (int i = 1; i <= 5; i++) {
        printf("%d squared = %d\\n", i, i * i);
    }
    return 0;
}
`}]},cpp:{label:"C++",language:"cpp",entryFile:"main.cpp",files:[{path:"main.cpp",content:`#include <iostream>
#include <vector>

int main() {
    std::vector<int> v = {1, 2, 3, 4, 5};
    int sum = 0;
    for (int x : v) sum += x;
    std::cout << "Hello from C++" << std::endl;
    std::cout << "sum = " << sum << std::endl;
    return 0;
}
`}]},java:{label:"Java",language:"java",entryFile:"Main.java",files:[{path:"Main.java",content:`public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
        for (int i = 1; i <= 5; i++) {
            System.out.println(i + " squared = " + (i * i));
        }
    }
}
`}]},node:{label:"Node.js style",language:"node",entryFile:"index.js",files:[{path:"index.js",content:`// Runs in the browser JS sandbox (Node-style console output).
const stack = new Error().stack;
console.log("JavaScript is running.");
console.log("Numbers:", [1, 2, 3].map((n) => n * 10));
`}]},sql:{label:"SQL (SQLite)",language:"sql",entryFile:"schema.sql",files:[{path:"schema.sql",content:`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);

INSERT OR IGNORE INTO users (name, email) VALUES
  ('Ada Lovelace', 'ada@example.com'),
  ('Alan Turing', 'alan@example.com');
`},{path:"query.sql",content:`SELECT * FROM users ORDER BY name;
`}]}},z=[{key:"web",...p.web},{key:"react",...p.react},{key:"python",...p.python},{key:"ts",...p.ts},{key:"node",...p.node},{key:"c",...p.c},{key:"cpp",...p.cpp},{key:"java",...p.java},{key:"sql",...p.sql},{key:"blank",...p.blank}],Pt={blank:"Blank",web:"HTML/CSS/JS",react:"React",ts:"TypeScript",python:"Python",c:"C",cpp:"C++",java:"Java",node:"Node.js",sql:"SQL",imported:"Imported"};function Gt(){const{user:s,signOut:a}=ot(),d=Le(),[T]=Fe(),{isAuthenticated:D}=Re(),A=de(i.projects.list,{}),l=de(i.workspaces.status,{}),q=h(i.projects.create),H=h(i.projects.rename),J=h(i.projects.remove),Y=h(i.projects.duplicate),Z=me(i.importExport.exportProjectZip),G=h(i.importExport.generateUploadUrl),Q=me(i.importExport.importZipAction),K=h(i.workspaces.touch),V=h(i.workspaces.getOrCreateWorkspace),[ke,j]=r.useState(!1),[y,Ce]=r.useState("web"),[b,W]=r.useState(""),[S,g]=r.useState(null),[f,v]=r.useState(null),[N,P]=r.useState(null),[X,ee]=r.useState(null),te=r.useRef(null),w=ze(),u=l?.kind==="guest";r.useEffect(()=>{if(u&&w&&l){const t=ge(w);t&&fe({workspaceId:l._id,sessionId:t})}},[u,w,l]);const o=r.useCallback(t=>{ee(t),window.setTimeout(()=>ee(null),3600)},[]),se=l!==void 0&&(l===null||l.expiredNow),ae=l?.expiredNow??!1,[ne,re]=r.useState(!1),[Ee,oe]=r.useState(!1),M=r.useRef(!1);r.useEffect(()=>{!D||!se||ne||M.current||(M.current=!0,re(!0),V().catch(()=>{window.setTimeout(()=>{M.current=!1},2500)}).finally(()=>re(!1)))},[D,se,ne,V]),r.useEffect(()=>{ae&&!T.get("expired")&&d("/dashboard?expired=1",{replace:!0})},[ae,d,T]),r.useEffect(()=>{T.get("expired")==="1"&&o("Your previous workspace expired and its data was deleted server-side.")},[T,o]),r.useEffect(()=>{if(!D)return;const t=window.setInterval(()=>{K().catch(()=>{})},6e4);return()=>window.clearInterval(t)},[D,K]);const le=r.useCallback(async()=>{if(b.trim()){g("create");try{const t=z.find(x=>x.key===y)??z[z.length-1],n=await q({name:b.trim(),template:y,language:t.language,files:t.files,entryFile:t.entryFile});j(!1),W(""),d(`/ide/${n}`)}catch(t){o(t instanceof Error?t.message:"Failed to create project")}finally{g(null)}}},[b,y,q,d,o]),ie=r.useCallback(async()=>{if(f)try{await H({projectId:f.id,name:f.name}),v(null)}catch(t){o(t instanceof Error?t.message:"Failed to rename")}},[f,H,o]),Te=r.useCallback(async()=>{if(N)try{await J({projectId:N.id}),P(null),o("Project deleted")}catch(t){o(t instanceof Error?t.message:"Failed to delete")}},[N,J,o]),De=r.useCallback(async t=>{try{await Y({projectId:t}),o("Project duplicated")}catch(n){o(n instanceof Error?n.message:"Failed to duplicate")}},[Y,o]),Ae=r.useCallback(async t=>{g(`export:${t}`);try{const n=await Z({projectId:t}),{ConvexHttpClient:x}=await Me(async()=>{const{ConvexHttpClient:k}=await import("./index-Dvly7gtl.js");return{ConvexHttpClient:k}},__vite__mapDeps([0,1,2,3,4,5])),R=await new x("https://steady-quail-599.convex.cloud").query(i.importExport.getDownloadUrl,{blobId:n.blobId});if(R){const k=document.createElement("a");k.href=R,k.download=n.name,k.click(),o(`Exported ${n.name}`)}else o("Could not fetch the download URL")}catch(n){o(n instanceof Error?n.message:"Export download failed")}finally{g(null)}},[Z,o]),Se=r.useCallback(async t=>{g("import");try{const n=await G(),x=await fetch(n,{method:"POST",headers:{"Content-Type":t.type||"application/zip"},body:t});if(!x.ok)throw new Error(`Upload failed (HTTP ${x.status})`);const{storageId:ce}=await x.json(),R=await Q({storageId:ce});o("Project imported"),d(`/ide/${R.projectId}`)}catch(n){o(n instanceof Error?n.message:"Import failed")}finally{g(null)}},[G,Q,d,o]);if(A===void 0||l===void 0)return e.jsx("div",{className:"flex min-h-screen items-center justify-center bg-background",children:e.jsx(C,{className:"size-6 animate-spin text-muted-foreground"})});if(l===null||l.expiredNow)return e.jsxs("div",{className:"flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-center",children:[e.jsx(C,{className:"size-5 animate-spin text-muted-foreground"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Preparing your workspace…"})]});const Pe=Math.min(100,l.usedBytes/l.storageLimitBytes*100),_=l.expiresAt-Date.now(),I=Math.max(0,_/36e5),Ie=I<1;return e.jsxs("div",{className:"min-h-screen bg-background text-foreground",children:[e.jsx("header",{className:"border-b border-border/60",children:e.jsxs("div",{className:"mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4",children:[e.jsxs("div",{className:"flex min-w-0 items-center gap-2",children:[e.jsx(je,{className:"size-5 shrink-0 text-primary"}),e.jsxs("span",{className:"inline-flex min-w-0 items-start gap-1",children:[e.jsx("span",{className:"truncate font-semibold",children:"Cloud Studio Code"}),e.jsx(Oe,{className:"-translate-y-1 shrink-0"})]})]}),e.jsxs("div",{className:"ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2",children:[e.jsx(rt,{variant:u?"secondary":"default",className:"hidden text-[11px] sm:inline-flex",children:u?"Guest workspace":"Registered workspace"}),s?.email&&e.jsx("span",{className:"hidden text-xs text-muted-foreground sm:inline",children:s.email}),e.jsx(lt,{}),!u&&e.jsx(c,{variant:"ghost",size:"sm",className:"h-8 gap-1.5",onClick:()=>a(),children:"Sign out"}),u&&e.jsxs(c,{size:"sm",className:"h-8 gap-1.5",onClick:()=>oe(!0),children:[e.jsx(ye,{className:"size-3.5"})," Create account"]})]})]})}),e.jsxs("main",{className:"mx-auto max-w-6xl px-3 py-8 sm:px-4",children:[e.jsxs("div",{className:"mb-8 flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 sm:flex-row sm:items-center",children:[e.jsxs("div",{className:"flex-1",children:[e.jsxs("div",{className:"mb-1 flex items-center gap-2",children:[e.jsx(it,{className:"size-4 text-muted-foreground"}),e.jsxs("span",{className:"text-sm font-medium",children:["Storage · ",pe(l.usedBytes)," / ",pe(l.storageLimitBytes)]})]}),e.jsx(gt,{value:Pe,className:"h-2"})]}),e.jsxs("div",{className:"flex items-center gap-2 text-sm text-muted-foreground",children:[e.jsx(ct,{className:"size-4"}),e.jsx("span",{className:Ie?"text-amber-500":"",children:_<=0?"Expired":I>=1?`${Math.floor(I)}h ${Math.floor(I%1*60)}m of inactivity left`:`${Math.floor(_/6e4)}m of inactivity left`})]})]}),e.jsxs("div",{className:"mb-6 flex flex-wrap items-center gap-2",children:[e.jsxs(c,{className:"gap-2",onClick:()=>j(!0),children:[e.jsx(ue,{className:"size-4"})," New Project"]}),e.jsxs(c,{variant:"outline",className:"gap-2",onClick:()=>te.current?.click(),children:[S==="import"?e.jsx(C,{className:"size-4 animate-spin"}):e.jsx(ht,{className:"size-4"})," Import ZIP"]}),e.jsx("input",{ref:te,type:"file",accept:".zip",className:"hidden",onChange:t=>{const n=t.target.files?.[0];n&&Se(n),t.target.value=""}})]}),e.jsxs("h2",{className:"mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground",children:["Your projects (",A.length,")"]}),A.length===0?e.jsx(be,{className:"border-dashed",children:e.jsxs(ve,{className:"flex flex-col items-center gap-3 py-12 text-center",children:[e.jsx(je,{className:"size-10 text-muted-foreground/40"}),e.jsx("p",{className:"font-medium",children:"No projects yet"}),e.jsx("p",{className:"max-w-sm text-sm text-muted-foreground",children:"Create your first project from a template — Python, C++, web preview, SQL and more. Or import an existing ZIP."}),e.jsxs(c,{className:"mt-2 gap-2",onClick:()=>j(!0),children:[e.jsx(ue,{className:"size-4"})," Create project"]})]})}):e.jsx("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",children:A.map(t=>e.jsx(be,{className:"group transition-colors hover:border-primary/40",children:e.jsxs(ve,{className:"p-4",children:[e.jsxs("div",{className:"flex items-start justify-between gap-2",children:[e.jsxs("button",{className:"min-w-0 flex-1 text-left",onClick:()=>d(`/ide/${t._id}`),children:[e.jsx("p",{className:"truncate font-medium group-hover:text-primary",children:t.name}),e.jsxs("p",{className:"mt-0.5 text-xs text-muted-foreground",children:[Pt[t.template]??t.template," · ",t.language]})]}),e.jsxs(Be,{children:[e.jsx(Ue,{asChild:!0,children:e.jsx(c,{variant:"ghost",size:"sm",className:"size-7 shrink-0 p-0",children:e.jsx(pt,{className:"size-4"})})}),e.jsxs($e,{align:"end",className:"w-44",children:[e.jsxs(E,{onClick:()=>d(`/ide/${t._id}`),children:[e.jsx(qe,{className:"mr-2 size-3.5"})," Open"]}),e.jsxs(E,{onClick:()=>v({id:t._id,name:t.name}),children:[e.jsx(He,{className:"mr-2 size-3.5"})," Rename"]}),e.jsxs(E,{onClick:()=>De(t._id),children:[e.jsx(Je,{className:"mr-2 size-3.5"})," Duplicate"]}),e.jsxs(E,{onClick:()=>Ae(t._id),children:[S===`export:${t._id}`?e.jsx(C,{className:"mr-2 size-3.5 animate-spin"}):e.jsx(Ye,{className:"mr-2 size-3.5"}),"Export ZIP"]}),e.jsx(Ze,{}),e.jsxs(E,{className:"text-destructive focus:text-destructive",onClick:()=>P({id:t._id,name:t.name}),children:[e.jsx(dt,{className:"mr-2 size-3.5"})," Delete"]})]})]})]}),e.jsxs("p",{className:"mt-3 text-[11px] text-muted-foreground",children:["Last opened ",Ge(t.lastOpenedAt)]})]})},t._id))})]}),e.jsx(L,{open:ke,onOpenChange:j,children:e.jsxs(F,{className:"max-w-lg",children:[e.jsxs(O,{children:[e.jsx(B,{children:"New project"}),e.jsx(xe,{children:"Pick a template — each generates a real, runnable starter."})]}),e.jsxs("div",{className:"grid max-h-[320px] grid-cols-2 gap-2 overflow-auto py-1 sm:grid-cols-3",children:[z.map(t=>e.jsxs("button",{className:`rounded-lg border p-3 text-left transition-colors ${y===t.key?"border-primary bg-primary/5":"border-border/60 hover:border-primary/40"}`,onClick:()=>Ce(t.key),children:[e.jsx("p",{className:"text-sm font-medium",children:t.label}),e.jsxs("p",{className:"mt-0.5 line-clamp-2 text-[11px] text-muted-foreground",children:["entry: ",t.entryFile]})]},t.key)),y==="__hint"&&e.jsx("span",{})]}),"          ",e.jsx(he,{placeholder:"Project name",value:b,onChange:t=>W(t.target.value),onKeyDown:t=>t.key==="Enter"&&le()}),e.jsxs(U,{children:[e.jsx(c,{variant:"ghost",onClick:()=>j(!1),children:"Cancel"}),e.jsx(c,{onClick:le,disabled:!b.trim()||S==="create",children:S==="create"?e.jsx(C,{className:"size-4 animate-spin"}):"Create project"})]})]})}),e.jsx(L,{open:f!==null,onOpenChange:t=>!t&&v(null),children:e.jsxs(F,{className:"max-w-sm",children:[e.jsx(O,{children:e.jsx(B,{children:"Rename project"})}),e.jsx(he,{autoFocus:!0,value:f?.name??"",onChange:t=>v(n=>n&&{...n,name:t.target.value}),onKeyDown:t=>t.key==="Enter"&&ie()}),e.jsxs(U,{children:[e.jsx(c,{variant:"ghost",onClick:()=>v(null),children:"Cancel"}),e.jsx(c,{onClick:ie,children:"Rename"})]})]})}),e.jsx(L,{open:N!==null,onOpenChange:t=>!t&&P(null),children:e.jsxs(F,{className:"max-w-sm",children:[e.jsxs(O,{children:[e.jsxs(B,{className:"flex items-center gap-2",children:[e.jsx(_e,{className:"size-4 text-destructive"})," Delete project"]}),e.jsxs(xe,{children:['"',N?.name,'" and all of its files will be permanently deleted.']})]}),e.jsxs(U,{children:[e.jsx(c,{variant:"ghost",onClick:()=>P(null),children:"Cancel"}),e.jsx(c,{variant:"destructive",onClick:Te,children:"Delete"})]})]})}),e.jsx(ft,{open:Ee,onOpenChange:oe,children:e.jsxs(bt,{className:"max-w-md",children:[e.jsxs(vt,{children:[e.jsxs(wt,{className:"flex items-center gap-2",children:[e.jsx(ye,{className:"size-4 text-emerald-600 dark:text-emerald-400"})," Switch to a registered account?"]}),e.jsxs(kt,{className:"space-y-2 text-left leading-relaxed",children:[e.jsxs("span",{className:"block",children:["You are currently in a ",e.jsx("strong",{children:"guest workspace"}),". Creating an account will sign you in and transfer your guest projects and files into your new account automatically."]}),e.jsxs("span",{className:"block",children:["As a precaution, we recommend ",e.jsx("strong",{children:"exporting your projects"})," first — exported projects can be imported again later at any time."]})]})]}),e.jsxs(Nt,{children:[e.jsx(Et,{children:"Cancel"}),e.jsx(Ct,{className:"bg-emerald-600 text-white hover:bg-emerald-500",onClick:()=>{if(u&&w&&l){const t=ge(w);t&&fe({workspaceId:l._id,sessionId:t})}d("/auth")},children:"Continue"})]})]})}),X&&e.jsx("div",{className:"fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg",children:X})]})}export{Gt as default};
