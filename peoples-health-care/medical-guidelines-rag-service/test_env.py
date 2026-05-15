"""
test_env.py  —  PDF ingestion with CORRECT page number metadata
================================================================

Supports TWO different PDF page-number formats:

  1. Hypertension PDF  →  footer pattern  "- X -"
     (number appears at the bottom of each page)

  2. Diabetes PDF  →  header pattern  "   X \\n"
     (number appears at the top of each page, isolated on its own line)

During ingestion each chunk receives:
  metadata["printed_page"]   — the actual integer printed on that physical page
  metadata["is_frontmatter"] — True for cover / TOC / abbreviations pages
  metadata["source_doc"]     — "hypertension" | "diabetes" | "unknown"

When none is found (front-matter), printed_page = -1.
The API matches user page requests against printed_page directly.
No offset arithmetic needed. No mismatch possible.
"""

import os
import re
import shutil
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from dotenv import load_dotenv

load_dotenv()

DOCS_PATH            = "docs"
DB_PATH              = "db/chroma_db"
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en"

# ── PAGE NUMBER PATTERNS ──────────────────────────────────────────────────────
#
# Hypertension PDF:  footer pattern "- 12 -" anywhere in the page text
FOOTER_RE = re.compile(r"-\s*(\d{1,3})\s*-")
#
# Diabetes PDF:  the printed page number sits ALONE on the very first
# non-blank line of each page, e.g.:
#     \n   3 \n  \nChapter 1 …
# We search only the first 100 chars to avoid picking up body numbers.
HEADER_RE = re.compile(r"^\s*(\d{1,3})\s*\n", re.MULTILINE)


# ── EXTRACTORS ────────────────────────────────────────────────────────────────

def extract_hypertension_page(text: str) -> int | None:
    """Footer pattern: - X -  (only accept numbers < 200)"""
    matches    = FOOTER_RE.findall(text)
    candidates = [int(m) for m in matches if int(m) < 200]
    return candidates[-1] if candidates else None


def extract_diabetes_page(text: str) -> int | None:
    """
    Header pattern: isolated page number on first non-blank line.
    Searches only the first 100 characters (never in body text).
    Only accepts numbers < 300 (Diabetes PDF has 194 numbered pages).
    """
    m = HEADER_RE.search(text[:100])
    if m:
        val = int(m.group(1))
        if val < 300:
            return val
    return None


# ── SOURCE DETECTION ─────────────────────────────────────────────────────────

def detect_source_doc(source_path: str) -> str:
    """Label by filename; extendable for future PDFs."""
    name = os.path.basename(source_path).lower()
    if "diabet" in name:
        return "diabetes"
    if "hypert" in name:
        return "hypertension"
    return "unknown"


# ── PIPELINE ─────────────────────────────────────────────────────────────────

def load_documents(docs_path: str = DOCS_PATH) -> list:
    print(f"Loading documents from '{docs_path}' ...")
    if not os.path.exists(docs_path):
        os.makedirs(docs_path)
        raise FileNotFoundError(
            f"Created '{docs_path}'. Drop your PDF(s) there and re-run."
        )
    loader = DirectoryLoader(
        path=docs_path,
        glob="*.pdf",
        loader_cls=PyPDFLoader,
    )
    documents = loader.load()
    if not documents:
        raise FileNotFoundError(f"No PDF files found in '{docs_path}'.")

    print(f"Loaded {len(documents)} raw pages from PyPDF.")
    return documents


def enrich_metadata(documents: list) -> list:
    """
    Add printed_page, is_frontmatter, source_doc to every LangChain Document.

    Dispatch:
      diabetes     -> extract_diabetes_page    (header  \\n   N \\n)
      hypertension -> extract_hypertension_page (footer  - N -)
      unknown      -> tries footer, then header

    printed_page = -1 means front-matter (no number found).
    """
    print("Enriching metadata with printed page numbers ...")
    stats: dict[str, list[int]] = {}   # source -> [content_pages, frontmatter_pages]

    for doc in documents:
        text   = doc.page_content
        source = detect_source_doc(doc.metadata.get("source", ""))
        doc.metadata["source_doc"] = source

        if source == "hypertension":
            printed_page = extract_hypertension_page(text)
        elif source == "diabetes":
            printed_page = extract_diabetes_page(text)
        else:
            printed_page = extract_hypertension_page(text) or extract_diabetes_page(text)

        is_frontmatter = printed_page is None
        doc.metadata["printed_page"]   = printed_page if printed_page is not None else -1
        doc.metadata["is_frontmatter"] = is_frontmatter

        bucket = stats.setdefault(source, [0, 0])
        if is_frontmatter:
            bucket[1] += 1
        else:
            bucket[0] += 1

    for name, (content, frontmatter) in stats.items():
        print(f"  [{name}] {content} content pages | {frontmatter} front-matter pages")

    return documents


def split_documents(documents: list) -> list:
    print("Splitting into chunks ...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=150,
        length_function=len,
        add_start_index=True,
    )
    chunks = splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks.")
    return chunks


def create_vector_store(chunks: list, persist_directory: str = DB_PATH):
    print("Initialising embedding model ...")
    embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)

    print(f"Creating ChromaDB at '{persist_directory}' ...")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embedding_model,
        persist_directory=persist_directory,
        collection_metadata={"hnsw:space": "cosine"},
    )
    print("Vector store created and persisted.")
    return vectorstore


def verify_page_mapping(vectorstore):
    """Quick sanity check: show a few sample chunks per source."""
    print("\n-- Verification: printed_page metadata sample ---")
    collection = vectorstore._collection
    results    = collection.get(include=["documents", "metadatas"])

    seen: dict[str, dict[int, str]] = {"hypertension": {}, "diabetes": {}}

    for doc, meta in zip(results["documents"], results["metadatas"]):
        pp  = meta.get("printed_page", -1)
        src = meta.get("source_doc", "unknown")
        if src in seen and pp not in seen[src]:
            seen[src][pp] = doc[:80].replace("\n", " ")

    for src_name, pages in seen.items():
        print(f"\n  [{src_name}] sample pages:")
        sample_pages = sorted([k for k in pages if k != -1])[:5]
        for pp in sample_pages:
            print(f"    printed_page={pp:3d} -> {pages[pp]}")

    print("-" * 60 + "\n")


# ── ENTRY POINT ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if os.path.exists(DB_PATH):
        print(f"Removing old DB at '{DB_PATH}' to re-ingest ...")
        shutil.rmtree(DB_PATH)

    try:
        docs   = load_documents()
        docs   = enrich_metadata(docs)
        chunks = split_documents(docs)
        vs     = create_vector_store(chunks)

        verify_page_mapping(vs)

        # Cross-document test query
        print("Test similarity search: 'blood glucose management'")
        results = vs.similarity_search("blood glucose management", k=4)
        for r in results:
            pp  = r.metadata.get("printed_page", "?")
            src = r.metadata.get("source_doc", "?")
            print(f"  [{src}] printed_page={pp} | {r.page_content[:80].replace(chr(10), ' ')}")

    except Exception as e:
        print(f"\nError: {e}")
        raise