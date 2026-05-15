# 🏥 Medical RAG API — Mac Setup Guide

> Works on both **Apple Silicon (M1/M2/M3)** and **Intel Macs**

---

## 🧠 What is a Virtual Environment? (For Beginners)

Think of your Mac like a big kitchen. All your Python projects share the same kitchen —
same knives, same pots. The problem? Project A needs an old knife (version 1.0),
Project B needs a new knife (version 3.0). They **fight** and break each other.

A **virtual environment** is like giving each project its **own private mini-kitchen** 🍳  
Everything is isolated. Nothing clashes. When you're done, you just "leave" that kitchen.

```
Your Mac
├── 🏠 Global Python  (don't touch this for projects)
├── 🍳 venv: medical-rag   ← we create this today
│   ├── fastapi 0.136
│   ├── chromadb 1.5.8
│   └── ... all RAG packages
└── 🍳 venv: other-project  ← completely separate
```

---

## ✅ Prerequisites — Do These First

### 1. Check if Python is installed

Open **Terminal** (press `Cmd + Space`, type "Terminal", press Enter) and run:

```bash
python3 --version
```

You need **Python 3.11 or higher**. If you see `3.11.x` or `3.12.x` — you're good ✅

If Python is missing or too old, install it from:  
👉 https://www.python.org/downloads/  
Download the latest **3.12.x** version, run the `.pkg` installer.

### 2. Check if pip is installed

```bash
pip3 --version
```

This should show something like `pip 24.x ...` — if it does, you're good ✅

---

## 📁 Step 1 — Organise Your Project Files

Create a folder for the project and put all your files inside it:

```
medical-rag/
├── rag_api.py          ← your main API
├── test_env.py         ← ingestion script
├── requirements.txt    ← all dependencies (this file)
├── .env                ← your secret API key (create this below)
└── docs/
    ├── Hypertenstion.pdf
    └── Diabetes.pdf
```

To create this structure in Terminal:

```bash
# Go to your Desktop (or wherever you want the project)
cd ~/Desktop

# Create the project folder
mkdir medical-rag
cd medical-rag

# Create the docs folder
mkdir docs
```

Then copy your PDF files into `medical-rag/docs/`.

---

## 🐍 Step 2 — Create the Virtual Environment

Still inside your `medical-rag` folder:

```bash
# This creates a hidden folder called "venv" inside your project
python3 -m venv venv
```

You'll see a new `venv/` folder appear. That's your private kitchen 🍳

**What just happened?**

- Python created a clean, isolated copy of itself inside `venv/`
- No packages are installed yet — it's a fresh kitchen with empty shelves

---

## ⚡ Step 3 — Activate the Virtual Environment

```bash
source venv/bin/activate
```

Your Terminal prompt will change to show `(venv)` at the start — like this:

```
(venv) Theekshana@MacBook medical-rag %
```

That `(venv)` prefix means you are **inside** the virtual environment.  
Any package you install now goes into this project only, not your global Mac Python.

> 💡 **Every time you open a new Terminal window**, you must run this activate command again.  
> The virtual environment does not auto-activate.

To **deactivate** (leave the kitchen) when you're done working:

```bash
deactivate
```

---

## 📦 Step 4 — Install All Dependencies

Make sure you see `(venv)` in your prompt, then run:

```bash
pip install -r requirements.txt
```

This will download and install all packages. It takes **5–15 minutes** the first time  
because `torch` (the AI engine) and `chromadb` are large downloads (~1 GB total).

You'll see a lot of text scrolling by — that's normal. Wait for it to finish.

**Verify the install worked:**

```bash
pip list | grep -E "fastapi|chromadb|groq|langchain"
```

You should see something like:

```
fastapi                   0.136.0
groq                      1.2.0
langchain-chroma          1.1.0
langchain-community       0.4.1
langchain-huggingface     1.2.2
chromadb                  1.5.8
```

---

## 🔑 Step 5 — Create Your .env File

The API key must never be hardcoded in Python files. We store it in a `.env` file.

```bash
# Create the .env file
touch .env
open -e .env
```

TextEdit will open. Type exactly this (replace the value with your real key):

```
GROQ_API_KEY=gsk_your_actual_key_here
```

Save and close TextEdit.

> 💡 **Where to get a Groq API key?**  
> Go to https://console.groq.com → Sign up (free) → API Keys → Create key

**Verify it works:**

```bash
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print('Key loaded:', bool(os.getenv('GROQ_API_KEY')))"
```

Should print: `Key loaded: True`

---

## 📚 Step 6 — Run the Ingestion Script (Build the Database)

This reads your PDFs, extracts the text, and builds the ChromaDB vector database.  
**You only need to do this ONCE** (or whenever you add new PDFs).

```bash
python3 test_env.py
```

Expected output:

```
Loading documents from 'docs' ...
Loaded 207 raw pages from PyPDF.
Enriching metadata with printed page numbers ...
  [hypertension]  93 content pages |  6 front-matter pages
  [diabetes]     181 content pages | 13 front-matter pages
Splitting into chunks ...
Created 1842 chunks.
Initialising embedding model ...
Creating ChromaDB at 'db/chroma_db' ...
✅ Vector store created and persisted.
```

A new `db/` folder will appear in your project — that's the vector database.

> ⚠️ If you see an error like `No module named 'langchain_community'`,  
> it means you forgot to activate the venv. Run `source venv/bin/activate` first.

---

## 🚀 Step 7 — Start the API Server

```bash
uvicorn rag_api:app --reload --port 8000
```

You should see:

```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
Starting Medical RAG API — loading vector store ...
Vector store loaded.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Open your browser and go to:  
👉 **http://localhost:8000** — should show `{"status":"ok",...}`  
👉 **http://localhost:8000/docs** — interactive Swagger UI to test the API

Press `Ctrl + C` in Terminal to stop the server.

---

## 🗂️ Final Project Structure

After completing all steps, your folder should look like this:

```
medical-rag/
├── venv/                   ← virtual environment (don't touch)
├── db/
│   └── chroma_db/          ← vector database (auto-created by test_env.py)
├── docs/
│   ├── Hypertenstion.pdf
│   └── Diabetes.pdf
├── rag_api.py
├── test_env.py
├── requirements.txt
└── .env                    ← your API key (never commit this to Git!)
```

---

## 🔁 Daily Workflow (After First Setup)

Every time you want to work on the project:

```bash
# 1. Go to your project folder
cd ~/Desktop/medical-rag

# 2. Activate the virtual environment
source venv/bin/activate

# 3. Start the API
uvicorn rag_api:app --reload --port 8000
```

That's it — 3 commands every time.

---

## 🐛 Common Errors & Fixes

| Error                                      | Cause                                 | Fix                                          |
| ------------------------------------------ | ------------------------------------- | -------------------------------------------- |
| `command not found: uvicorn`               | venv not activated                    | Run `source venv/bin/activate`               |
| `ModuleNotFoundError: langchain_community` | venv not activated                    | Run `source venv/bin/activate`               |
| `No PDF files found in docs`               | PDFs not in `docs/` folder            | Copy PDFs into `medical-rag/docs/`           |
| `Key loaded: False`                        | `.env` file missing or wrong key name | Check `.env` has `GROQ_API_KEY=...`          |
| `OSError: [Errno 48] Address in use`       | Port 8000 already running             | Run `lsof -ti:8000 \| xargs kill` then retry |
| Slow first run                             | `torch` downloading model weights     | Normal — only happens once, cached after     |

---

## 📌 Quick Reference Card

```bash
# Activate venv
source venv/bin/activate

# Install packages
pip install -r requirements.txt

# Build database (run once)
python3 test_env.py

# Start API
uvicorn rag_api:app --reload --port 8000

# Deactivate venv
deactivate

# Check what's installed
pip list

# Rebuild database from scratch
rm -rf db/ && python3 test_env.py
```

---

## 🎯 Fun Facts

- 🧠 The embedding model (`BAAI/bge-small-en`) turns each sentence into a list of 384 numbers. Similar sentences get similar numbers — that's how "search" works!
- 💾 ChromaDB stores those numbers locally on your Mac in the `db/` folder. No internet needed after setup.
- 🔑 Groq is free to use (up to rate limits) and runs `llama-3.3-70b` — one of the most powerful open models — in milliseconds.
- 🍎 On Apple Silicon (M1/M2/M3), PyTorch uses the **MPS backend** automatically — your Mac's neural engine accelerates the embeddings.
