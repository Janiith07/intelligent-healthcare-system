"""
Flask AI Microservice — Skin Disease Classification
Run this separately from the Express backend.
Port: 5050

Setup:
    pip install flask flask-cors torch torchvision pillow numpy
    python app.py

The model file (skin_seresnet_full.pth) must be in the same folder as this file.
"""

import os
import json
import numpy as np
from PIL import Image
import io

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow requests from React frontend

# ─────────────────────────────────────────────────────────────────
# MODEL ARCHITECTURE — must match exactly what was trained
# ─────────────────────────────────────────────────────────────────

class SEBlock(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__()
        self.squeeze    = nn.AdaptiveAvgPool2d(1)
        self.excitation = nn.Sequential(
            nn.Flatten(),
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
            nn.Sigmoid()
        )

    def forward(self, x):
        B, C, H, W = x.shape
        s = self.squeeze(x)
        e = self.excitation(s).view(B, C, 1, 1)
        return x * e


class SEResidualBlock(nn.Module):
    def __init__(self, in_ch, out_ch, stride=1):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3, stride=stride, padding=1, bias=False)
        self.bn1   = nn.BatchNorm2d(out_ch)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3, stride=1, padding=1, bias=False)
        self.bn2   = nn.BatchNorm2d(out_ch)
        self.se    = SEBlock(out_ch, reduction=16)
        self.skip  = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 1, stride=stride, bias=False),
            nn.BatchNorm2d(out_ch)
        ) if (stride != 1 or in_ch != out_ch) else nn.Identity()

    def forward(self, x):
        residual = self.skip(x)
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.se(out)
        return F.relu(out + residual)


class SkinSEResNet(nn.Module):
    def __init__(self, num_classes=9):
        super().__init__()
        self.init_layer = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64), nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        )
        self.layer1 = nn.Sequential(SEResidualBlock(64,  64,  1), SEResidualBlock(64,  64,  1))
        self.layer2 = nn.Sequential(SEResidualBlock(64,  128, 2), SEResidualBlock(128, 128, 1))
        self.layer3 = nn.Sequential(SEResidualBlock(128, 256, 2), SEResidualBlock(256, 256, 1))
        self.layer4 = nn.Sequential(SEResidualBlock(256, 512, 2), SEResidualBlock(512, 512, 1))
        self.gap    = nn.AdaptiveAvgPool2d((1, 1))
        self.classifier = nn.Sequential(
            nn.Flatten(), nn.Linear(512, 256),
            nn.BatchNorm1d(256), nn.ReLU(inplace=True),
            nn.Dropout(0.4), nn.Linear(256, num_classes)
        )

    def forward(self, x):
        x = self.init_layer(x)
        x = self.layer1(x); x = self.layer2(x)
        x = self.layer3(x); x = self.layer4(x)
        x = self.gap(x);    x = self.classifier(x)
        return x


# ─────────────────────────────────────────────────────────────────
# LOAD MODEL ON STARTUP
# ─────────────────────────────────────────────────────────────────

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'skin_seresnet_full.pth')

device = torch.device('cpu')  # CPU is fine for inference
model  = None
class_names = []
IMG_SIZE    = 224
MEAN        = [0.485, 0.456, 0.406]
STD         = [0.229, 0.224, 0.225]

def load_model():
    global model, class_names, IMG_SIZE, MEAN, STD
    print(f'Loading model from {MODEL_PATH}...')
    checkpoint  = torch.load(MODEL_PATH, map_location=device)
    class_names = checkpoint['classes']
    num_classes = checkpoint['num_classes']
    IMG_SIZE    = checkpoint.get('img_size', 224)
    MEAN        = checkpoint.get('mean', [0.485, 0.456, 0.406])
    STD         = checkpoint.get('std',  [0.229, 0.224, 0.225])
    model = SkinSEResNet(num_classes=num_classes)
    model.load_state_dict(checkpoint['model_state'])
    model.eval()
    print(f'Model loaded! Classes: {class_names}')
    print(f'Val accuracy from training: {checkpoint.get("val_accuracy", "N/A")}')


# ─────────────────────────────────────────────────────────────────
# PREPROCESSING
# ─────────────────────────────────────────────────────────────────

def preprocess_image(image_bytes):
    """Convert uploaded image bytes to model-ready tensor."""
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    return transform(img).unsqueeze(0)  # (1, 3, H, W)


# ─────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    """Health check — call this from frontend to verify service is up."""
    return jsonify({
        'status' : 'ok',
        'model'  : 'loaded' if model is not None else 'not loaded',
        'classes': class_names
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    POST /predict
    Body: multipart/form-data with field 'image' containing the skin image file
    Returns: JSON with prediction, confidence scores per class
    """
    if model is None:
        return jsonify({'success': False, 'error': 'Model not loaded'}), 500

    if 'image' not in request.files:
        return jsonify({'success': False, 'error': 'No image uploaded'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    # Check file type
    allowed = {'jpg', 'jpeg', 'png', 'bmp', 'webp'}
    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in allowed:
        return jsonify({'success': False, 'error': f'File type .{ext} not supported'}), 400

    try:
        image_bytes = file.read()
        tensor      = preprocess_image(image_bytes).to(device)

        with torch.no_grad():
            logits = model(tensor)              # (1, num_classes)
            probs  = torch.softmax(logits, dim=1).squeeze(0)  # (num_classes,)

        probs_list  = probs.cpu().numpy().tolist()
        pred_idx    = int(np.argmax(probs_list))
        pred_class  = class_names[pred_idx]
        confidence  = round(probs_list[pred_idx] * 100, 2)

        # Build per-class confidence breakdown
        class_scores = [
            {
                'class'     : class_names[i],
                'confidence': round(probs_list[i] * 100, 2)
            }
            for i in range(len(class_names))
        ]
        # Sort by confidence descending
        class_scores.sort(key=lambda x: x['confidence'], reverse=True)

        return jsonify({
            'success'      : True,
            'prediction'   : pred_class,
            'confidence'   : confidence,
            'class_scores' : class_scores,
            'model_info'   : {
                'architecture': 'SE-ResNet18',
                'pretrained'  : False,
                'img_size'    : IMG_SIZE,
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ─────────────────────────────────────────────────────────────────
# START
# ─────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    load_model()
    print('\n🚀 AI Service running on http://localhost:5050')
    print('   POST /predict  — skin disease classification')
    print('   GET  /health   — service health check\n')
    app.run(host='0.0.0.0', port=5050, debug=False)