export interface RepoMetadata {
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  htmlUrl: string;
  defaultBranch: string;
  topics: string[];
}

export interface RepoCommit {
  sha: string;
  message: string;
  authorName: string;
  date: string;
  htmlUrl: string;
}

export interface TreeEntry {
  name: string;
  path: string;
  type: "dir" | "file";
  size: number;
}

export interface RepoDetailResponse {
  metadata: RepoMetadata;
  commits: RepoCommit[];
  tree: TreeEntry[];
  currentPath: string;
}
