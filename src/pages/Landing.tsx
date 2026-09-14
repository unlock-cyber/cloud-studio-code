import { motion } from "framer-motion";
import {
  ArrowRight,
  TerminalSquare,
  Play,
  Globe,
  FileCode2,
  Database,
  Shield,
  Zap,
  Cpu,
  Languages,
  Clock,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router";

const FEATURES = [
  {
    icon: Cpu,
    title: "Real execution",
    desc: "Python on actual CPython (WebAssembly), C/C++ on GCC, Java on OpenJDK — compiled and run in isolated sandboxes with real stdout, stderr and exit codes.",
  },
  {
    icon: Globe,
    title: "Live web preview",
    desc: "HTML/CSS/JS and React projects render in a sandboxed preview. Edit, hit Run, see it instantly — runtime errors surface in the terminal.",
  },
  {
    icon: FileCode2,
    title: "Pro editor",
    desc: "Monaco with syntax highlighting for 15+ languages, multi-cursor, search & replace, folding, and per-workspace font/wrap settings.",
  },
  {
    icon: Database,
    title: "Real SQLite",
    desc: "Run SQL on an actual SQLite engine. Schemas persist per project — your tables survive between sessions.",
  },
  {
    icon: Shield,
    title: "Sandboxed & isolated",
    desc: "Your code runs in Web Workers, sandboxed iframes, or remote compiler sandboxes. Workspaces are private and quota-enforced server-side.",
  },
  {
    icon: Zap,
    title: "Zero setup",
    desc: "No Docker, no installs, no API keys. Open a browser, create a project, run code — from a Chromebook or a locked-down work laptop.",
  },
];

const LANGS = [
  { name: "Python", mode: "CPython WASM" },
  { name: "JavaScript", mode: "Browser VM" },
  { name: "TypeScript", mode: "esbuild → JS" },
  { name: "C", mode: "GCC sandbox" },
  { name: "C++", mode: "G++ sandbox" },
  { name: "Java", mode: "OpenJDK sandbox" },
  { name: "Bash", mode: "Shell sandbox" },
  { name: "SQL", mode: "SQLite WASM" },
  { name: "HTML/CSS", mode: "Live preview" },
  { name: "React", mode: "Live preview" },
  { name: "JSON/YAML/XML", mode: "Inspector" },
  { name: "Markdown", mode: "Rendered view" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0E14] text-zinc-200">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0A0E14]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <div className="flex items-center gap-2">
            <TerminalSquare className="size-5 text-emerald-400" />
            <span className="font-semibold text-zinc-100">Cloud Code Studio</span>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 text-zinc-400 hover:text-zinc-100" onClick={() => navigate("/auth?returnTo=/dashboard")}>
              Sign in
            </Button>
            <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate("/auth?returnTo=/dashboard")}>
              Start coding
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 300px at 20% 0%, rgba(16,185,129,0.12), transparent), radial-gradient(600px 300px at 80% 10%, rgba(56,189,248,0.10), transparent)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-16 lg:grid-cols-2 lg:items-center lg:pt-24">
          <div>
            <Badge className="mb-5 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              A real IDE in your browser
            </Badge>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
              Write, run and ship code
              <span className="text-emerald-400"> without leaving the tab</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-400">
              Cloud Code Studio compiles and executes your code for real — Python, C++, Java, TypeScript, SQL and live web previews — in sandboxed runtimes. Projects, files and sessions persist in the cloud.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate("/auth?returnTo=/dashboard")}>
                Start coding free <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2 border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10" onClick={() => navigate("/auth?returnTo=/dashboard")}>
                Continue as guest
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5"><HardDrive className="size-3.5" /> 50 MB guest · 150 MB registered</span>
              <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> Server-side workspace expiry</span>
              <span className="flex items-center gap-1.5"><Languages className="size-3.5" /> 12+ languages</span>
            </div>
          </div>

          {/* Terminal mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="rounded-xl border border-white/10 bg-[#0D1117] shadow-2xl"
          >
            <div className="flex h-8 items-center gap-1.5 border-b border-white/5 px-3">
              <span className="size-2.5 rounded-full bg-red-500/70" />
              <span className="size-2.5 rounded-full bg-amber-500/70" />
              <span className="size-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-[11px] text-zinc-500">main.py — Cloud Code Studio</span>
            </div>
            <div className="p-4 font-mono text-[12.5px] leading-relaxed">
              <p><span className="text-zinc-500">$</span> <span className="text-emerald-400">run main.py</span></p>
              <p className="mt-2 text-zinc-300">Python 3.12.0</p>
              <p className="text-zinc-300">fib(0) = 0</p>
              <p className="text-zinc-300">fib(1) = 1</p>
              <p className="text-zinc-300">fib(2) = 1</p>
              <p className="text-zinc-300">fib(3) = 2</p>
              <p className="text-zinc-300">fib(4) = 3</p>
              <p className="text-zinc-300">fib(5) = 5</p>
              <p className="mt-2 text-zinc-500">Process finished with exit code 0</p>
              <p className="mt-3"><span className="text-zinc-500">$</span> <span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-emerald-400" /></p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-white/5 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-zinc-100">Everything a real IDE does</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Not a toy. Files, builds, runs, previews and persistence — actually working end to end.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:border-emerald-500/20 hover:bg-white/[0.04]">
                <f.icon className="size-5 text-emerald-400" />
                <h3 className="mt-3 font-semibold text-zinc-100">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="border-t border-white/5 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-zinc-100">Languages that actually run</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {LANGS.map((l) => (
              <div key={l.name} className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <p className="text-sm font-medium text-zinc-200">{l.name}</p>
                <p className="text-[11px] text-zinc-500">{l.mode}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            Compiled languages run on a remote GCC/OpenJDK sandbox; browser runtimes execute locally in your tab via WebAssembly.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-zinc-50">Ready to write some code?</h2>
          <p className="mt-3 text-sm text-zinc-400">
            Start instantly as a guest — no signup wall. Create an account to keep your workspace for 24 hours of inactivity.
          </p>
          <Button size="lg" className="mt-6 gap-2 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate("/auth?returnTo=/dashboard")}>
            <Play className="size-4 fill-current" /> Launch the IDE
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-zinc-600">
          <span>Cloud Code Studio</span>
          <span>Python · C++ · Java · TypeScript · SQL · Web</span>
        </div>
      </footer>
    </div>
  );
}
