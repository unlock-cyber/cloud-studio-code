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

export default function Privacy() {
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
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-muted-foreground">
            Effective date: 20 September 2026
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Cloud Studio Code is currently in BETA and under active development. This
            policy describes the data the platform actually uses today, and it may be
            updated as the product evolves.
          </p>
        </div>

        <Section title="What Cloud Studio Code collects">
          <p>
            Cloud Studio Code collects and stores only the information required to
            provide the service. It does <strong className="font-medium text-foreground">not</strong> use
            advertising, analytics tracking, or payment processing.
          </p>
          <Bullets
            items={[
              "Account and authentication information: the email address you provide when signing in or creating an account, and the one-time verification codes (OTPs) generated for sign-in.",
              "Guest workspace data: the projects, files, and file contents you create while using the platform as a guest, kept in a temporary guest workspace.",
              "Registered workspace data: the projects, files, and file contents stored in your authenticated workspace.",
              "Bug reports: the content you submit through the Bugs & Contributions page — title, description, steps to reproduce, expected and actual behavior.",
              "Optional reporter information: a name and/or email address, and optional browser/device information, if you choose to include them with a bug report.",
              "Basic technical information: browser/device details only when you explicitly submit them with a bug report. Cloud Studio Code does not otherwise profile your device or browsing.",
            ]}
          />
        </Section>

        <Section title="How your information is used">
          <Bullets
            items={[
              "Your email address is used solely for authentication — sending one-time verification codes and identifying your account and workspace.",
              "Your projects, files, and settings are stored to provide your workspace: opening the site, creating projects, editing files, and persisting your work between sessions.",
              "Bug reports are stored so they can be reviewed, tracked, and fixed. They are only visible to the site operators via a password-protected private interface, never to other users or the public.",
              "Guest workspace data is used to let you try the platform immediately, and — if you create an account — to transfer that data into your account when you sign in.",
            ]}
          />
        </Section>

        <Section title="Retention and expiry of workspace data">
          <p>
            Workspaces are activity-based: each workspace has an inactivity window, and
            the platform periodically removes workspaces that have not been used within
            it.
          </p>
          <Bullets
            items={[
              "Guest workspaces expire after 1 hour of inactivity. Creating a guest workspace again starts a fresh one. Signing in before expiry transfers your guest projects and files into your account.",
              "Registered workspaces expire after 24 hours of inactivity, extended automatically each time you use the platform. Signing in again provisions your workspace fresh — projects and files you previously exported or that were migrated remain in your account's stored data.",
              "You can export your projects at any time (ZIP export) as a personal backup.",
            ]}
          />
        </Section>

        <Section title="Bug report retention">
          <p>
            Bug reports submitted through Bugs & Contributions are retained in the
            platform database until they are resolved and removed by the site
            operators. Reports may be deleted earlier at the operators' discretion.
            Because reports are manually reviewed, there is no automated
            publication or sharing of their contents.
          </p>
        </Section>

        <Section title="Data security">
          <Bullets
            items={[
              "Passwords and secret keys used by the platform are stored only in server-side environment variables and are never exposed to the browser.",
              "Bug-report management is protected by a password verified server-side, with rate limiting against repeated incorrect attempts; management sessions use hashed tokens.",
              "Bug reports are not publicly readable — no public API returns their contents.",
              "Workspace data is isolated per user/session so one user's projects and files are not accessible to another.",
              "Code you execute runs in a sandboxed environment isolated per workspace.",
            ]}
          />
        </Section>

        <Section title="Third-party services">
          <p>
            Cloud Studio Code uses a small number of third-party services to operate:
          </p>
          <Bullets
            items={[
              "Convex — application hosting, backend, and database. Workspace, project, file, and bug-report data is stored on Convex infrastructure.",
              "An email delivery service — used solely to send one-time verification codes when you sign in or create an account.",
            ]}
          />
          <p>
            No advertising networks, analytics providers, or payment processors are
            used.
          </p>
        </Section>

        <Section title="Your rights and contacting us">
          <p>
            Because the data collected is limited, you can control most of it directly:
          </p>
          <Bullets
            items={[
              "You can view, edit, export, and delete your own projects and files at any time from the workspace.",
              "You can choose not to provide a name, email address, or browser information with a bug report — these fields are optional.",
              "You can stop using the platform; inactive workspaces are removed automatically per the retention windows above.",
            ]}
          />
          <p>
            If you have questions, concerns, or requests about your data, please reach
            out through the Bugs & Contributions page, and we will do our best to help.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            Cloud Studio Code is in active development, and this policy may change as
            the product changes. Updates will be published on this page with a revised
            effective date.
          </p>
        </Section>
      </main>
    </div>
  );
}
