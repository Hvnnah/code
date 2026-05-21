import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AddOnContext, AddOnDefinition } from "./types";

const ztkOptionsSchema = z.object({
  /**
   * Absolute path to the ztk binary. When omitted, the add-on looks on
   * `$PATH` and a small set of known install locations.
   */
  binaryPath: z.string().optional(),
  /**
   * Forwarded to `ztk run --skip-permissions`. Tells ztk to bypass its own
   * approval prompts because Claude's permission model already gates Bash.
   */
  skipPermissions: z.boolean().optional(),
});

export type ZtkOptions = z.infer<typeof ztkOptionsSchema>;

const KNOWN_INSTALL_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

function resolveZtkBinary(options: ZtkOptions): string {
  if (options.binaryPath) {
    if (!existsSync(options.binaryPath)) {
      throw new Error(
        `ztk add-on: binary not found at configured path "${options.binaryPath}"`,
      );
    }
    return options.binaryPath;
  }

  const pathDirs = (process.env.PATH ?? "").split(":").filter(Boolean);
  const homeBin = process.env.HOME
    ? join(process.env.HOME, ".local/bin")
    : null;
  const candidates = [...pathDirs, ...KNOWN_INSTALL_DIRS];
  if (homeBin) candidates.push(homeBin);

  for (const dir of candidates) {
    const candidate = join(dir, "ztk");
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    'ztk add-on: binary "ztk" not found on PATH. Install it from ' +
      "https://github.com/codejunkie99/ztk or set add-on option `binaryPath` to an absolute path.",
  );
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function makeZtkBashHook(
  binaryPath: string,
  options: ZtkOptions,
): HookCallback {
  const flag = options.skipPermissions ? " --skip-permissions" : "";
  const escapedBinary = shellEscape(binaryPath);
  return async (input) => {
    if (input.hook_event_name !== "PreToolUse") return { continue: true };
    if (input.tool_name !== "Bash") return { continue: true };

    const toolInput = (input.tool_input ?? {}) as { command?: unknown };
    const command = toolInput.command;
    if (typeof command !== "string" || command.length === 0) {
      return { continue: true };
    }

    // Already wrapped — don't double-wrap if the hook runs twice for some reason.
    if (command.startsWith(`${escapedBinary} run`)) {
      return { continue: true };
    }

    const rewritten = `${escapedBinary} run${flag} -- ${command}`;
    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        updatedInput: {
          ...(input.tool_input as Record<string, unknown>),
          command: rewritten,
        },
      },
    };
  };
}

export const ztkAddOn: AddOnDefinition<ZtkOptions> = {
  name: "ztk",
  requires: ["preToolUse"],
  // ztk needs to mutate Bash tool input before execution. Only Claude exposes
  // a PreToolUse hook with `updatedInput`; the codex-acp binary has no
  // equivalent interception point, so the add-on is silently skipped there.
  supportedAdapters: ["claude"],
  parseOptions(rawOptions) {
    return ztkOptionsSchema.parse(rawOptions ?? {});
  },
  prepare(_ctx: AddOnContext, options: ZtkOptions) {
    // Resolve eagerly so the user sees a missing-binary error at session
    // start rather than on the first Bash call.
    resolveZtkBinary(options);
  },
  contribute(_ctx: AddOnContext, options: ZtkOptions) {
    const binaryPath = resolveZtkBinary(options);
    return {
      preToolUse: [makeZtkBashHook(binaryPath, options)],
    };
  },
};
