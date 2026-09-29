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

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const InlineLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <a
    href={to}
    className="text-foreground underline underline-offset-2 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
  >
    {children}
  </a>
);

export default function Terms() {
  const navigate = useNavigate();
  usePageMeta({
    title: "Terms of Service — Cloud Studio Code",
    description:
      "The terms that govern use of Cloud Studio Code, including the BETA status of the platform, workspace retention rules, acceptable use and limitations.",
    path: "/terms",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="csc-shell flex h-14 items-center">
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

      <main className="csc-shell pb-20">
        <div className="pt-10 pb-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective date: 20 September 2026</p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            These Terms of Service govern your use of Cloud Studio Code. They are
            written to be readable and to describe the rules and realistic
            expectations for using the platform, including its current BETA
            limitations.
          </p>
        </div>

        <Section id="introduction" title="1. Introduction">
          <p>
            Cloud Studio Code is a free, browser-based development environment. These
            terms form the agreement between you and the operators of the platform
            ("we", "us") when you use it. Because the platform is in active
            development, these terms focus on how the service actually works today and
            may be updated as it evolves.
          </p>
        </Section>

        <Section id="definitions" title="2. Definitions">
          <Bullets
            items={[
              <>
                <strong className="font-medium text-foreground">The platform</strong> — the Cloud
                Studio Code web application and its supporting backend.
              </>,
              <>
                <strong className="font-medium text-foreground">Workspace</strong> — the server-side
                container holding your projects and files. A workspace can be a guest
                workspace (tied to your browser session) or a registered workspace
                (tied to your account).
              </>,
              <>
                <strong className="font-medium text-foreground">Guest user</strong> — someone using the
                platform without an account.
              </>,
              <>
                <strong className="font-medium text-foreground">Registered user</strong> — someone who
                has verified an email address and signed in.
              </>,
              <>
                <strong className="font-medium text-foreground">User content</strong> — the projects,
                files, code, and other material you create or upload in the platform.
              </>,
              <>
                <strong className="font-medium text-foreground">Sandbox</strong> — the isolated,
                resource-limited environment in which code you run and previews are
                executed.
              </>,
            ]}
          />
        </Section>

        <Section id="acceptance" title="3. Acceptance of These Terms">
          <p>
            By accessing or using the platform — including as a guest, without creating
            an account — you accept these terms. If you do not agree with them, please
            do not use the service. Where a specific feature has additional rules
            presented in the interface, those rules also apply when you use that
            feature.
          </p>
        </Section>

        <Section id="about" title="4. About Cloud Studio Code">
          <p>
            The platform provides a browser-based IDE with a code editor, a file
            explorer, project management, and storage for your projects and files. It
            runs code in supported languages (including Python, C, C++, Java,
            JavaScript, TypeScript, and Bash) inside a sandbox, renders live previews
            of front-end web projects, supports SQL/SQLite, and lets you import and
            export projects as ZIP archives.
          </p>
          <p>
            The service is provided free of charge. There are no paid tiers, and
            nothing in these terms creates an obligation for us to provide any
            particular feature, capacity, or service level.
          </p>
        </Section>

        <Section id="beta-status" title="5. BETA and Development Status">
          <p>
            Cloud Studio Code is in BETA. In practice this means: features may change
            or be removed; behavior may be inconsistent; bugs can cause errors or data
            loss; runtimes and limits may be adjusted; and the whole service may be
            changed or discontinued. We work to handle data carefully — for example,
            preserving guest data when an account migration fails — but you should not
            treat the platform as infallible. Export anything important.
          </p>
        </Section>

        <Section id="eligibility" title="6. Eligibility and Account Responsibilities">
          <p>
            You may use the platform if you can lawfully enter into agreements such as
            these terms. When registering, you provide an email address and verify it
            with a one-time code. You are responsible for:
          </p>
          <Bullets
            items={[
              "The accuracy of the email address you provide — one-time codes are delivered to it, and it identifies your account.",
              "Keeping access to your email and to any session in which you are signed in.",
              "Your activity within your sessions and workspaces.",
            ]}
          />
          <p>
            Do not use another person's email address, and do not attempt to access
            accounts or workspaces that are not yours.
          </p>
        </Section>

        <Section id="guest-usage" title="7. Guest Workspace Usage">
          <p>
            You can start coding immediately as a guest, without an account. A guest
            workspace is created for your session and holds your projects and files
            server-side.
          </p>
          <Bullets
            items={[
              "Guest workspaces are temporary and expire after 1 hour of inactivity (section 17).",
              "Guest data is not tied to a durable identity; if your session is lost and the workspace expires, its contents cannot be recovered.",
              "If you register from a guest session, the guest workspace's projects and files are moved into your account — preserving names, structure, and contents.",
              "If that migration fails, the guest workspace is preserved so you can retry or export your projects manually.",
            ]}
          />
        </Section>

        <Section id="registered-accounts" title="8. Registered Accounts">
          <p>
            A registered account gives you a workspace that persists between sessions
            and stays available with regular use. Each time you use the platform, your
            workspace's inactivity window is extended. Registered workspaces expire
            after 24 hours of inactivity and are re-provisioned fresh on your next
            sign-in (section 17). There is currently no feature for deleting an account
            yourself; if a registered workspace expires through inactivity, its
            associated data is removed along with it.
          </p>
        </Section>

        <Section id="user-content" title="9. Projects, Files and User Content">
          <p>
            You keep ownership of everything you create in the platform. We store your
            projects and files in order to serve them back to you, and we process them
            only to operate the service — persisting, restoring, migrating between
            guest and account workspaces, and executing when you choose to run code.
          </p>
          <p>
            Your user content is not analysed, indexed for other users, used for
            advertising, or shared. It is visible only within your own workspace (and,
            for the operators, only to the extent needed to operate and maintain the
            service).
          </p>
        </Section>

        <Section id="code-responsibility" title="10. User Responsibility for Code and Content">
          <p>
            You are responsible for the code you write and run, the files you create
            and upload, and the consequences of executing them. The platform runs your
            code for real — which means buggy, destructive, or resource-heavy code can
            affect your own workspace and consume your runtime allowance. We do not
            review your projects before or after you run them, and we are not
            responsible for the results they produce.
          </p>
          <p>
            Do not store secrets, credentials, or other sensitive information in
            project files. The workspace is a development environment, not a secret
            vault.
          </p>
        </Section>

        <Section id="acceptable-use" title="11. Acceptable Use">
          <p>You agree to use the platform for lawful development purposes and to:</p>
          <Bullets
            items={[
              "Respect the resource limits built into the sandbox and the workspace inactivity windows.",
              "Work only within your own workspace and sessions.",
              "Report problems and security issues responsibly, through the Bugs & Contributions page, rather than exploiting them.",
            ]}
          />
        </Section>

        <Section id="prohibited-activities" title="12. Prohibited Activities">
          <p>You may not use the platform to:</p>
          <Bullets
            items={[
              "Run malware; launch attacks against systems, networks, or other users; or engage in any illegal activity.",
              "Attempt to escape, overload, or abuse the sandbox, its resource limits, or the platform's infrastructure.",
              "Attempt to gain unauthorized access to the platform, its private areas, other users' workspaces, or any data that is not yours.",
              "Interfere with the service's operation — for example by automated abuse, excessive load, or attempts to circumvent rate limits or expiry rules.",
              "Store or distribute unlawful content, or content that infringes others' rights.",
              "Misrepresent your identity, use another person's email address, or otherwise misuse the account system.",
            ]}
          />
          <p>
            Violations may lead to suspension or termination (section 22).
          </p>
        </Section>

        <Section id="sandbox-usage" title="13. Code Execution and Sandbox Usage">
          <p>
            When you run code or preview a web project, execution happens in a
            sandboxed environment that is isolated per workspace and subject to
            resource limits. The sandbox exists to let you develop and learn — it is
            not a general-purpose compute service, a hosting platform, or a production
            environment. Server-side applications you write cannot expose public URLs,
            and live previews are designed for front-end projects.
          </p>
        </Section>

        <Section id="runtime-limits" title="14. Runtime and Resource Limitations">
          <p>
            The sandbox enforces resource limits to keep the service fair and stable.
            In practice:
          </p>
          <Bullets
            items={[
              "Long-running or resource-heavy programs may be stopped early.",
              "Package installation is not available; execution is limited to the built-in languages and runtimes.",
              "Runtimes, limits, and supported languages may change at any time as the platform develops.",
            ]}
          />
        </Section>

        <Section id="import-export" title="15. Importing and Exporting Projects">
          <p>
            The platform lets you import projects from ZIP archives and export your
            projects as ZIP archives. Imported archives are unpacked into your
            workspace like files you create directly. Exporting is the recommended way
            to keep your own copies of anything important — especially given the
            workspace expiry rules and BETA status. We recommend exporting
            periodically; the platform does not schedule or perform backups of your
            workspace on your behalf.
          </p>
        </Section>

        <Section id="infrastructure" title="16. Third-Party Execution Infrastructure">
          <p>
            The platform's backend, database, and hosting run on third-party
            infrastructure (currently Convex), and one-time verification codes are
            delivered through an email service. This means your code and files are
            processed and stored on infrastructure operated by third parties under
            their own terms. If those services change, experience outages, or alter
            their behavior, the platform may be affected. We do not control
            third-party infrastructure and do not guarantee its behavior.
          </p>
        </Section>

        <Section id="retention" title="17. Workspace Data Retention and Expiration">
          <p>
            Workspaces use activity-based retention and are not permanent stores:
          </p>
          <Bullets
            items={[
              <>
                <strong className="font-medium text-foreground">Guest workspaces</strong> expire after{" "}
                <strong className="font-medium text-foreground">1 hour of inactivity</strong>. Their
                contents are then removed. Registering before expiry moves your guest
                data into your account.
              </>,
              <>
                <strong className="font-medium text-foreground">Registered workspaces</strong> expire
                after <strong className="font-medium text-foreground">24 hours of inactivity</strong>.
                Each active use extends the window. If a registered workspace expires,
                the platform removes it and re-provisions a fresh one on your next
                sign-in — its previous contents are gone.
              </>,
              "Data may also be lost to bugs, migrations, or operational issues, particularly during the BETA period.",
            ]}
          />
          <p>
            To be clear: Cloud Studio Code does not promise that your data will be
            retained, backed up, or recoverable. Export important projects.
          </p>
        </Section>

        <Section id="availability" title="18. Service Availability">
          <p>
            The platform is provided as-is. We do not guarantee uninterrupted or
            error-free availability. Maintenance, changes, infrastructure issues, or
            abuse-mitigation measures can interrupt or degrade the service at any
            time, with or without notice.
          </p>
        </Section>

        <Section id="service-changes" title="19. Changes to the Service">
          <p>
            We may add, modify, suspend, or discontinue any part of the service —
            including features, languages, runtimes, limits, retention windows, and
            the free nature of the platform — at any time. We may also impose new
            limits (for example on storage or execution) if needed to keep the service
            operable.
          </p>
        </Section>

        <Section id="security" title="20. Security and Responsible Use">
          <p>
            We take reasonable measures to protect the platform: sandboxed execution
            isolated per workspace, server-side verification of workspace ownership on
            every request, secrets kept in server-side environment variables, and a
            rate-limited, hash-verified password gate for the private bug-management
            interface. No service is perfectly secure, and we do not promise absolute
            security.
          </p>
          <p>
            If you discover a vulnerability or a security problem, please report it
            responsibly through the Bugs & Contributions page instead of exploiting
            it. Do not test, probe, or attempt to break the platform's security
            outside of what your own workspace and account legitimately allow.
          </p>
        </Section>

        <Section id="intellectual-property" title="21. Intellectual Property and User Content">
          <p>
            You own your projects, code, and files. By using the platform, you grant
            us only the limited permission needed to store, reproduce, process, and
            transfer your content in order to operate the service — nothing more, and
            the permission ends when the content is deleted or you stop using the
            service. Cloud Studio Code's own name, design, interface, and software
            remain the property of its operators and may not be copied or used to run
            a competing service.
          </p>
        </Section>

        <Section id="termination" title="22. Suspension or Termination for Misuse">
          <p>
            We may suspend or terminate access to the platform — and remove associated
            workspaces and data — if you seriously or repeatedly breach these terms,
            abuse the service or its infrastructure, violate applicable law, or create
            risk for other users or the platform. We may also remove workspaces that
            breach inactivity or resource rules. Where feasible and appropriate, we
            may first warn you, but we are not required to.
          </p>
        </Section>

        <Section id="beta-disclaimer" title="23. BETA Disclaimer">
          <p>
            Cloud Studio Code is provided in BETA, in active development. Features are
            subject to change, outages and data loss are possible, and behavior may be
            unpredictable. By using the platform in its BETA state, you acknowledge
            these realities and use the service at your own discretion.
          </p>
        </Section>

        <Section id="service-limitations" title="24. Service and Data Limitations">
          <p>
            Beyond the BETA disclaimer, the platform has structural limitations you
            should understand: workspace data is not permanently retained and expires
            through inactivity (section 17); execution happens within sandbox resource
            limits that may stop programs early; server-side applications cannot
            function as publicly hosted services; and there is no backup service. If
            your projects matter to you, keep your own copies.
          </p>
        </Section>

        <Section id="warranties" title="25. Disclaimer of Warranties">
          <p>
            The platform is provided "as is" and "as available," without warranties of
            any kind — express, implied, or statutory — including any warranty of
            merchantability, fitness for a particular purpose, accuracy,
            non-infringement, or uninterrupted availability. We do not warrant that
            the service will meet your requirements, that results from running code
            will be correct or reliable, or that data will be preserved. Some
            jurisdictions do not allow certain warranty exclusions, in which case they
            apply only to the maximum extent permitted.
          </p>
        </Section>

        <Section id="liability" title="26. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, the operators of Cloud
            Studio Code will not be liable for any indirect, incidental, special,
            consequential, or punitive damages — including loss of data, projects,
            profits, or goodwill — arising from or relating to your use of, or
            inability to use, the platform. This applies in particular to data loss
            resulting from workspace expiration, BETA defects, service changes, or
            infrastructure issues. Nothing in these terms limits liability that
            cannot be limited under applicable law.
          </p>
        </Section>

        <Section id="terms-changes" title="27. Changes to These Terms">
          <p>
            These terms may change as the platform develops. Updated versions will be
            published on this page with a revised effective date. Continued use of the
            service after an update takes effect means you accept the revised terms.
            The platform does not send terms-change notifications by email.
          </p>
        </Section>

        <Section id="questions" title="28. Questions, Concerns and Bug Reports">
          <p>
            Questions about these terms, bug reports, and ideas are welcome through
            the <InlineLink to="/contributions">Bugs &amp; Contributions</InlineLink> page.
            Reports are reviewed privately by the site operators.
          </p>
        </Section>

        <Section id="effective-date" title="29. Effective Date">
          <p>
            These Terms of Service are effective as of{" "}
            <strong className="font-medium text-foreground">20 September 2026</strong>.
          </p>
        </Section>
      </main>
    </div>
  );
}
