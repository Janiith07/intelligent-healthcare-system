# People's Health Care 🏥 — Intelligent Medical Center Management System

A full-stack medical center management platform built for a real client — Dr. M.T.D. Jayaweera of People's Health Care, Matara — as a Year 2, Semester 2 project for the IT2021 Artificial Intelligence and Machine Learning module at SLIIT.

This isn't a simulated coursework brief. It digitizes the day-to-day operations of a working medical center — appointments, prescriptions, lab tests, pharmacy inventory, billing, and equipment tracking — into one unified system, and layers five AI microservices directly into clinical workflow to support real diagnostic and administrative decisions.

## Core Features

- **Appointment Management** — session-based booking with live availability and queue tracking
- **Prescription Management** — connected across doctor, pharmacy, and lab
- **Laboratory Test Management** — with pre-condition notifications
- **Pharmacy Inventory** — stock and dispensing queue management
- **Billing & Payments** — end-to-end invoicing and payment processing
- **Medical Equipment Tracking** — resource and maintenance management

## AI Tools

Each AI feature runs as its own independent microservice, called by the main platform to assist doctors and patients in real time:

- **🩺 Skin Disease Classifier** — a CNN trained from scratch to classify 9 categories of skin disease from an uploaded image, deployed as a doctor-facing decision support tool. Achieves 92.07% validation accuracy.
- **💊 Vitamin Deficiency Predictor** — a stacking ensemble model that diagnoses likely vitamin-related conditions and predicts multiple deficiencies simultaneously from patient demographic and lifestyle data.
- **❤️ Heart Disease Risk Predictor** — estimates a patient's heart disease risk and explains which factors drove the prediction, so doctors see the reasoning, not just a score.
- **📚 Clinical Guidelines Assistant (RAG)** — a retrieval-augmented chatbot that answers clinical questions grounded in official medical guideline documents, so doctors get sourced, accurate answers instead of generic AI responses.
- **🤖 Navigation Chatbot** — a conversational assistant that helps patients find their way around the platform — bookings, records, and billing — without needing a manual.

Together, these microservices turn the platform from a simple records system into an AI-assisted decision support environment for both doctors and patients.

## How to Run the Project

The system has 6 parts, each running in its own terminal: a database, the backend, the frontend, and 4 AI microservices.

### Prerequisites
- Node.js (v18+)
- MongoDB running locally, or a MongoDB Atlas connection string
- Python 3.11+

### 1. Backend (port 5001)
```bash
cd phc-backend
npm install
```
Create a `.env` file with your Mongo URI, JWT secret, and Groq API key, then start it:
```bash
npm run dev
```

### 2. Heart Disease Predictor (port 5002)
```bash
cd heart-disease-risk-predictor
pip install -r requirements.txt
python app.py
```

### 3. Vitamin Deficiency Predictor (port 5003)
```bash
cd vitamin-deficiency-predictor
pip install -r requirements.txt
python app.py
```

### 4. Skin Disease Classifier (port 5050)
```bash
cd skin-disease-classifier
pip install flask flask-cors torch torchvision pillow numpy
python app.py
```

### 5. Clinical Guidelines RAG Service (port 8000)
```bash
cd medical-guidelines-rag-service
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```
Add your Groq API key to a `.env` file, then run:
```bash
uvicorn rag_api:app --reload --port 8000
```

### 6. Frontend (port 5173)
```bash
cd phc-frontend
npm install
npm run dev
```

### Start order
MongoDB → Backend → the three Flask AI services → the FastAPI RAG service → Frontend last. Once everything is running, open `http://localhost:5173` in your browser.
