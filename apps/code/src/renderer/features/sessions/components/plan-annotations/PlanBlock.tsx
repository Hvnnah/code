import { CommentAnnotation } from "@features/code-review/components/CommentAnnotation";
import { useReviewDraftsStore } from "@features/code-review/stores/reviewDraftsStore";
import { ChatTeardropDots, Plus } from "@phosphor-icons/react";
import { IconButton } from "@radix-ui/themes";
import type { Element } from "hast";
import { createElement, type ReactNode, useState } from "react";

export function planScopeKey(toolCallId: string): string {
  return `plan:${toolCallId}`;
}

interface PlanBlockBaseProps {
  taskId: string;
  toolCallId: string;
  node?: Element;
  children: ReactNode;
}

interface UsePlanBlockResult {
  startLine: number;
  endLine: number;
  draftCount: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  scopeKey: string;
  showButton: boolean;
}

function usePlanBlock(
  taskId: string,
  toolCallId: string,
  node: Element | undefined,
): UsePlanBlockResult {
  const [open, setOpen] = useState(false);
  const scopeKey = planScopeKey(toolCallId);
  const startLine = node?.position?.start?.line ?? 0;
  const endLine = node?.position?.end?.line ?? startLine;

  const draftCount = useReviewDraftsStore(
    (s) =>
      (s.drafts[taskId] ?? []).filter(
        (d) => d.filePath === scopeKey && d.startLine === startLine,
      ).length,
  );

  return {
    startLine,
    endLine,
    draftCount,
    open,
    setOpen,
    scopeKey,
    showButton: startLine > 0,
  };
}

function GutterButton({
  hasDraft,
  draftCount,
  offset = 7,
  onClick,
}: {
  hasDraft: boolean;
  draftCount: number;
  offset?: number;
  onClick: () => void;
}) {
  return (
    <IconButton
      size="1"
      variant="ghost"
      color={hasDraft ? "blue" : "gray"}
      style={{ left: `-${offset * 4}px` }}
      className={`absolute top-1 transition-opacity ${
        hasDraft
          ? "text-(--accent-11) opacity-100"
          : "opacity-0 group-hover:opacity-100"
      }`}
      onClick={onClick}
      aria-label={hasDraft ? "Add another comment" : "Add comment"}
      title={
        hasDraft
          ? `${draftCount} comment${draftCount === 1 ? "" : "s"} on this block`
          : "Comment on this block"
      }
    >
      {hasDraft ? (
        <ChatTeardropDots size={14} weight="fill" />
      ) : (
        <Plus size={12} />
      )}
    </IconButton>
  );
}

const HAS_DRAFT_WRAPPER_CLASS =
  "border-(--accent-9) border-l-2 pl-3 -ml-3 bg-(--accent-2) rounded-r-sm";

const HAS_DRAFT_LI_CLASS =
  "bg-(--accent-2) rounded-r-(--radius-2) px-2 marker:text-(--accent-9) shadow-[-2px_0_0_var(--accent-9)]";

function CommentInput({
  taskId,
  scopeKey,
  startLine,
  endLine,
  onDismiss,
}: {
  taskId: string;
  scopeKey: string;
  startLine: number;
  endLine: number;
  onDismiss: () => void;
}) {
  return (
    <div className="not-prose mt-2 rounded-md border border-(--gray-6) bg-(--gray-2)">
      <CommentAnnotation
        taskId={taskId}
        filePath={scopeKey}
        startLine={startLine}
        endLine={endLine}
        side="additions"
        onDismiss={onDismiss}
        forceBatch
        placeholder="Leave a comment on this part of the plan..."
      />
    </div>
  );
}

export type WrappableTag =
  | "p"
  | "blockquote"
  | "pre"
  | "table"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

interface PlanWrappableBlockProps extends PlanBlockBaseProps {
  tag: WrappableTag;
  className?: string;
}

export function PlanWrappableBlock({
  tag,
  taskId,
  toolCallId,
  node,
  children,
  className,
}: PlanWrappableBlockProps) {
  const {
    startLine,
    endLine,
    draftCount,
    open,
    setOpen,
    scopeKey,
    showButton,
  } = usePlanBlock(taskId, toolCallId, node);

  return (
    <div
      className={`group relative ${draftCount > 0 ? HAS_DRAFT_WRAPPER_CLASS : ""}`}
    >
      {showButton && (
        <GutterButton
          hasDraft={draftCount > 0}
          draftCount={draftCount}
          onClick={() => setOpen(true)}
        />
      )}
      {createElement(tag, { className }, children)}
      {open && (
        <CommentInput
          taskId={taskId}
          scopeKey={scopeKey}
          startLine={startLine}
          endLine={endLine}
          onDismiss={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function PlanListItemBlock({
  taskId,
  toolCallId,
  node,
  children,
  className,
}: PlanBlockBaseProps & { className?: string }) {
  const {
    startLine,
    endLine,
    draftCount,
    open,
    setOpen,
    scopeKey,
    showButton,
  } = usePlanBlock(taskId, toolCallId, node);

  return (
    <li
      className={`group relative ${className ?? ""} ${
        draftCount > 0 ? HAS_DRAFT_LI_CLASS : ""
      }`}
    >
      {showButton && (
        <GutterButton
          hasDraft={draftCount > 0}
          draftCount={draftCount}
          offset={9}
          onClick={() => setOpen(true)}
        />
      )}
      {children}
      {open && (
        <CommentInput
          taskId={taskId}
          scopeKey={scopeKey}
          startLine={startLine}
          endLine={endLine}
          onDismiss={() => setOpen(false)}
        />
      )}
    </li>
  );
}
