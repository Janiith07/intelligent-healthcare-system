import os
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from groq import Groq

load_dotenv()

DOCS_PATH            = "docs"
DB_PATH              = "db/chroma_db"
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en"
GROQ_API_KEY         = os.getenv("GROQ_API_KEY")

# ── PAGE NUMBER STRATEGY ──────────────────────────────────────────────────────
#
# Two PDFs use DIFFERENT page-numbering layouts:
#
#   Hypertension PDF  →  footer "- X -"   (number at bottom of page)
#   Diabetes PDF      →  header "   X \n" (number at top, isolated line)
#
# During ingestion (test_env.py) each chunk gets:
#   metadata["printed_page"]  — the integer printed on the physical page
#   metadata["is_frontmatter"]— True for cover / TOC pages
#   metadata["source_doc"]    — "hypertension" | "diabetes"
#
# At query time we match against printed_page directly.
# No offset arithmetic. No mismatch.
#
# ── HOW TO REFERENCE PAGES ───────────────────────────────────────────────────
# Tell users to read the page number from the physical document
# (printed at top or bottom of the page), NOT from the PDF viewer's page bar.

client          = Groq(api_key=GROQ_API_KEY)
embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)

# ─────────────────────────────────────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Medical RAG API",
    description="RAG API for Hypertension & Diabetes Clinical Guidelines",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPTS
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are an expert Clinical Protocol Assistant specializing in Hypertension
and Diabetes Management guidelines.
Answer medical queries using ONLY the retrieved context provided below.

REASONING PROTOCOL:
1. Identify which guideline the context comes from (Hypertension or Diabetes).
2. Scan for specific patient factors: age, comorbidities, BP Grade, HbA1c, etc.
3. Apply the appropriate clinical algorithm (A/C/D for hypertension;
   stepped care for diabetes).
4. If the information is missing, state:
   "The provided guideline does not specify this detail."
5. Never provide advice outside the provided text.

OUTPUT STRUCTURE:
- [CLINICAL ANSWER]
- [EVIDENCE SUMMARY]
- [SOURCE]: (e.g., Hypertension Guideline, Page X  /  Diabetes Guideline, Page Y)
"""

SUMMARY_SYSTEM_PROMPT = """
You are an expert medical summarizer for Hypertension and Diabetes guidelines.
Produce clear, structured summaries from the provided guideline content.

RULES:
1. Summarize ONLY what is present in the provided content.
2. Use clear headings and bullet points for readability.
3. Preserve all clinical values (BP thresholds, HbA1c targets, drug doses).
4. Identify which guideline the content is from.
5. End with a one-sentence clinical takeaway.
6. If content is insufficient, state: "Insufficient content found for this
   summary request."

OUTPUT STRUCTURE:
- [SUMMARY TITLE]
- [GUIDELINE SOURCE]
- [KEY POINTS]
- [CLINICAL VALUES & THRESHOLDS]
- [TAKEAWAY]
"""

# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list] = []


class ChatResponse(BaseModel):
    reply: str
    intent: str                    # "qa" | "summary_page" | "summary_topic" | "clarify_scope"
    sources: list[str]             # e.g. ["hypertension:4", "diabetes:12"]
    conversation_history: list
    clarify_pages: list[int] = []  # populated only when intent == "clarify_scope"


class SummaryRequest(BaseModel):
    query: str


class HealthResponse(BaseModel):
    status: str
    message: str

# ─────────────────────────────────────────────────────────────────────────────
# DB INIT
# ─────────────────────────────────────────────────────────────────────────────

vector_db = None


def load_documents():
    if not os.path.exists(DOCS_PATH):
        os.makedirs(DOCS_PATH)
        raise FileNotFoundError(f"Created '{DOCS_PATH}'. Add your PDFs there.")
    loader = DirectoryLoader(path=DOCS_PATH, glob="*.pdf", loader_cls=PyPDFLoader)
    documents = loader.load()
    if not documents:
        raise FileNotFoundError(f"No PDF files found in {DOCS_PATH}.")
    return documents


def split_documents(documents):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=150,
        length_function=len,
        add_start_index=True,
    )
    return splitter.split_documents(documents)


def create_vector_store(chunks):
    return Chroma.from_documents(
        documents=chunks,
        embedding=embedding_model,
        persist_directory=DB_PATH,
        collection_metadata={"hnsw:space": "cosine"},
    )


@app.on_event("startup")
async def startup_event():
    global vector_db
    print("Starting Medical RAG API — loading vector store ...")
    if os.path.exists(DB_PATH):
        vector_db = Chroma(
            persist_directory=DB_PATH,
            embedding_function=embedding_model,
            collection_metadata={"hnsw:space": "cosine"},
        )
        print("Vector store loaded.")
    else:
        print("Building vector store from PDFs ...")
        docs      = load_documents()
        chunks    = split_documents(docs)
        vector_db = create_vector_store(chunks)
        print("Vector store created.")

# ─────────────────────────────────────────────────────────────────────────────
# INTENT DETECTION
# ─────────────────────────────────────────────────────────────────────────────

SUMMARY_KEYWORDS = [
    "summarize", "summarise", "summary", "brief", "overview",
    "outline", "key points", "main points", "explain",
    "what does .* say", "what is in", "tell me about",
]

PAGE_PATTERN = re.compile(
    r"page[s]?\s*(\d+)(?:\s*(?:to|-|and)\s*(\d+))?",
    re.IGNORECASE,
)

# Detect document scope in the query
SOURCE_KEYWORDS = {
    "diabetes":     ["diabetes", "diabetic", "glucose", "insulin", "hba1c", "hyperglycemi"],
    "hypertension": ["hypertension", "hypertensive", "blood pressure", "bp", "antihypertens"],
}


def detect_doc_scope(query: str) -> str | None:
    """Return 'diabetes', 'hypertension', or None (search both)."""
    q = query.lower()
    for source, keywords in SOURCE_KEYWORDS.items():
        if any(kw in q for kw in keywords):
            return source
    return None


def detect_intent(query: str) -> dict:
    query_lower = query.lower()
    page_match  = PAGE_PATTERN.search(query_lower)
    is_summary  = any(kw in query_lower for kw in SUMMARY_KEYWORDS)

    if page_match and is_summary:
        start = int(page_match.group(1))
        end   = int(page_match.group(2)) if page_match.group(2) else start
        return {"type": "summary_page", "pages": list(range(start, end + 1))}

    if is_summary:
        return {"type": "summary_topic", "topic": query}

    return {"type": "qa"}

# ─────────────────────────────────────────────────────────────────────────────
# CORE RETRIEVAL LOGIC
# ─────────────────────────────────────────────────────────────────────────────

def _format_source_label(source_doc: str, printed_page: int) -> str:
    """e.g. 'diabetes:12'  or  'hypertension:4'"""
    return f"{source_doc}:{printed_page}"


def get_chunks_by_page(pages: list[int], scope: str | None = None):
    """
    Retrieve all chunks whose printed_page is in the given list.
    Optional scope ('diabetes' | 'hypertension') narrows results.
    Returns (chunk_texts, source_labels).
    """
    target_set = set(pages)
    collection = vector_db._collection
    results    = collection.get(include=["documents", "metadatas"])

    matched      = []
    source_labels = set()

    for doc, meta in zip(results["documents"], results["metadatas"]):
        pp  = meta.get("printed_page", -1)
        src = meta.get("source_doc", "unknown")

        if pp not in target_set or pp == -1:
            continue
        if scope and src != scope:
            continue

        matched.append(doc)
        source_labels.add(_format_source_label(src, pp))

    return matched, sorted(source_labels)


def get_chunks_by_topic(topic: str, k: int = 10, scope: str | None = None):
    """
    Semantic retrieval. Optional scope filters by source_doc metadata.
    Returns (chunk_texts, source_labels).
    """
    retriever = vector_db.as_retriever(search_kwargs={"k": k * 2 if scope else k})
    docs      = retriever.invoke(topic)

    if scope:
        docs = [d for d in docs if d.metadata.get("source_doc") == scope][:k]

    texts         = [d.page_content for d in docs]
    source_labels = sorted(
        {
            _format_source_label(
                d.metadata.get("source_doc", "unknown"),
                d.metadata.get("printed_page", -1),
            )
            for d in docs
            if d.metadata.get("printed_page", -1) != -1
        }
    )
    return texts, source_labels

# ─────────────────────────────────────────────────────────────────────────────
# LLM CALLS
# ─────────────────────────────────────────────────────────────────────────────

def call_llm_summary(chunks: list[str], title: str) -> str:
    combined = "\n\n---\n\n".join(chunks)
    if not combined.strip():
        return "No content found to summarize."

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user",   "content": f"Summary Title: {title}\n\nContent:\n{combined}"},
        ],
        temperature=0.1,
        max_tokens=1500,
    )
    return response.choices[0].message.content


def call_llm_qa(history: list, user_query: str, context: str) -> str:
    rag_prompt = f"Context from clinical guidelines:\n{context}\n\nUser Question: {user_query}"
    MAX_TURNS  = 8
    trimmed    = history[-(MAX_TURNS * 2):]
    messages   = [{"role": "system", "content": SYSTEM_PROMPT}] + trimmed + \
                 [{"role": "user",   "content": rag_prompt}]
    response   = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.1,
    )
    return response.choices[0].message.content

# ─────────────────────────────────────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", response_model=HealthResponse)
async def root():
    return {"status": "ok", "message": "Medical RAG API (Hypertension + Diabetes) is running."}


@app.get("/health", response_model=HealthResponse)
async def health():
    return {
        "status":  "ok"    if vector_db else "error",
        "message": "Vector store ready." if vector_db else "Vector store not loaded.",
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint.

    Accepts: user message + full conversation history (from frontend).
    Returns: reply, intent, sources (as "source_doc:printed_page"), updated history.

    Source labels in the response look like:
      "diabetes:12"       →  Diabetes Guideline, printed page 12
      "hypertension:4"    →  Hypertension Guideline, printed page 4

    Page numbers refer to the number PRINTED on the physical page
    (top or bottom of the page), NOT the PDF viewer's page counter.
    """
    if not vector_db:
        raise HTTPException(status_code=503, detail="Vector store not ready.")

    query  = request.message.strip()
    intent = detect_intent(query)
    scope  = detect_doc_scope(query)   # narrow to one doc if query is specific

    # ── SUMMARY (page) ───────────────────────────────────────────────────────
    if intent["type"] == "summary_page":
        pages = intent["pages"]

        # ── AMBIGUOUS: no document scope detected → ask the user ────────────
        # e.g. "summarize page 12" with no disease keyword → both PDFs have
        # a page 12 so we must clarify before summarising.
        if scope is None:
            label = f"page {pages[0]}" if len(pages) == 1 else f"pages {pages[0]}–{pages[-1]}"
            return ChatResponse(
                reply=(
                    f"Both guidelines have {label}. "
                    f"Which one would you like me to summarize?"
                ),
                intent="clarify_scope",
                sources=[],
                conversation_history=request.conversation_history,
                clarify_pages=pages,
            )

        # ── SCOPED: summarise the specific document ──────────────────────────
        chunks, source_labels = get_chunks_by_page(pages, scope=scope)

        if not chunks:
            reply = (
                f"No content found for page(s) {pages} in the {scope} guideline. "
                "This may be an image-only page, a front-matter page, or out of range. "
                "Use the number printed on the physical page, not the PDF viewer count."
            )
            source_labels = []
        else:
            label     = f"Page {pages[0]}" if len(pages) == 1 else f"Pages {pages[0]}\u2013{pages[-1]}"
            doc_label = scope.title()
            reply     = call_llm_summary(chunks, f"{doc_label} Guideline {label} Summary")

        return ChatResponse(
            reply=reply,
            intent="summary_page",
            sources=source_labels,
            conversation_history=request.conversation_history,
        )

    # ── SUMMARY (topic) ──────────────────────────────────────────────────────
    elif intent["type"] == "summary_topic":
        chunks, source_labels = get_chunks_by_topic(query, k=10, scope=scope)
        reply = call_llm_summary(chunks, query) if chunks else "No relevant content found."
        return ChatResponse(
            reply=reply,
            intent="summary_topic",
            sources=source_labels,
            conversation_history=request.conversation_history,
        )

    # ── QA ───────────────────────────────────────────────────────────────────
    else:
        retriever = vector_db.as_retriever(search_kwargs={"k": 6})
        docs      = retriever.invoke(query)

        # If query is clearly about one document, filter results
        if scope:
            filtered = [d for d in docs if d.metadata.get("source_doc") == scope]
            if filtered:          # only restrict if we actually get results
                docs = filtered

        context = "\n\n".join(d.page_content for d in docs)
        source_labels = sorted(
            {
                _format_source_label(
                    d.metadata.get("source_doc", "unknown"),
                    d.metadata.get("printed_page", -1),
                )
                for d in docs
                if d.metadata.get("printed_page", -1) != -1
            }
        )

        reply = call_llm_qa(request.conversation_history, query, context)

        updated_history = request.conversation_history + [
            {"role": "user",      "content": query},
            {"role": "assistant", "content": reply},
        ]

        return ChatResponse(
            reply=reply,
            intent="qa",
            sources=source_labels,
            conversation_history=updated_history,
        )


@app.delete("/chat/history")
async def clear_history():
    """Utility: remind frontend to reset its own history state."""
    return {"message": "History is managed on the frontend. Reset your local state."}