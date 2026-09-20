import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/");
            }}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <div className="pt-10 pb-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
          <p className="mt-3 text-muted-foreground">Effective date: 20 September 2026</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            These terms apply to your use of Cloud Studio Code. Please read them before
            using the platform.
          </p>
        </div>

        <Section title="Acceptance of terms">
          <p>
            By accessing or using Cloud Studio Code — including as a guest — you agree
            to these Terms of Service. If you do not agree, please do not use the
            platform.
          </p>
        </Section>

        <Section title="What Cloud Studio Code is">
          <p>
            Cloud Studio Code is a free, browser-based development environment. It
            lets you create projects, write and edit code, run programs in supported
            languages, preview web projects, and store your work in a cloud workspace.
            No installation or local toolchain is required.
          </p>
        </Section>

        <Section title="BETA status">
          <p>
            Cloud Studio Code is currently in BETA and under active development. That
            means features may change, break, or be removed, data may be affected by
            bugs or migrations, and availability is not guaranteed. Please export your
            projects regularly if their contents matter to you.
          </p>
        </Section>

        <Section title="Your projects and content">
          <p>
            You are responsible for the projects, code, files, and any other content
            you create, upload, or run in Cloud Studio Code, and for keeping your own
            copies of anything important to you.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree to use the platform for lawful development purposes and to:</p>
          <Bullets
            items={[
              "Respect the resource limits built into the sandboxed execution environment.",
              "Use your own workspace only, and not attempt to access other users' workspaces or data.",
              "Keep your authentication credentials to yourself.",
            ]}
          />
        </Section>

        <Section title="Prohibited use">
          <p>You may not use Cloud Studio Code to:</p>
          <Bullets
            items={[
              "Run malware, attack other systems or users, or perform illegal activity.",
              "Attempt to escape, overload, or abuse the sandbox or its resource limits.",
              "Interfere with the platform's operation, probe for vulnerabilities maliciously, or attempt unauthorized access to its infrastructure or private areas.",
              "Store or distribute unlawful content, or content that infringes others' rights.",
              "Use the service in any way that violates applicable law.",
            ]}
          />
        </Section>

        <Section title="Guest and registered workspaces">
          <p>
            You can start using the platform immediately as a guest. Guest workspaces
            are temporary: they expire after 1 hour of inactivity. Registered accounts
            get a workspace that stays available with regular use; it expires after 24
            hours of inactivity and is refreshed automatically when you use the
            platform.
          </p>
          <p>
            Workspace and project data is not permanently retained. Inactive workspaces
            are removed, and because the service is in BETA, data may also be lost due
            to bugs, migrations, or operational issues. Export your projects (ZIP
            export) for anything you want to keep safely.
          </p>
        </Section>

        <Section title="Code execution and the sandbox">
          <p>
            Code you run — and web projects you preview — executes in a sandboxed
            environment that is isolated per workspace and subject to resource limits.
            Long-running or resource-heavy programs may be stopped, package
            installation is not available, and live previews are designed for
            front-end projects. Cloud Studio Code is not intended as a hosting or
            production computing service.
          </p>
        </Section>

        <Section title="Service availability and changes">
          <p>
            The platform is provided as-is, with no commitment to uninterrupted or
            error-free availability. Features, runtimes, limits, and policies may
            change, be suspended, or be discontinued at any time as the product
            develops.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We take reasonable measures to protect the platform and your data —
            including sandboxed execution, per-workspace isolation, and server-side
            secret management. No service is perfectly secure, so please don't store
            secrets, credentials, or other sensitive information in your projects or
            files.
          </p>
          <p>
            If you discover a security issue, please report it responsibly through the
            Bugs & Contributions page rather than exploiting it.
          </p>
        </Section>

        <Section title="Your content and intellectual property">
          <p>
            You keep ownership of the projects, code, and files you create in Cloud
            Studio Code. You grant the platform only the limited permission needed to
            store, transfer, and process that content in order to provide the service.
            Cloud Studio Code's own name, design, and code remain the property of its
            operators.
          </p>
        </Section>

        <Section title="Suspension and termination">
          <p>
            Access may be suspended or terminated — and workspaces removed — if you
            seriously or repeatedly violate these terms, abuse the service, or use it
            unlawfully. We may also remove workspaces that breach the platform's
            resource or inactivity limits.
          </p>
        </Section>

        <Section title="Disclaimer">
          <p>
            Cloud Studio Code is provided in BETA, "as is" and "as available," without
            warranties of any kind, whether express or implied — including any
            warranty of accuracy, reliability, fitness for a particular purpose, or
            non-infringement. Use of the service and reliance on its results are at
            your own risk.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, the operators of Cloud Studio Code
            will not be liable for any indirect, incidental, or consequential damages,
            or for any loss of data, profits, or projects arising from your use of the
            service. This applies in particular to data loss resulting from the BETA
            status of the platform, workspace expiration, or service changes. Nothing
            here limits liability that cannot be limited under applicable law.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            These terms may change as the platform develops. Updated terms will be
            published on this page with a revised effective date. Continued use of the
            service after changes take effect means you accept the updated terms.
          </p>
        </Section>

        <Section title="Contact and reporting issues">
          <p>
            Questions about these terms, bug reports, and ideas are welcome through the
            Bugs & Contributions page.
          </p>
        </Section>
      </main>
    </div>
  );
}
