import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 scroll-mt-20" id={id}>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const ExternalLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <a
    href={to}
    className="text-foreground underline underline-offset-2 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
  >
    {children}
  </a>
);

export default function Privacy() {
  const navigate = useNavigate();
  usePageMeta({
    title: "Privacy Policy — Cloud Studio Code",
    description:
      "What information Cloud Studio Code collects, how workspace and account data is used, retained and protected, and the options you have over your data.",
    path: "/privacy",
  });

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

      <main className="mx-auto max-w-3xl px-4 pb-20">
        <div className="pt-10 pb-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective date: 20 September 2026</p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            This Privacy Policy explains what information Cloud Studio Code collects,
            why it is collected, how it is used and protected, how long it is kept, and
            what rights and options you have. It applies to everyone who uses the
            platform, including unregistered guest users.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Cloud Studio Code is currently in <strong className="font-medium text-foreground">BETA</strong>.
            The platform is under active development, and both the product and this
            policy may change as it evolves. We have written this document to describe
            what the platform actually does today — nothing more.
          </p>
        </div>

        <Section id="introduction" title="1. Introduction">
          <p>
            Cloud Studio Code is a browser-based development environment. It provides a
            code editor, a project file explorer, code execution in sandboxed runtimes,
            live web previews, and cloud-hosted workspaces where your projects and
            files are stored so you can return to them later.
          </p>
          <p>
            Providing that service requires storing some of your information: your
            account email if you register, the projects and files you create, and any
            bug reports you send us. This policy describes that information in
            detail. It also describes what we deliberately do <em>not</em> do: Cloud
            Studio Code does not run advertising, does not sell data, does not use
            third-party analytics or tracking, and does not process payments.
          </p>
        </Section>

        <Section id="scope" title="2. Scope of this Privacy Policy">
          <p>
            This policy covers the Cloud Studio Code web application — the public
            homepage, the authentication flow, the guest and registered workspaces, the
            IDE, the public About/Changelog/Privacy/Terms pages, and the Bugs &amp;
            Contributions page — together with the backend and database that support
            them.
          </p>
          <p>
            It does not cover third-party services that host parts of the application
            (described in{" "}
            <a href="#third-party-services" className="underline underline-offset-2 hover:text-foreground">
              section 22
            </a>
            ), which operate under their own privacy policies. If you follow links
            from this site to external websites, those websites are outside the scope
            of this policy.
          </p>
        </Section>

        <Section id="information-we-collect" title="3. Information We Collect">
          <p>The information Cloud Studio Code collects falls into these groups:</p>
          <Bullets
            items={[
              <>
                <strong className="font-medium text-foreground">Account and authentication information</strong>{" "}
                — the email address you provide for sign-in, and the one-time codes
                generated to verify it (section 4).
              </>,
              <>
                <strong className="font-medium text-foreground">Workspace data</strong> — the projects,
                files, and file contents you create, whether you are a guest or a
                registered user (sections 5–7).
              </>,
              <>
                <strong className="font-medium text-foreground">Bug reports</strong> — the content you
                submit through the Bugs &amp; Contributions page, plus any optional
                reporter details you choose to include (sections 8–9).
              </>,
              <>
                <strong className="font-medium text-foreground">Browser/device information</strong> —
                only when you explicitly submit it alongside a bug report (section 10).
              </>,
              <>
                <strong className="font-medium text-foreground">Session tokens</strong> — created when
                you sign in or unlock the private bug-management interface, so you stay
                authenticated (section 21).
              </>,
            ]}
          />
          <p>
            We do not collect or use advertising identifiers, and we do not fingerprint
            your device or follow you across other websites.
          </p>
        </Section>

        <Section id="account-authentication" title="4. Account and Authentication Information">
          <p>
            If you create an account or sign in, you provide an email address. We use
            it to:
          </p>
          <Bullets
            items={[
              "Send a one-time verification code (OTP) to that address when you sign in or register. The code is generated by the platform and delivered by an email delivery service. We do not use your email address for marketing, newsletters, or promotional messages.",
              "Identify your account and associate it with your registered workspace and its projects and files.",
              "Enable the guest-to-account transition: when you sign in from a guest session, your guest workspace data is moved into your authenticated account rather than left behind.",
            ]}
          />
          <p>
            We do not collect names, birth dates, phone numbers, or postal addresses
            for accounts. The email address is the only account identifier the platform
            holds.
          </p>
        </Section>

        <Section id="guest-workspace" title="5. Guest Workspace Information">
          <p>
            You can start using the platform immediately as a guest, without an
            account. A guest workspace is created for your browser session and holds
            the projects and files you create during that session.
          </p>
          <Bullets
            items={[
              "Guest workspaces are stored server-side, not in your browser, so your projects survive a page refresh within the session window.",
              "Guest workspaces are temporary and expire after 1 hour of inactivity (section 14).",
              "If you create an account from a guest session, the guest workspace's projects and files are moved into your authenticated account — preserving project names, structure, and file contents. A successful migration alone does not delete the guest data until it has been confirmed and the transfer has completed.",
              "If migration fails, the guest workspace and its data are preserved so you can retry or export your projects manually.",
            ]}
          />
        </Section>

        <Section id="registered-workspace" title="6. Registered Workspace Information">
          <p>
            Registered accounts receive a cloud workspace that persists between
            sessions. Creating a project, file, or folder in the IDE writes it to the
            platform's database so that it is available the next time you sign in.
          </p>
          <p>
            Registered workspaces expire after 24 hours of inactivity; the window is
            extended each time you actively use the platform (section 15). See{" "}
            <a href="#data-retention" className="underline underline-offset-2 hover:text-foreground">
              section 13
            </a>{" "}
            for what this means in practice.
          </p>
        </Section>

        <Section id="projects-files" title="7. Projects, Files, Editor State and Settings">
          <p>
            The content you create in the IDE is stored as part of your workspace:
          </p>
          <Bullets
            items={[
              <>
                <strong className="font-medium text-foreground">Projects and files</strong> — project
                names, folder structure, file names, and file contents are stored so
                your workspace can be restored exactly as you left it.
              </>,
              <>
                <strong className="font-medium text-foreground">Editor settings</strong> — choices such
                as theme preference and other interface settings may be kept so the
                workspace behaves consistently across sessions.
              </>,
              <>
                <strong className="font-medium text-foreground">Imports and exports</strong> — when you
                import or export a project as a ZIP archive, the archive's contents
                pass through the platform in the same way as files you create directly.
              </>,
            ]}
          />
          <p>
            Your projects and files are used only to provide your workspace. They are
            not analysed, indexed for search by other users, used to train models, or
            shared with other users.
          </p>
        </Section>

        <Section id="bug-reports" title="8. Bug Reports and Contributions">
          <p>
            The Bugs &amp; Contributions page lets anyone submit a bug report. A report
            includes:
          </p>
          <Bullets
            items={[
              "A bug title (required)",
              "A description of the problem (required)",
              "Steps to reproduce it (required)",
              "Expected behavior and actual behavior",
              "Optionally, browser/device information, your name, and your email address",
            ]}
          />
          <p>
            Bug reports are stored in the platform's database and are visible only to
            the site operators through a password-protected private interface that is
            not linked from public navigation. There is no public API that returns bug
            report contents, and reports are never shown to other users.
          </p>
        </Section>

        <Section id="optional-reporter-info" title="9. Optional Name and Email Information">
          <p>
            When submitting a bug report, the name and email fields are entirely
            optional. If you provide an email address in a bug report, we may use it
            solely to follow up on your report — for example to ask for clarification.
            We will not add it to any list or use it for any other purpose. If you
            prefer not to be contacted, simply leave those fields empty; an anonymous
            report is just as useful.
          </p>
        </Section>

        <Section id="browser-device-info" title="10. Browser and Device Information">
          <p>
            Cloud Studio Code does not automatically profile your device. The only
            browser or device information the platform handles is what you explicitly
            choose to include in a bug report — for example the browser version, which
            the report form can pre-fill from your browser's user-agent string to save
            you typing it.
          </p>
          <p>
            Like nearly all web services, our hosting infrastructure may see standard
            technical details inherent in any HTTP request (such as your IP address)
            as part of serving the application. This is handled by our infrastructure
            provider (section 22) and is not used by Cloud Studio Code for tracking or
            profiling.
          </p>
        </Section>

        <Section id="how-we-use" title="11. How We Use Information">
          <p>Everything we store is used to operate the service itself:</p>
          <Bullets
            items={[
              "Email addresses are used for authentication only — generating and sending one-time codes and identifying your workspace.",
              "Projects, files, and settings are stored to provide persistence: opening the site again puts your workspace back the way you left it.",
              "Guest workspace data is used to let you try the platform without an account, and — if you register — to be moved into your account.",
              "Bug reports are used to reproduce, prioritise, and fix defects, and to track the status of fixes in the private management interface.",
              "Session tokens are used to keep you signed in during a session and to keep the private bug-management interface unlocked once you have authenticated to it.",
            ]}
          />
          <p>
            We do not use your information to build profiles, to advertise, or for any
            purpose unrelated to running and improving Cloud Studio Code.
          </p>
        </Section>

        <Section id="workspace-data-handling" title="12. How Workspace and Account Data Is Handled">
          <p>
            Each workspace — guest or registered — is a separate container of projects
            and files. When you edit a file, the change is saved to the database for
            your workspace. When you delete a file or project in the IDE, it is removed
            from the database.
          </p>
          <p>
            During the guest-to-account transition, guest data is moved (not copied)
            into the authenticated workspace, and the old guest session and its data
            are deleted only after the transfer is confirmed to have succeeded. If any
            step fails, the guest data is kept intact for retry or manual export.
          </p>
        </Section>

        <Section id="data-retention" title="13. Data Retention and Expiration">
          <p>
            Cloud Studio Code uses activity-based retention. Workspaces have an
            inactivity window; if a workspace is not used within it, the platform
            removes it and its contents. This keeps the service lean and means we
            cannot and do not promise that your data will be retained forever. Please
            keep your own copies of anything important — the IDE's ZIP export exists
            exactly for this.
          </p>
        </Section>

        <Section id="guest-expiration" title="14. Guest Workspace Expiration">
          <p>
            Guest workspaces expire after <strong className="font-medium text-foreground">1 hour of
            inactivity</strong>. Activity is measured by use of the workspace, and a
            session that keeps working within the window stays alive. When a guest
            workspace expires, its projects and files are removed.
          </p>
          <p>
            Practical implications: if you plan to stop working for a while, or want to
            be certain nothing is lost, sign in to create an account (which moves your
            guest data into it) or export your projects as a ZIP archive. Starting a
            new guest session after expiry begins a fresh, empty workspace.
          </p>
        </Section>

        <Section id="registered-expiration" title="15. Registered Workspace Expiration">
          <p>
            Registered workspaces expire after <strong className="font-medium text-foreground">24 hours
            of inactivity</strong>. Each time you use the platform, the window is
            extended, so an account that is used regularly keeps its workspace
            continuously available.
          </p>
          <p>
            If a registered workspace does expire through inactivity, the platform
            removes the expired workspace and re-provisions a fresh one the next time
            you sign in. Because of this — and because the platform is in BETA —
            workspace data should not be treated as a permanent or guaranteed store.
            Export important projects.
          </p>
        </Section>

        <Section id="bug-report-retention" title="16. Bug Report Retention">
          <p>
            Bug reports are retained in the database until the site operators remove
            them — typically after the underlying issue has been resolved or the report
            has been closed. Reports may be archived or deleted earlier at the
            operators' discretion. Because reports are reviewed manually, there is no
            automated publication or sharing of their contents.
          </p>
        </Section>

        <Section id="data-deletion" title="17. Data Deletion">
          <p>You can delete most of your data yourself, directly in the product:</p>
          <Bullets
            items={[
              "Delete individual files or entire projects from the IDE file explorer at any time.",
              "Let a workspace expire naturally through inactivity — the platform removes expired workspaces and their contents.",
              "Choose not to provide a name or email with a bug report; those fields are optional.",
            ]}
          />
          <p>
            If you need something deleted that you cannot delete yourself — for example
            a bug report containing personal information you submitted — contact us
            through the Bugs &amp; Contributions page and we will remove it.
          </p>
        </Section>

        <Section id="data-security" title="18. Data Security">
          <p>
            We take reasonable technical measures to protect the platform and the data
            it stores:
          </p>
          <Bullets
            items={[
              "Passwords and secret keys used by the platform live only in server-side environment variables and are never sent to the browser.",
              "The private bug-management interface is protected by a password that is verified server-side; the password itself is stored only as a salted hash, and repeated incorrect attempts trigger a temporary lockout.",
              "Management sessions use random tokens of which only a cryptographic hash is stored server-side; the raw token never touches the database.",
              "Bug reports have no public read path — no public API returns their contents.",
              "Code you execute runs in a sandboxed environment with resource limits, isolated per workspace.",
            ]}
          />
          <p>
            No system is perfectly secure, and we do not promise absolute security. As
            with any cloud service, you should avoid storing secrets, credentials, or
            other sensitive information in your project files.
          </p>
        </Section>

        <Section id="workspace-isolation" title="19. Workspace Isolation and Access Controls">
          <p>
            Workspace data is isolated per user and per session: a guest's projects and
            files are not accessible to another guest, and a registered user's
            workspace is accessible only through their authenticated session. The
            platform's API checks workspace ownership on every read and write, so one
            user's data cannot be fetched by another.
          </p>
          <p>
            The only people with access to stored data beyond your own session are the
            site operators, for the purpose of operating and maintaining the service —
            including reviewing bug reports through the password-protected private
            interface.
          </p>
        </Section>

        <Section id="code-execution" title="20. Code Execution and Third-Party Infrastructure">
          <p>
            Code you run, and web projects you preview, execute inside a sandboxed
            environment that is isolated per workspace and subject to resource limits.
            Execution is intended for development and learning; it is not a hosting or
            production computing service. Server-side applications cannot expose public
            URLs, and very long-running or resource-heavy programs may be stopped.
          </p>
          <p>
            The application itself — backend, database, and hosting — runs on
            third-party infrastructure described in section 22. Your code and files
            stored in your workspace reside in that infrastructure.
          </p>
        </Section>

        <Section id="local-storage" title="21. Local Browser Storage and Sessions">
          <p>
            Cloud Studio Code keeps very little in your browser, and only what is
            needed for sessions to work:
          </p>
          <Bullets
            items={[
              "Authentication session tokens, so you remain signed in while you use the platform after verifying an OTP.",
              "A token for the private bug-management session, kept only for the browser tab's lifetime and cleared when you sign out or close the tab — so refreshing that page never exposes reports without re-authenticating.",
              "Interface state such as theme preference.",
            ]}
          />
          <p>
            We do not use tracking cookies, and nothing is stored locally for
            advertising or cross-site purposes.
          </p>
        </Section>

        <Section id="third-party-services" title="22. Third-Party Services">
          <p>
            Cloud Studio Code relies on a small number of third-party services to
            operate:
          </p>
          <Bullets
            items={[
              <>
                <strong className="font-medium text-foreground">Convex</strong> — application hosting,
                backend, and database. Workspace, project, file, account, and bug-report
                data is stored on Convex infrastructure.
              </>,
              <>
                <strong className="font-medium text-foreground">An email delivery service</strong> —
                used solely to send one-time verification codes when you sign in or
                create an account. It receives the destination email address and the
                message content needed to deliver the code.
              </>,
            ]}
          />
          <p>
            No advertising networks, analytics providers, data brokers, or payment
            processors are used. If additional third-party services are introduced in
            the future, this section will be updated.
          </p>
        </Section>

        <Section id="user-content" title="23. User-Submitted Content">
          <p>
            You own the projects, code, and files you create. We store and process that
            content only as needed to provide the service — persisting it, serving it
            back to you, moving it between guest and account workspaces, and executing
            it in the sandbox when you ask us to.
          </p>
          <p>
            Do not submit content that is unlawful or that infringes the rights of
            others, and do not include sensitive personal information (yours or
            anyone's) in projects, files, or bug reports where it is not necessary.
            Content you place in a bug report is seen by the site operators when they
            review reports.
          </p>
        </Section>

        <Section id="beta-privacy" title="24. Privacy During the BETA/Development Period">
          <p>
            Cloud Studio Code is in BETA. During this period:
          </p>
          <Bullets
            items={[
              "Data handling, storage, and retention may change as features are built. Significant changes to this policy will be published on this page.",
              "Bugs can and do occur. While we aim to handle data carefully — including preserving guest data when a migration fails — we cannot guarantee that data loss will never happen. Export important projects regularly.",
              "The retention windows described in this policy (1 hour for guest workspaces, 24 hours for registered ones) reflect the current implementation and may be adjusted as the product develops.",
            ]}
          />
        </Section>

        <Section id="changes" title="25. Changes to This Privacy Policy">
          <p>
            This policy may be updated as Cloud Studio Code develops. Updated versions
            will be published on this page with a revised effective date. Material
            changes to how your information is handled will be reflected in the
            document itself; the platform does not send policy-change notifications by
            email. Continued use of the service after an update takes effect means you
            accept the revised policy.
          </p>
        </Section>

        <Section id="questions" title="26. Questions, Concerns and Bug Reports">
          <p>
            If you have questions or concerns about this policy or how your data is
            handled, or if you would like something about your data corrected or
            deleted and cannot do it yourself in the product, please reach out through
            the <ExternalLink to="/contributions">Bugs &amp; Contributions</ExternalLink>{" "}
            page. Bug reports about privacy-related behavior are reviewed the same way
            as any other report — privately, by the site operators.
          </p>
        </Section>

        <Section id="effective-date" title="27. Effective Date">
          <p>
            This Privacy Policy is effective as of{" "}
            <strong className="font-medium text-foreground">20 September 2026</strong>.
          </p>
        </Section>
      </main>
    </div>
  );
}
