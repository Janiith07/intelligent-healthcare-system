import os
import re
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from groq import Groq

load_dotenv()
DOCS_PATH = "docs"
DB_PATH = "db/chroma_db"
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

client = Groq(api_key=GROQ_API_KEY)
embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)

SYSTEM_PROMPT = """
You are an expert Clinical Protocol Assistant specializing in Hypertension Management.
Your task is to answer medical queries using ONLY the retrieved context below.

REASONING PROTOCOL:
1. Scan for specific patient age, comorbidities (Diabetes, CKD), and BP Grade.
2. If the user asks for "Step 1" or "First-line," look for the 'A/C/D' algorithm logic.
3. If the information is missing, clearly state: "The provided guideline does not specify this detail."
4. Do not provide medical advice outside of the provided text.

OUTPUT STRUCTURE:
- [CLINICAL ANSWER]
- [EVIDENCE SUMMARY]
- [SOURCE]: (e.g., Hypertension Guideline, Page X)
"""

SUMMARY_SYSTEM_PROMPT = """
You are an expert medical summarizer specializing in Hypertension Guidelines.
Your task is to produce clear, structured summaries from the provided guideline content.

RULES:
1. Summarize ONLY what is present in the provided content — do not add outside knowledge.
2. Use clear headings and bullet points for readability.
3. Preserve all clinical values (BP thresholds, drug doses, percentages).
4. End with a one-sentence clinical takeaway.
5. If the content is insufficient, state: "Insufficient content found for this summary request."

OUTPUT STRUCTURE:
- [SUMMARY TITLE]
- [KEY POINTS]  (bullet points)
- [CLINICAL VALUES & THRESHOLDS]  (if any)
- [TAKEAWAY]
"""

def load_documents(docs_path=DOCS_PATH):
    if not os.path.exists(docs_path):
        os.makedirs(docs_path)
        raise FileNotFoundError(
            f"Created '{docs_path}' folder. Please drop your Hypertension PDF there."
        )
    loader = DirectoryLoader(path=docs_path, glob="*.pdf", loader_cls=PyPDFLoader)
    documents = loader.load()
    if not documents:
        raise FileNotFoundError(f"No .pdf files found in {docs_path}.")
    print(f"Successfully loaded {len(documents)} pages.")
    return documents


def split_documents(documents):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,      # increased from 800 — avoids splitting clinical tables
        chunk_overlap=150,
        length_function=len,
        add_start_index=True,
    )
    chunks = splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks.")
    return chunks


def create_vector_store(chunks):
    print("Creating ChromaDB vector store …")
    vs = Chroma.from_documents(
        documents=chunks,
        embedding=embedding_model,
        persist_directory=DB_PATH,
        collection_metadata={"hnsw:space": "cosine"},
    )
    print("✅ Vector Store created and persisted.")
    return vs


def initialize_system():
    """Load existing DB or build one from the docs folder."""
    if os.path.exists(DB_PATH):
        print("--- Loading existing Vector Store ---")
        return Chroma(
            persist_directory=DB_PATH,
            embedding_function=embedding_model,
            collection_metadata={"hnsw:space": "cosine"},
        )
    print("--- No existing DB found — building now ---")
    docs   = load_documents()
    chunks = split_documents(docs)
    return create_vector_store(chunks)


# Keywords that signal a summarization request
SUMMARY_KEYWORDS = [
    "summarize", "summarise", "summary", "summarization",
    "give me a summary", "brief", "overview", "outline",
    "key points", "main points", "explain", "what does .* say",
    "what is in", "tell me about",
]

PAGE_PATTERN = re.compile(
    r"page[s]?\s*(\d+)(?:\s*(?:to|-|and)\s*(\d+))?",
    re.IGNORECASE,
)


def detect_intent(user_query: str):
    """
    Returns a dict:
      { "type": "summary_page",  "pages": [4] }
      { "type": "summary_topic", "topic": "hypertension medication" }
      { "type": "qa" }
    """
    query_lower = user_query.lower()

    # Check for page reference first
    page_match = PAGE_PATTERN.search(query_lower)
    is_summary_request = any(kw in query_lower for kw in SUMMARY_KEYWORDS)

    if page_match and is_summary_request:
        start = int(page_match.group(1))
        end   = int(page_match.group(2)) if page_match.group(2) else start
        pages = list(range(start, end + 1))
        return {"type": "summary_page", "pages": pages}

    if is_summary_request:
        return {"type": "summary_topic", "topic": user_query}

    return {"type": "qa"}



def get_chunks_by_page(vector_db, pages: list[int]):
    """
    Directly fetch all stored chunks whose metadata page number matches.
    ChromaDB page metadata is 0-indexed, so we subtract 1.
    """
    collection = vector_db._collection
    results    = collection.get(include=["documents", "metadatas"])

    matched_docs  = []
    matched_pages = set()

    for doc, meta in zip(results["documents"], results["metadatas"]):
        # langchain stores page as 0-based int
        stored_page = meta.get("page", -1) + 1   # convert to 1-based
        if stored_page in pages:
            matched_docs.append(doc)
            matched_pages.add(stored_page)

    return matched_docs, sorted(matched_pages)


def get_chunks_by_topic(vector_db, topic: str, k: int = 10):
    """Similarity search for topic-based summaries (wider net than QA)."""
    retriever = vector_db.as_retriever(search_kwargs={"k": k})
    docs      = retriever.invoke(topic)
    texts     = [d.page_content for d in docs]
    pages     = sorted({str(d.metadata.get("page", 0) + 1) for d in docs}, key=int)
    return texts, pages


def call_llm_for_summary(content_chunks: list[str], summary_title: str):
    """Send content to LLM with the summarization system prompt."""
    combined_content = "\n\n---\n\n".join(content_chunks)

    if not combined_content.strip():
        return "⚠️ No content found to summarize for this request."

    user_message = (
        f"Please summarize the following guideline content.\n"
        f"Summary Title: {summary_title}\n\n"
        f"Content:\n{combined_content}"
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        temperature=0.1,
        max_tokens=1500,
    )
    return response.choices[0].message.content



def handle_summarization(vector_db, intent: dict, user_query: str):
    """
    Routes to page-based or topic-based summarization and prints the result.
    """
    if intent["type"] == "summary_page":
        pages = intent["pages"]
        page_label = (
            f"Page {pages[0]}" if len(pages) == 1
            else f"Pages {pages[0]}–{pages[-1]}"
        )
        print(f"\n📄 Generating summary for {page_label} …")

        chunks, found_pages = get_chunks_by_page(vector_db, pages)

        if not chunks:
            print(
                f"\n⚠️  No content found for {page_label}. "
                "This may be an image-only page or the page number is out of range."
            )
            return

        summary = call_llm_for_summary(chunks, f"Guideline {page_label} Summary")
        print(f"\n📋 Summary — {page_label}:\n")
        print(summary)
        print(f"\n[Source: Hypertension Guideline, {page_label}]")

    elif intent["type"] == "summary_topic":
        topic = intent["topic"]
        print(f"\n🔍 Generating topic summary for: '{topic}' …")

        chunks, pages = get_chunks_by_topic(vector_db, topic, k=10)

        if not chunks:
            print("\n⚠️  No relevant content found for this topic.")
            return

        summary = call_llm_for_summary(chunks, topic)
        print(f"\n📋 Topic Summary — {topic}:\n")
        print(summary)
        print(f"\n[Source: Hypertension Guideline, Page(s): {', '.join(pages)}]")



def handle_qa(vector_db, conversation_history: list, user_query: str):
    retriever = vector_db.as_retriever(search_kwargs={"k": 6})
    docs      = retriever.invoke(user_query)

    context_parts = []
    source_pages  = set()
    for doc in docs:
        context_parts.append(doc.page_content)
        source_pages.add(str(doc.metadata.get("page", 0) + 1))

    context_text  = "\n\n".join(context_parts)
    pages_string  = ", ".join(sorted(source_pages, key=int))
    rag_prompt    = f"Context from clinical guidelines:\n{context_text}\n\nUser Question: {user_query}"

    # Cap history to last 8 turns to avoid context overflow
    MAX_TURNS = 8
    trimmed_history = conversation_history[-(MAX_TURNS * 2):]

    messages = trimmed_history + [{"role": "user", "content": rag_prompt}]
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.1,
    )
    reply = response.choices[0].message.content

    print(f"\nAssistant: {reply}")
    print(f"\n[Source: Hypertension Guideline, Page(s): {pages_string}]")

    # Store clean query (not context-stuffed) in history
    conversation_history.append({"role": "user",      "content": user_query})
    conversation_history.append({"role": "assistant", "content": reply})



def start_chat(vector_db):
    conversation_history = [{"role": "system", "content": SYSTEM_PROMPT}]

    print("\n🩺 Medical RAG Assistant Ready.")
    print("   • Ask clinical questions  →  RAG answer")
    print("   • 'summarize page 4'      →  Page summary")
    print("   • 'summary of lifestyle'  →  Topic summary")
    print("   • Type 'quit' to exit\n")

    while True:
        user_query = input("You: ").strip()
        if not user_query:
            continue
        if user_query.lower() in ("quit", "exit"):
            print("Goodbye! 👋")
            break

        intent = detect_intent(user_query)

        if intent["type"] in ("summary_page", "summary_topic"):
            handle_summarization(vector_db, intent, user_query)
        else:
            handle_qa(vector_db, conversation_history, user_query)

if __name__ == "__main__":
    db = initialize_system()
    start_chat(db)