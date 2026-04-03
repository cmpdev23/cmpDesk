#!/usr/bin/env python3
"""
print_tree.py — Générateur d'arborescence sélectif pour montages_dossiers_v2
=============================================================================
Usage :
  python scripts/print_tree.py              → racine du projet
  python scripts/print_tree.py src          → dossier src/
  python scripts/print_tree.py lib          → dossier lib/
  python scripts/print_tree.py inspectors   → dossier inspectors/

Le chemin est toujours résolu depuis la racine du projet,
peu importe depuis quel répertoire vous lancez le script.
"""

import os
import sys

# ─────────────────────────────────────────────────────────────
# CONFIGURATION — modifiez TARGET_PATH OU passez un argument CLI
# ─────────────────────────────────────────────────────────────
TARGET_PATH = "src"          # "" = racine du projet
# Exemples :
# TARGET_PATH = "lib"
# TARGET_PATH = "scripts"
# TARGET_PATH = "inspectors/case"
# ─────────────────────────────────────────────────────────────

# Dossiers complètement ignorés (jamais descendus)
IGNORE_DIRS = {
    # Node.js / JavaScript
    "node_modules",

    # Python
    "__pycache__",
    ".venv",
    "venv",
    "env",
    "ENV",
    ".eggs",
    "*.egg-info",
    "build",
    "dist",
    "eggs",
    "wheels",
    "sdist",

    # IDE / Editors
    ".vscode",
    ".idea",

    # Git
    ".git",

    # Auth / Sensitive (browser profiles)
    "browser_profile",

    # Roo / AI
    ".roo",

    # Data outputs (may contain large files)
    "data",

    # Test files (seeds/files contains test PDFs)
    "files",  # scripts/seeds/files/

    # Logs
    "logs",
    "report",

    # Python utilities (ignored in .rooignore)
    "py_utils",
}

# Extensions de fichiers ignorées
IGNORE_FILES_EXT = {
    ".log",
    ".lock",
    ".zip",
    ".map",
    ".tsbuildinfo",
    ".pyc",
    ".pyo",
    ".pyd",
    ".so",
    ".egg",
    ".swp",
    ".swo",
}

# Fichiers ignorés par nom exact
IGNORE_FILES = {
    # Lock files
    "package-lock.json",
    "yarn.lock",

    # Environment files (sensitive)
    ".env",
    ".env.local",
    ".env.development.local",
    ".env.test.local",
    ".env.production.local",

    # Session files (sensitive)
    "session.json",
    "storage_state.json",
    "session_state.json",
    "persisted_cookies.json",
    "salesforce_cookies.json",

    # This script itself
    "print_tree.py",

    # IDE config
    ".DS_Store",
    "Thumbs.db",

    # Copilot/AI ignore files
    ".copilotignore",
    ".rooignore",
}

# Racine du projet = dossier parent du dossier scripts/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)


# ─────────────────────────────────────────────────────────────
# Fonctions
# ─────────────────────────────────────────────────────────────

def print_tree(directory: str, prefix: str = "") -> None:
    """Affiche récursivement l'arborescence d'un dossier."""
    try:
        entries = sorted(os.listdir(directory))
    except PermissionError:
        print(f"{prefix}[Permission refusée]")
        return
    except FileNotFoundError:
        print(f"{prefix}[Dossier introuvable]")
        return

    filtered: list[str] = []
    for entry in entries:
        path = os.path.join(directory, entry)
        if os.path.isdir(path) and entry in IGNORE_DIRS:
            continue
        if os.path.isfile(path):
            if entry in IGNORE_FILES:
                continue
            if any(entry.endswith(ext) for ext in IGNORE_FILES_EXT):
                continue
        filtered.append(entry)

    total = len(filtered)
    for idx, entry in enumerate(filtered):
        path = os.path.join(directory, entry)
        is_last = idx == total - 1
        connector = "└── " if is_last else "├── "
        icon = "📁 " if os.path.isdir(path) else ""
        print(f"{prefix}{connector}{icon}{entry}")
        if os.path.isdir(path):
            extension = "    " if is_last else "│   "
            print_tree(path, prefix + extension)


def build_parent_tree(path_parts: list[str]) -> list[str]:
    """Construit l'affichage des dossiers parents jusqu'à la cible."""
    lines: list[str] = []
    for i, part in enumerate(path_parts):
        if i == 0:
            lines.append(f"📁 {part}/")
        else:
            indent = "    " * i
            lines.append(f"{indent}└── 📁 {part}/")
    return lines


def resolve_target(raw: str) -> tuple[str, str]:
    """
    Retourne (absolute_path, display_label).
    raw peut être "" (racine), un chemin relatif ou absolu.
    """
    if not raw:
        return PROJECT_ROOT, os.path.basename(PROJECT_ROOT)

    normalized = os.path.normpath(raw)

    # Chemin absolu fourni directement ?
    if os.path.isabs(normalized) and os.path.exists(normalized):
        return normalized, normalized

    # Chemin relatif depuis la racine du projet
    candidate = os.path.join(PROJECT_ROOT, normalized)
    if os.path.exists(candidate):
        return candidate, normalized

    # Chemin relatif depuis le répertoire courant (fallback)
    candidate2 = os.path.join(os.getcwd(), normalized)
    if os.path.exists(candidate2):
        return candidate2, normalized

    return "", normalized   # introuvable


def main() -> None:
    # Priorité : argument CLI > TARGET_PATH constant
    raw = sys.argv[1] if len(sys.argv) > 1 else TARGET_PATH

    absolute_path, label = resolve_target(raw)

    if not absolute_path:
        print(f"❌  Chemin introuvable : '{label}'")
        print(f"    Racine projet      : {PROJECT_ROOT}")
        sys.exit(1)

    if not os.path.isdir(absolute_path):
        print(f"❌  '{label}' n'est pas un dossier.")
        sys.exit(1)

    # ── Affichage ──────────────────────────────────────────
    if not raw:
        # Racine : affiche directement
        root_name = os.path.basename(PROJECT_ROOT)
        print(f"📁 {root_name}/")
        print_tree(absolute_path, "")
    else:
        path_parts = os.path.normpath(raw).split(os.sep)
        for line in build_parent_tree(path_parts):
            print(line)
        indent = "    " * len(path_parts)
        print_tree(absolute_path, indent)

    print(f"\n✅  Arborescence de '{label or os.path.basename(PROJECT_ROOT)}' affichée.")


if __name__ == "__main__":
    main()
