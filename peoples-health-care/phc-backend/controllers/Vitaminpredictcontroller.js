import axios from 'axios';
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5003';
export const predict = async (req, res) => {
  try {
    const patientData = req.body;

    // Validate required fields
    const required = [
      'age', 'bmi', 'gender', 'serum_vitamin_d_ng_ml',
      'serum_vitamin_b12_pg_ml', 'serum_folate_ng_ml',
      'vitamin_d_percent_rda', 'vitamin_b12_percent_rda',
      'folate_percent_rda',
    ];

    const missing = required.filter((f) => patientData[f] === undefined || patientData[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Forward to Flask ML API
    const mlResponse = await axios.post(`${ML_API_URL}/predict`, patientData, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    return res.status(200).json({
      success: true,
      data: mlResponse.data,
    });

  } catch (error) {
    // Flask ML API is down
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return res.status(503).json({
        success: false,
        message: 'ML prediction service is currently unavailable. Please try again later.',
      });
    }

    // Flask returned an error
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data?.error || 'Prediction failed',
      });
    }

    console.error('Vitamin predict error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during prediction',
    });
  }
};