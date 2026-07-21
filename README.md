We built a full-stack, AI-powered medical center management system for a real client — Dr. M.T.D. Jayaweera of People's Health Care, Matara. Not a simulated brief — it solved real operational problems for a working medical center. Developed as a Year 2, Semester 2 project for the IT2021 – Artificial Intelligence and Machine Learning module.

We digitized every department on a MERN stack platform:
✅ Appointment Management
✅ Prescription Management 
✅ Laboratory Test Management with pre-condition notifications
✅ Pharmacy Inventory & dispensing queue
✅ Billing & payment processing
✅ Medical Equipment & resource tracking

And layered five AI microservices directly into clinical workflow, each served as an independent Python microservice (Flask or FastAPI)

🩺 Skin Disease Classifier — ResNet-18 built and trained from scratch in PyTorch, classifying 9 skin disease categories with targeted augmentation. Deployed as a doctor-facing DSS.

💊 Vitamin Deficiency Predictor — an ensemble-style pipeline pairing an SVM for disease diagnosis with a multi-output DNN for deficiency prediction, backed by PCA-based dimensionality reduction and feature scaling in preprocessing.

❤️ Heart Disease Risk Predictor — a Random Forest classifier (scikit-learn) returning risk probability plus per-patient feature-importance breakdowns, so doctors see why a patient is flagged, not just the prediction.

📚 Clinical Guidelines RAG Assistant — FastAPI + LangChain, a ChromaDB vector store built from national clinical guideline PDFs, and Llama-3.3-70B (via Groq) for fast, grounded answer generation.

🤖 Navigation Chatbot — Groq/LLaMA-powered assistant helping patients navigate bookings, records and billing conversationally.
