import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const exports = {};
const fakeRequire = (name) => name === "@/v2/api" || name === "@/v2/state" || name === "../artifact" || name === "./toc" ? {} : require(name);
vm.runInNewContext(code, { exports, require: fakeRequire });

function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node !== "object") return String(node);
  return text(node.props.children);
}

// The fixtures ship with the morphloop SDK (the locked Python dependency).
const contracts =
  process.env.MORPHLOOP_CONTRACTS_DIR ??
  execFileSync("uv", ["run", "--project", "..", "python", "-c", "from harness.testing import CONTRACTS_DIR; print(CONTRACTS_DIR)"], { encoding: "utf8" }).trim();
const plaintextDir = `${contracts}/fixtures/plaintext`;

for (const file of readdirSync(plaintextDir)) {
  const fixture = JSON.parse(readFileSync(`${plaintextDir}/${file}`, "utf8"));
  const result = exports.renderBlock(fixture.markdown);
  assert.equal(text(result.content), fixture.plaintext, file);
  assert.equal(result.artifacts.length, (file.startsWith("artifact-") && !file.includes("lookalike") && !file.includes("multiline") ? 1 : 0), file);
}

// Edge cases the Python extractor pins but no fixture covers yet.
for (const [markdown, plaintext, artifacts] of [
  ["![first\nsecond](x)", "first\nsecond", 0],
  ["<p>if (a < b) alert(1);</p>", "if (a < b) alert(1);", 0],
  ["Before\r::artifact{type=lab ref=x}\rAfter", "Before\nAfter", 1],
]) {
  const result = exports.renderBlock(markdown);
  assert.equal(text(result.content), plaintext, JSON.stringify(markdown));
  assert.equal(result.artifacts.length, artifacts, JSON.stringify(markdown));
}
