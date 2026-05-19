import type { AcpMessage } from "@shared/types/session-events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@renderer/trpc/client", () => ({
  trpc: {
    git: {
      searchGithubRefs: {
        queryOptions: () => ({ queryKey: [], queryFn: () => [] }),
      },
    },
  },
}));

vi.mock("@renderer/trpc", () => ({
  trpcClient: {
    secureStore: {
      getItem: { query: vi.fn().mockResolvedValue(null) },
      setItem: { query: vi.fn().mockResolvedValue(undefined) },
      removeItem: { query: vi.fn().mockResolvedValue(undefined) },
    },
  },
}));

import { useSessionStore } from "../../sessions/stores/sessionStore";
import { useDraftStore } from "../stores/draftStore";
import { getCommandSuggestions } from "./getSuggestions";

const SESSION_ID = "task-123";
const TASK_ID = "task-123";
const TASK_RUN_ID = "run-1";

function seedDraftCommands(commands: { name: string; description: string }[]) {
  useDraftStore.getState().actions.setCommands(SESSION_ID, commands);
}

function seedSessionContext(taskId: string | undefined) {
  useDraftStore.getState().actions.setContext(SESSION_ID, { taskId });
}

function seedSessionAvailableCommands(
  commands: { name: string; description: string }[],
) {
  const events: AcpMessage[] = [
    {
      direction: "agent_to_client",
      message: {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: TASK_RUN_ID,
          update: {
            sessionUpdate: "available_commands_update",
            availableCommands: commands,
          },
        },
      },
    } as unknown as AcpMessage,
  ];

  useSessionStore.setState((state) => {
    state.sessions[TASK_RUN_ID] = {
      taskId: TASK_ID,
      taskRunId: TASK_RUN_ID,
      events,
      processedLineCount: 0,
      configOptions: [],
      pendingPermissions: new Map(),
      messageQueue: [],
      optimisticItems: [],
    } as unknown as (typeof state.sessions)[string];
    state.taskIdIndex[TASK_ID] = TASK_RUN_ID;
  });
}

function resetStores() {
  useDraftStore.setState((state) => {
    state.commands = {};
    state.contexts = {};
  });
  useSessionStore.setState((state) => {
    state.sessions = {};
    state.taskIdIndex = {};
  });
}

describe("getCommandSuggestions", () => {
  beforeEach(resetStores);

  it("returns built-in /good /bad /feedback commands when nothing else is available", () => {
    const suggestions = getCommandSuggestions(SESSION_ID, "");
    const names = suggestions.map((s) => s.command.name);
    expect(names).toContain("good");
    expect(names).toContain("bad");
    expect(names).toContain("feedback");
  });

  it("includes agent-supplied skills from session events when available", () => {
    seedSessionContext(TASK_ID);
    seedSessionAvailableCommands([
      { name: "review", description: "Review code" },
      { name: "ship-it", description: "Ship the change" },
    ]);

    const names = getCommandSuggestions(SESSION_ID, "").map(
      (s) => s.command.name,
    );

    expect(names).toEqual(expect.arrayContaining(["review", "ship-it"]));
  });

  it("falls back to draft-store skills when the session has no available_commands_update yet", () => {
    // Running task whose agent hasn't sent commands yet.
    seedSessionContext(TASK_ID);
    seedDraftCommands([{ name: "review", description: "Review code" }]);

    const names = getCommandSuggestions(SESSION_ID, "").map(
      (s) => s.command.name,
    );

    expect(names).toContain("review");
  });

  it("prefers agent-supplied commands over draft-store fallback once the session reports them", () => {
    seedSessionContext(TASK_ID);
    seedDraftCommands([
      { name: "fallback-only", description: "Should not appear" },
    ]);
    seedSessionAvailableCommands([
      { name: "agent-cmd", description: "From agent" },
    ]);

    const names = getCommandSuggestions(SESSION_ID, "").map(
      (s) => s.command.name,
    );

    expect(names).toContain("agent-cmd");
    expect(names).not.toContain("fallback-only");
  });

  it("uses draft-store skills when there is no running task", () => {
    seedDraftCommands([{ name: "my-skill", description: "User skill" }]);

    const names = getCommandSuggestions(SESSION_ID, "").map(
      (s) => s.command.name,
    );

    expect(names).toContain("my-skill");
  });
});
