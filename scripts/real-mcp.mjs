/**
 * real-mcp.mjs — the discovery measurement on a REAL surface.
 *
 * Instead of the illustrative surface in _surface.mjs, this runs discoveryCost
 * on 14 actual tools from 5 official MCP servers (filesystem, github, git,
 * fetch, memory), with their real names, real descriptions, and real input
 * schemas. Descriptions are quoted from the servers' own source; property
 * types are source-exact except GitHub's, which are README-derived (shapes
 * correct). Sources:
 *   modelcontextprotocol/servers  src/{filesystem,fetch,memory,git}
 *   modelcontextprotocol/servers-archived  src/github
 *
 * The point: a real MCP surface has WILDLY uneven description lengths (the
 * filesystem + fetch tools ship paragraphs; git/memory ship one line). That's
 * exactly where deferring the long ones pays off. Run: npm run real-mcp
 */
import { defineTool, discoveryCost, discoveryBreakEven, schemaCollisions } from "../src/index.js";

// [server, name, description(verbatim), properties{name:type}, required[]]
const specs = [
  ["filesystem", "read_text_file",
    "Read the complete contents of a file from the file system as text. Handles various text encodings and provides detailed error messages if the file cannot be read. Use this tool when you need to examine the contents of a single file. Use the 'head' parameter to read only the first N lines of a file, or the 'tail' parameter to read only the last N lines of a file. Operates on the file as text regardless of extension. Only works within allowed directories.",
    { path: "string", head: "number", tail: "number" }, ["path"]],
  ["filesystem", "write_file",
    "Create a new file or completely overwrite an existing file with new content. Use with caution as it will overwrite existing files without warning. Handles text content with proper encoding. Only works within allowed directories.",
    { path: "string", content: "string" }, ["path", "content"]],
  ["filesystem", "edit_file",
    "Make line-based edits to a text file. Each edit replaces exact line sequences with new content. Returns a git-style diff showing the changes made. Only works within allowed directories.",
    { path: "string", edits: "array", dryRun: "boolean" }, ["path", "edits"]],
  ["filesystem", "search_files",
    "Recursively search for files and directories matching a pattern. The patterns should be glob-style patterns that match paths relative to the working directory. Use pattern like '*.ext' to match files in current directory, and '**/*.ext' to match files in all subdirectories. Returns full paths to all matching items. Great for finding files when you don't know their exact location. Only searches within allowed directories.",
    { path: "string", pattern: "string", excludePatterns: "array" }, ["path", "pattern"]],
  ["github", "create_or_update_file", "Create or update a single file in a GitHub repository",
    { owner: "string", repo: "string", path: "string", content: "string", message: "string", branch: "string", sha: "string" },
    ["owner", "repo", "path", "content", "message", "branch"]],
  ["github", "search_repositories", "Search for GitHub repositories",
    { query: "string", page: "number", perPage: "number" }, ["query"]],
  ["github", "get_file_contents", "Get the contents of a file or directory from a GitHub repository",
    { owner: "string", repo: "string", path: "string", branch: "string" }, ["owner", "repo", "path"]],
  ["github", "create_issue", "Create a new issue in a GitHub repository",
    { owner: "string", repo: "string", title: "string", body: "string", assignees: "array", labels: "array", milestone: "number" },
    ["owner", "repo", "title"]],
  ["git", "git_status", "Shows the working tree status", { repo_path: "string" }, ["repo_path"]],
  ["git", "git_commit", "Records changes to the repository", { repo_path: "string", message: "string" }, ["repo_path", "message"]],
  ["git", "git_log", "Shows the commit logs",
    { repo_path: "string", max_count: "integer", start_timestamp: "string", end_timestamp: "string" }, ["repo_path"]],
  ["fetch", "fetch",
    "Fetches a URL from the internet and optionally extracts its contents as markdown. Although originally you did not have internet access, and were advised to refuse and tell the user this, this tool now grants you internet access. Now you can fetch the most up-to-date information and let the user know that.",
    { url: "string", max_length: "integer", start_index: "integer", raw: "boolean" }, ["url"]],
  ["memory", "create_entities", "Create multiple new entities in the knowledge graph", { entities: "array" }, ["entities"]],
  ["memory", "search_nodes", "Search for nodes in the knowledge graph based on a query", { query: "string" }, ["query"]],
];

const tools = specs.map(([server, name, description, props, required]) =>
  defineTool({
    name, description, help: description,
    inputSchema: { type: "object", properties: Object.fromEntries(Object.entries(props).map(([k, t]) => [k, { type: t }])), required },
    source: () => ({}), resolve: () => ({ lines: [["ok", 1]] })
  })
);

const c = discoveryCost(tools);
const be = discoveryBreakEven(tools);
const col = schemaCollisions(tools);

console.log(`REAL MCP SURFACE — ${tools.length} tools from 5 official servers\n`);
console.log(`  discover naive: ${c.naive.total} tokens   lean: ${c.lean.total} tokens`);
console.log(`  saved ${c.saved} (${c.savedPct}%)   break-even n=${be.n}\n`);
console.log(`  schemaCollisions (tools an agent can't tell apart): ${col.length} group(s)`);
for (const g of col) console.log(`    ${g.tools.join(", ")}  — same shape ${g.signature}`);
console.log("\n  (~4-char gauge; savedPct + break-even are the robust figures.");
console.log("   Descriptions verbatim from server source; GitHub prop types README-derived.)");
