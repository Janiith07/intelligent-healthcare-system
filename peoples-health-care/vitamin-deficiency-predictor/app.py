from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf

app = Flask(__name__)
CORS(app)

# ── Load preprocessors ────────────────────────────────────────────
print("Loading preprocessors...")
scaler = joblib.load('models/scaler.pkl')
pca    = joblib.load('models/pca.pkl')
le     = joblib.load('models/label_encoder.pkl')

# ── Load best models only ─────────────────────────────────────────
# Y1: SVM — Disease Diagnosis (best F1 on test)
print("Loading SVM — Disease Diagnosis...")
svm_disease = joblib.load('models/svm_disease.pkl')

# Y2: DNN — Multiple Deficiencies (best F1 on test)
print("Loading DNN — Multiple Deficiencies...")
dnn_model = tf.keras.models.load_model('models/best_dnn_multioutput.keras')

print("All models loaded successfully!")

# ── Feature column definitions ────────────────────────────────────
SCALE_COLS = [
    "age", "bmi",
    "vitamin_a_percent_rda", "vitamin_c_percent_rda", "vitamin_d_percent_rda",
    "vitamin_e_percent_rda", "vitamin_b12_percent_rda", "folate_percent_rda",
    "calcium_percent_rda", "iron_percent_rda",
    "hemoglobin_g_dl", "serum_vitamin_d_ng_ml", "serum_vitamin_b12_pg_ml",
    "serum_folate_ng_ml", "symptoms_count",
    "vit_d_absorption_ratio", "vit_b12_absorption_ratio", "folate_absorption_ratio",
    "num_vitamins_deficient", "num_vitamins_severely_deficient",
    "total_rda_score", "symptom_burden",
]

ALL_COLUMNS = [
    "age", "bmi",
    "vitamin_a_percent_rda", "vitamin_c_percent_rda", "vitamin_d_percent_rda",
    "vitamin_e_percent_rda", "vitamin_b12_percent_rda", "folate_percent_rda",
    "calcium_percent_rda", "iron_percent_rda",
    "hemoglobin_g_dl", "serum_vitamin_d_ng_ml", "serum_vitamin_b12_pg_ml",
    "serum_folate_ng_ml", "symptoms_count",
    "has_night_blindness", "has_fatigue", "has_bleeding_gums", "has_bone_pain",
    "has_muscle_weakness", "has_numbness_tingling", "has_memory_problems", "has_pale_skin",
    "vit_d_absorption_ratio", "vit_b12_absorption_ratio", "folate_absorption_ratio",
    "num_vitamins_deficient", "num_vitamins_severely_deficient",
    "total_rda_score", "symptom_burden",
    "sun_x_vitD", "veg_x_b12_low",
    "gender_Female", "gender_Male",
    "smoking_status_Current", "smoking_status_Former", "smoking_status_Never",
    "alcohol_consumption_Heavy", "alcohol_consumption_Moderate",
    "exercise_level_Active", "exercise_level_Light",
    "exercise_level_Moderate", "exercise_level_Sedentary",
    "diet_type_Omnivore", "diet_type_Pescatarian",
    "diet_type_Vegan", "diet_type_Vegetarian",
    "sun_exposure_High", "sun_exposure_Low", "sun_exposure_Moderate",
    "income_level_High", "income_level_Low", "income_level_Middle",
    "latitude_region_High", "latitude_region_Low", "latitude_region_Mid",
    "bmi_category_Normal", "bmi_category_Obese",
    "bmi_category_Overweight", "bmi_category_Underweight",
    "age_group_MiddleAge", "age_group_Senior",
    "age_group_YoungAdult", "age_group_Youth",
]

SEL_FEATS = [
    "calcium_percent_rda",
    "diet_type_Vegan",
    "folate_percent_rda",
    "has_bone_pain",
    "has_fatigue",
    "has_memory_problems",
    "has_numbness_tingling",
    "iron_percent_rda",
    "num_vitamins_deficient",
    "num_vitamins_severely_deficient",
    "serum_folate_ng_ml",
    "serum_vitamin_b12_pg_ml",
    "serum_vitamin_d_ng_ml",
    "sun_exposure_Low",
    "sun_x_vitD",
    "symptom_burden",
    "symptoms_count",
    "total_rda_score",
    "vitamin_a_percent_rda",
    "vitamin_b12_percent_rda",
    "vitamin_c_percent_rda",
    "vitamin_d_percent_rda",
]


# ── Feature engineering ───────────────────────────────────────────
def engineer_features(df):
    vit_rda = [
        'vitamin_a_percent_rda', 'vitamin_c_percent_rda', 'vitamin_d_percent_rda',
        'vitamin_e_percent_rda', 'vitamin_b12_percent_rda', 'folate_percent_rda',
        'calcium_percent_rda', 'iron_percent_rda'
    ]
    symptom_cols = [
        'has_night_blindness', 'has_fatigue', 'has_bleeding_gums', 'has_bone_pain',
        'has_muscle_weakness', 'has_numbness_tingling', 'has_memory_problems', 'has_pale_skin'
    ]

    # Absorption ratios
    df['vit_d_absorption_ratio']   = df['serum_vitamin_d_ng_ml']   / (df['vitamin_d_percent_rda']   + 1)
    df['vit_b12_absorption_ratio'] = df['serum_vitamin_b12_pg_ml'] / (df['vitamin_b12_percent_rda'] + 1)
    df['folate_absorption_ratio']  = df['serum_folate_ng_ml']      / (df['folate_percent_rda']      + 1)

    # Deficiency counts
    df['num_vitamins_deficient']          = (df[vit_rda] < 50).sum(axis=1)
    df['num_vitamins_severely_deficient'] = (df[vit_rda] < 30).sum(axis=1)
    df['total_rda_score']                 = df[vit_rda].mean(axis=1)

    # BMI category
    df['bmi_category'] = pd.cut(
        df['bmi'],
        bins=[0, 18.5, 25, 30, 100],
        labels=['Underweight', 'Normal', 'Overweight', 'Obese']
    ).astype(str)

    # Age group
    df['age_group'] = pd.cut(
        df['age'],
        bins=[0, 18, 35, 55, 120],
        labels=['Youth', 'YoungAdult', 'MiddleAge', 'Senior']
    ).astype(str)

    # Symptom scores
    df['symptom_burden'] = df[symptom_cols].sum(axis=1)
    df['symptoms_count'] = df[symptom_cols].sum(axis=1)

    # Interaction features
    df['sun_x_vitD']    = (df['sun_exposure'] == 'Low').astype(int) * \
                          (df['vitamin_d_percent_rda'] < 50).astype(int)
    df['veg_x_b12_low'] = (df['diet_type'].isin(['Vegetarian', 'Pescatarian'])).astype(int) * \
                          (df['vitamin_b12_percent_rda'] < 50).astype(int)

    return df


def encode_categoricals(df):
    cat_cols = [
        'gender', 'smoking_status', 'alcohol_consumption', 'exercise_level',
        'diet_type', 'sun_exposure', 'income_level', 'latitude_region',
        'bmi_category', 'age_group'
    ]
    df = pd.get_dummies(df, columns=cat_cols, drop_first=False, dtype=int)
    return df


def preprocess(raw_data):
    df = pd.DataFrame([raw_data])

    # Step 1: Engineer features
    df = engineer_features(df)

    # Step 2: One-hot encode categoricals
    df = encode_categoricals(df)

    # Step 3: Drop target columns if accidentally included
    df.drop(
        columns=['disease_diagnosis', 'has_multiple_deficiencies', 'disease_label'],
        errors='ignore', inplace=True
    )

    # Step 4: Align to expected columns (fill missing with 0)
    for col in ALL_COLUMNS:
        if col not in df.columns:
            df[col] = 0
    df = df[ALL_COLUMNS]

    # Step 5: Scale numeric columns
    df[SCALE_COLS] = scaler.transform(df[SCALE_COLS])

    # Step 6: Select important features
    X_sel = df[SEL_FEATS]

    # Step 7: Apply PCA
    X_pca = pca.transform(X_sel)

    return X_pca


# ── Prediction: Y1 — SVM Disease Diagnosis ───────────────────────
def predict_disease(X_pca):
    """
    Uses SVM with probability calibration.
    SVM was the best single model for Disease Diagnosis.
    """
    pred  = svm_disease.predict(X_pca)[0]
    proba = svm_disease.predict_proba(X_pca)[0]
    name  = le.inverse_transform([pred])[0]
    confidence = {cls: round(float(p), 4) for cls, p in zip(le.classes_, proba)}
    return name, confidence


# ── Prediction: Y2 — DNN Multiple Deficiencies ───────────────────
def predict_deficiency(X_pca):
    """
    Uses the DNN multi-output model's second output head (Y2).
    DNN was the best single model for Multiple Deficiencies.
    """
    _, dnn_raw = dnn_model.predict(X_pca, verbose=0)
    prob_yes   = float(dnn_raw.flatten()[0])
    pred_label = 'Yes' if prob_yes >= 0.5 else 'No'
    return pred_label, round(prob_yes, 4)


# ── Routes ────────────────────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    try:
        raw_data = request.get_json()
        if not raw_data:
            return jsonify({'error': 'No JSON body received', 'status': 'error'}), 400

        X_pca = preprocess(raw_data)

        disease_name, disease_conf = predict_disease(X_pca)
        defic_result, defic_prob   = predict_deficiency(X_pca)

        return jsonify({
            'disease_diagnosis': {
                'prediction': disease_name,
                'confidence': disease_conf,
                'model':      'SVM (95% Test F1)'
            },
            'multiple_deficiencies': {
                'prediction':  defic_result,
                'probability': defic_prob,
                'model':       'DNN (best Test F1)'
            },
            'status': 'success'
        })

    except Exception as e:
        import traceback
        return jsonify({
            'error':     str(e),
            'traceback': traceback.format_exc(),
            'status':    'error'
        }), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':        'ok',
        'models_loaded': {
            'disease_diagnosis':     'SVM',
            'multiple_deficiencies': 'DNN'
        },
        'classes':    list(le.classes_),
        'n_features': len(SEL_FEATS),
        'scale_cols': len(SCALE_COLS),
        'all_cols':   len(ALL_COLUMNS),
    })


if __name__ == '__main__':
    app.run(port=5002, debug=True)