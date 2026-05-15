from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd

app = Flask(__name__)
CORS(app)

# ── Load model and scaler ─────────────────────────────────────
print("Loading heart disease model...")
model  = joblib.load('models/heart_disease_rf_model.pkl')
scaler = joblib.load('models/scaler.pkl')
print("Heart disease model loaded successfully!")

# ── Feature order (must match training) ──────────────────────
FEATURES = [
    'male', 'age', 'currentSmoker', 'cigsPerDay', 'BPMeds',
    'prevalentStroke', 'prevalentHyp', 'diabetes', 'totChol',
    'sysBP', 'diaBP', 'BMI', 'heartRate', 'glucose',
    'edu_1.0', 'edu_2.0', 'edu_3.0', 'edu_4.0',
    'PulsePressure', 'CholAgeRatio'
]

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'HeartDiseaseRF'})

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        # ── Pull raw inputs ───────────────────────────────────
        age           = float(data['age'])
        male          = int(data['male'])           # 1=Male, 0=Female
        education     = int(data.get('education', 2))  # 1-4
        currentSmoker = int(data['currentSmoker'])  # 0/1
        cigsPerDay    = float(data.get('cigsPerDay', 0))
        BPMeds        = int(data.get('BPMeds', 0))
        prevalentStroke = int(data.get('prevalentStroke', 0))
        prevalentHyp  = int(data.get('prevalentHyp', 0))
        diabetes      = int(data.get('diabetes', 0))
        totChol       = float(data['totChol'])
        sysBP         = float(data['sysBP'])
        diaBP         = float(data['diaBP'])
        BMI           = float(data['BMI'])
        heartRate     = float(data['heartRate'])
        glucose       = float(data['glucose'])

        # ── Derived features ─────────────────────────────────
        PulsePressure = sysBP - diaBP
        CholAgeRatio  = totChol / age if age > 0 else 0

        # ── Education one-hot ─────────────────────────────────
        edu_1 = 1 if education == 1 else 0
        edu_2 = 1 if education == 2 else 0
        edu_3 = 1 if education == 3 else 0
        edu_4 = 1 if education == 4 else 0

        # ── Build feature row ─────────────────────────────────
        row = pd.DataFrame([[
            male, age, currentSmoker, cigsPerDay, BPMeds,
            prevalentStroke, prevalentHyp, diabetes, totChol,
            sysBP, diaBP, BMI, heartRate, glucose,
            edu_1, edu_2, edu_3, edu_4,
            PulsePressure, CholAgeRatio
        ]], columns=FEATURES)

        scaled = scaler.transform(row)
        prediction = int(model.predict(scaled)[0])
        proba      = model.predict_proba(scaled)[0]

        # ── Risk level label ──────────────────────────────────
        risk_pct = round(float(proba[1]) * 100, 1)
        if risk_pct >= 60:
            risk_level = 'High'
        elif risk_pct >= 30:
            risk_level = 'Moderate'
        else:
            risk_level = 'Low'

        # ── Top contributing risk factors ────────────────────
        importances = model.feature_importances_
        feat_vals   = list(zip(FEATURES, scaled[0], importances))
        top_factors = sorted(feat_vals, key=lambda x: abs(x[2]), reverse=True)[:5]

        return jsonify({
            'success':     True,
            'prediction':  prediction,
            'riskPercent': risk_pct,
            'riskLevel':   risk_level,
            'probLow':     round(float(proba[0]), 4),
            'probHigh':    round(float(proba[1]), 4),
            'topFactors':  [{'feature': f, 'importance': round(float(imp), 4)}
                            for f, _, imp in top_factors],
        })

    except KeyError as e:
        return jsonify({'success': False, 'message': f'Missing field: {e}'}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=False)
