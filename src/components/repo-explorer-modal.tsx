"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { RepoDetailResponse } from "@/lib/repo-detail-types";
import "@/styles/hljs-dark.css";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import swift from "highlight.js/lib/languages/swift";
import {
  Loader2,
  AlertTriangle,
  Star,
  GitFork,
  GitBranch,
  ExternalLink,
  Folder,
  FileText,
  ChevronRight,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("swift", swift);

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript",
  py: "python", pyw: "python",
  css: "css", scss: "css", less: "css",
  html: "xml", htm: "xml", xml: "xml", svg: "xml",
  json: "json", jsonc: "json",
  md: "markdown", mdx: "markdown",
  sh: "bash", bash: "bash", zsh: "bash",
  yml: "yaml", yaml: "yaml",
  rs: "rust",
  go: "go",
  java: "java",
  swift: "swift",
};

interface FileContent {
  name: string;
  path: string;
  size: number;
  content: string;
  htmlUrl: string;
  downloadUrl: string | null;
  isImage: boolean;
}

interface RepoExplorerModalProps {
  repo: string | null;
  onClose: () => void;
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden flex flex-col ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="p-3.5 flex flex-col flex-1">{children}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className="rounded-lg px-2.5 py-2 text-center"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      <Icon className="h-3.5 w-3.5 text-gray-400 mx-auto mb-1" />
      <p className="text-xs font-semibold font-mono text-gray-200">{value}</p>
      <p className="text-[8px] text-gray-500 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getLanguageForFile(filename: string): string | undefined {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_LANG[ext];
}

function HighlightedCode({ content, filename }: { content: string; filename: string }) {
  const highlighted = useMemo(() => {
    const lang = getLanguageForFile(filename);
    if (lang) {
      try {
        return hljs.highlight(content, { language: lang }).value;
      } catch {
        // fall through
      }
    }
    // Try auto-detect
    try {
      const result = hljs.highlightAuto(content);
      if (result.relevance > 5) return result.value;
    } catch {
      // fall through
    }
    return null;
  }, [content, filename]);

  const lines = useMemo(() => {
    if (highlighted) {
      // Split highlighted HTML by newlines while preserving span tags across lines
      return splitHighlightedLines(highlighted);
    }
    return content.split("\n");
  }, [content, highlighted]);

  const codeRef = useRef<HTMLTableSectionElement>(null);

  return (
    <div
      className="rounded-lg overflow-auto min-h-0 max-h-[50vh]"
      style={{
        background: "rgba(0, 0, 0, 0.3)",
        border: "1px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      <table className="w-full border-collapse">
        <tbody ref={codeRef}>
          {lines.map((line, i) => (
            <tr
              key={i}
              className="hover:bg-white/[0.02] transition-colors"
            >
              <td
                className="px-3 py-0 text-right select-none align-top sticky left-0"
                style={{ background: "rgba(0, 0, 0, 0.2)" }}
              >
                <span className="text-[10px] text-gray-600 font-mono leading-5">
                  {i + 1}
                </span>
              </td>
              <td className="px-3 py-0">
                {highlighted ? (
                  <pre
                    className="text-[11px] font-mono leading-5 whitespace-pre hljs"
                    dangerouslySetInnerHTML={{ __html: line || " " }}
                  />
                ) : (
                  <pre className="text-[11px] text-gray-300 font-mono leading-5 whitespace-pre">
                    {line || " "}
                  </pre>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImagePreview({ file }: { file: FileContent }) {
  const src = file.downloadUrl;
  if (!src) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-gray-500">
        Image preview not available
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-auto min-h-0 max-h-[50vh] flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.3)",
        border: "1px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={file.name}
        className="object-contain rounded"
      />
    </div>
  );
}

/** Split highlight.js HTML output into lines, carrying open spans across line breaks */
function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  let currentLine = "";
  let openSpans: string[] = [];

  // Simple parser: walk through the HTML splitting on \n
  let i = 0;
  while (i < html.length) {
    if (html[i] === "\n") {
      // Close open spans for this line
      lines.push(currentLine + openSpans.map(() => "</span>").reverse().join(""));
      // Re-open spans for next line
      currentLine = openSpans.join("");
      i++;
    } else if (html[i] === "<") {
      const closeMatch = html.slice(i).match(/^<\/span>/);
      if (closeMatch) {
        currentLine += closeMatch[0];
        openSpans.pop();
        i += closeMatch[0].length;
      } else {
        const openMatch = html.slice(i).match(/^<span[^>]*>/);
        if (openMatch) {
          currentLine += openMatch[0];
          openSpans.push(openMatch[0]);
          i += openMatch[0].length;
        } else {
          currentLine += html[i];
          i++;
        }
      }
    } else {
      currentLine += html[i];
      i++;
    }
  }
  lines.push(currentLine);
  return lines;
}

function FileBrowserCard({
  repoName,
  currentPath,
  pathSegments,
  tree,
  loading,
  viewingFile,
  fileLoading,
  fileError,
  copied,
  onNavigate,
  onOpenFile,
  onCloseFile,
  onCopy,
}: {
  repoName: string;
  currentPath: string;
  pathSegments: string[];
  tree: RepoDetailResponse["tree"];
  loading: boolean;
  viewingFile: FileContent | null;
  fileLoading: boolean;
  fileError: string | null;
  copied: boolean;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onCloseFile: () => void;
  onCopy: () => void;
}) {
  const isViewingFile = viewingFile || fileLoading || fileError;

  return (
    <GlassCard className="min-h-[350px] flex flex-col">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {isViewingFile ? (
          /* ---- FILE VIEW ---- */
          <div className="flex flex-col flex-1 min-h-0">
            {/* Back button + file header */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <button
                onClick={onCloseFile}
                className="p-1 rounded hover:bg-white/[0.06] transition-colors shrink-0"
                title="Back to files"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-gray-400 hover:text-gray-200" />
              </button>
              {viewingFile && (
                <>
                  <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-200 font-mono truncate flex-1">
                    {viewingFile.path}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono shrink-0">
                    {formatSize(viewingFile.size)}
                  </span>
                  {!viewingFile.isImage && (
                    <button
                      onClick={onCopy}
                      className="p-1 rounded hover:bg-white/[0.06] transition-colors shrink-0"
                      title="Copy file contents"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300" />
                      )}
                    </button>
                  )}
                  <a
                    href={viewingFile.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-white/[0.06] transition-colors shrink-0"
                    title="View on GitHub"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300" />
                  </a>
                </>
              )}
              {fileLoading && !viewingFile && (
                <span className="text-xs text-gray-500">Loading file...</span>
              )}
            </div>

            {fileLoading && (
              <div className="flex items-center justify-center flex-1 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-green-400" />
              </div>
            )}

            {fileError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {fileError}
              </div>
            )}

            {viewingFile && !fileLoading && (
              viewingFile.isImage ? (
                <ImagePreview file={viewingFile} />
              ) : (
                <HighlightedCode content={viewingFile.content} filename={viewingFile.name} />
              )
            )}
          </div>
        ) : (
          /* ---- DIRECTORY VIEW ---- */
          <>
            <div className="flex items-center gap-2 mb-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                Files
              </p>
              {loading && (
                <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
              )}
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              <button
                onClick={() => onNavigate("")}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-mono"
              >
                {repoName}
              </button>
              {pathSegments.map((segment, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-gray-600" />
                  <button
                    onClick={() =>
                      onNavigate(pathSegments.slice(0, i + 1).join("/"))
                    }
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-mono"
                  >
                    {segment}
                  </button>
                </span>
              ))}
            </div>

            {/* Directory listing */}
            <div className="space-y-0.5">
              {currentPath && (
                <button
                  onClick={() =>
                    onNavigate(pathSegments.slice(0, -1).join("/"))
                  }
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors group"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-xs text-gray-400 font-mono">..</span>
                </button>
              )}
              {tree.map((entry) => (
                <div key={entry.path}>
                  {entry.type === "dir" ? (
                    <button
                      onClick={() => onNavigate(entry.path)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors group text-left"
                    >
                      <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span className="text-xs text-gray-200 font-mono truncate flex-1">
                        {entry.name}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenFile(entry.path)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors text-left group"
                    >
                      <FileText className="h-3.5 w-3.5 text-gray-500 group-hover:text-gray-300 shrink-0 transition-colors" />
                      <span className="text-xs text-gray-400 group-hover:text-gray-200 font-mono truncate flex-1 transition-colors">
                        {entry.name}
                      </span>
                      {entry.size > 0 && (
                        <span className="text-[10px] text-gray-600 font-mono shrink-0">
                          {formatSize(entry.size)}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              ))}
              {tree.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">
                  Empty directory
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}

export function RepoExplorerModal({ repo, onClose }: RepoExplorerModalProps) {
  const [data, setData] = useState<RepoDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [viewingFile, setViewingFile] = useState<FileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(
    (path: string) => {
      if (!repo) return;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ repo });
      if (path) params.set("path", path);

      fetch(`/api/repo-detail?${params}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.error) throw new Error(json.error);
          setData(json);
          setCurrentPath(path);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [repo]
  );

  const fetchFile = useCallback(
    (filePath: string) => {
      if (!repo) return;
      setFileLoading(true);
      setFileError(null);

      const params = new URLSearchParams({ repo, path: filePath });

      fetch(`/api/repo-file?${params}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.error) throw new Error(json.error);
          setViewingFile(json);
        })
        .catch((err) => setFileError(err.message))
        .finally(() => setFileLoading(false));
    },
    [repo]
  );

  useEffect(() => {
    if (repo) {
      setData(null);
      setCurrentPath("");
      setViewingFile(null);
      setFileError(null);
      fetchData("");
    }
  }, [repo, fetchData]);

  const navigateTo = (path: string) => {
    setViewingFile(null);
    setFileError(null);
    fetchData(path);
  };

  const openFile = (filePath: string) => {
    fetchFile(filePath);
  };

  const closeFile = () => {
    setViewingFile(null);
    setFileError(null);
  };

  const copyToClipboard = () => {
    if (!viewingFile) return;
    navigator.clipboard.writeText(viewingFile.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const pathSegments = currentPath
    ? currentPath.split("/").filter(Boolean)
    : [];

  const repoName = repo?.includes("/") ? repo.split("/")[1] : repo;

  return (
    <Dialog open={!!repo} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent" />

        <DialogHeader className="relative">
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            {repoName}
            {repo && (
              <a
                href={`https://github.com/${repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            {repo}
          </DialogDescription>
        </DialogHeader>

        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <div className="relative">
              <Loader2 className="h-7 w-7 animate-spin text-green-400" />
              <div className="absolute inset-0 h-7 w-7 animate-ping rounded-full bg-green-400/20" />
            </div>
          </div>
        )}

        {error && !data && (
          <GlassCard className="border-red-500/20">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </GlassCard>
        )}

        {data && (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 relative min-h-0 flex-1">
            {/* Metadata row */}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat
                label="Stars"
                value={data.metadata.stars.toLocaleString()}
                icon={Star}
              />
              <MiniStat
                label="Forks"
                value={data.metadata.forks.toLocaleString()}
                icon={GitFork}
              />
              <MiniStat
                label="Branch"
                value={data.metadata.defaultBranch}
                icon={GitBranch}
              />
            </div>

            {/* Description */}
            {data.metadata.description && (
              <GlassCard>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {data.metadata.description}
                </p>
                {data.metadata.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {data.metadata.topics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400/80"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Recent Commits */}
            <GlassCard>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2.5">
                Recent Commits
              </p>
              <div className="space-y-2">
                {data.commits.map((commit) => (
                  <div
                    key={commit.sha}
                    className="flex items-start gap-2 group"
                  >
                    <code className="text-[10px] text-gray-500 font-mono shrink-0 mt-0.5">
                      {commit.sha}
                    </code>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300 truncate">
                        {commit.message}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {commit.authorName} &middot;{" "}
                        {formatRelativeTime(commit.date)}
                      </p>
                    </div>
                    <a
                      href={commit.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="h-3 w-3 text-gray-500 hover:text-gray-300" />
                    </a>
                  </div>
                ))}
                {data.commits.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">
                    No commits found
                  </p>
                )}
              </div>
            </GlassCard>

            {/* File Browser / Viewer */}
            <FileBrowserCard
              repoName={repoName || ""}
              currentPath={currentPath}
              pathSegments={pathSegments}
              tree={data.tree}
              loading={loading}
              viewingFile={viewingFile}
              fileLoading={fileLoading}
              fileError={fileError}
              copied={copied}
              onNavigate={navigateTo}
              onOpenFile={openFile}
              onCloseFile={closeFile}
              onCopy={copyToClipboard}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
