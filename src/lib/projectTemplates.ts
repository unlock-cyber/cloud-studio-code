// Starter project templates, shared by the server (project creation) and the
// client (new-project dialog). Every file is a real runnable starter.

export type TemplateFile = { path: string; content: string };

export type Template = {
  label: string;
  language: string;
  entryFile: string;
  files: TemplateFile[];
};

const htmlIndex = `<!DOCTYPE html>
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
`;

const appCss = `:root {
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
`;

const appJs = `const btn = document.getElementById("btn");
const out = document.getElementById("out");
let count = 0;
btn.addEventListener("click", () => {
  count++;
  out.textContent = \`Clicked \${count} time\${count === 1 ? "" : "s"}\`;
  console.log("count is now", count);
});
console.log("script.js loaded");
`;

const reactIndex = `<!DOCTYPE html>
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
`;

const reactApp = `function App() {
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
`;

export const TEMPLATES: Record<string, Template> = {
  blank: {
    label: "Blank Project",
    language: "blank",
    entryFile: "README.md",
    files: [
      {
        path: "README.md",
        content:
          "# Blank Project\n\nStart creating files. Runnable types: .py .js .ts .c .cpp .java .sh .sql — plus live preview for web projects.\n",
      },
    ],
  },
  web: {
    label: "HTML / CSS / JS",
    language: "html",
    entryFile: "index.html",
    files: [
      { path: "index.html", content: htmlIndex },
      { path: "style.css", content: appCss },
      { path: "script.js", content: appJs },
    ],
  },
  react: {
    label: "React (live preview)",
    language: "html",
    entryFile: "index.html",
    files: [
      { path: "index.html", content: reactIndex },
      { path: "App.jsx", content: reactApp },
      { path: "style.css", content: appCss },
    ],
  },
  ts: {
    label: "TypeScript",
    language: "ts",
    entryFile: "main.ts",
    files: [
      {
        path: "main.ts",
        content: `interface User {
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
`,
      },
    ],
  },
  python: {
    label: "Python",
    language: "python",
    entryFile: "main.py",
    files: [
      {
        path: "main.py",
        content: `import sys

print("Python", sys.version.split()[0])


def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


for i in range(10):
    print(f"fib({i}) = {fib(i)}")
`,
      },
    ],
  },
  c: {
    label: "C",
    language: "c",
    entryFile: "main.c",
    files: [
      {
        path: "main.c",
        content: `#include <stdio.h>

int main(void) {
    printf("Hello from C\\n");
    for (int i = 1; i <= 5; i++) {
        printf("%d squared = %d\\n", i, i * i);
    }
    return 0;
}
`,
      },
    ],
  },
  cpp: {
    label: "C++",
    language: "cpp",
    entryFile: "main.cpp",
    files: [
      {
        path: "main.cpp",
        content: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> v = {1, 2, 3, 4, 5};
    int sum = 0;
    for (int x : v) sum += x;
    std::cout << "Hello from C++" << std::endl;
    std::cout << "sum = " << sum << std::endl;
    return 0;
}
`,
      },
    ],
  },
  java: {
    label: "Java",
    language: "java",
    entryFile: "Main.java",
    files: [
      {
        path: "Main.java",
        content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
        for (int i = 1; i <= 5; i++) {
            System.out.println(i + " squared = " + (i * i));
        }
    }
}
`,
      },
    ],
  },
  node: {
    label: "Node.js style",
    language: "node",
    entryFile: "index.js",
    files: [
      {
        path: "index.js",
        content: `// Runs in the browser JS sandbox (Node-style console output).
const stack = new Error().stack;
console.log("JavaScript is running.");
console.log("Numbers:", [1, 2, 3].map((n) => n * 10));
`,
      },
    ],
  },
  sql: {
    label: "SQL (SQLite)",
    language: "sql",
    entryFile: "schema.sql",
    files: [
      {
        path: "schema.sql",
        content: `CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);

INSERT OR IGNORE INTO users (name, email) VALUES
  ('Ada Lovelace', 'ada@example.com'),
  ('Alan Turing', 'alan@example.com');
`,
      },
      {
        path: "query.sql",
        content: `SELECT * FROM users ORDER BY name;
`,
      },
    ],
  },
};

export const TEMPLATE_ORDER = [
  "web",
  "react",
  "python",
  "ts",
  "javascript_node",
  "c",
  "cpp",
  "java",
  "sql",
  "blank",
];

// aliases used by the picker
export const TEMPLATE_PICKER = [
  { key: "web", ...TEMPLATES.web },
  { key: "react", ...TEMPLATES.react },
  { key: "python", ...TEMPLATES.python },
  { key: "ts", ...TEMPLATES.ts },
  { key: "node", ...TEMPLATES.node },
  { key: "c", ...TEMPLATES.c },
  { key: "cpp", ...TEMPLATES.cpp },
  { key: "java", ...TEMPLATES.java },
  { key: "sql", ...TEMPLATES.sql },
  { key: "blank", ...TEMPLATES.blank },
];
